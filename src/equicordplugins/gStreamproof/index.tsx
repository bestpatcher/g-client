/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { LOGO, settings as usersSettings } from "@equicordplugins/gUsers";
import { debounce } from "@shared/debounce";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import { fetchUserProfile } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { RenderModalProps, User } from "@vencord/discord-types";
import { ContextMenuApi, FriendsStore, IconUtils, Menu, MessageRequestStore, Modal, openModal, RelationshipStore, showToast, useEffect, useState, UserStore } from "@webpack/common";

import type * as NativeModule from "./native";

const Native = VencordNative.pluginHelpers.GStreamproof as PluginNative<typeof NativeModule>;

export const settings = definePluginSettings({
    enabled: { type: OptionType.CUSTOM, default: false },
    // The real counts still live in RelationshipStore/FriendsStore/MessageRequestStore; this only
    // overrides what they report. emitChange() nudges anything already subscribed to those stores
    // (like the friends list header, which only recomputes on an actual store change) to re-read it now.
    friendCount: {
        type: OptionType.CUSTOM, default: null as number | null,
        onChange: () => { RelationshipStore.emitChange(); FriendsStore.emitChange(); }
    },
    messageCount: {
        type: OptionType.CUSTOM, default: null as number | null,
        onChange: () => MessageRequestStore.emitChange()
    }
});

function UsersModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const { users } = usersSettings.use(["users"]);
    const ids = Object.keys(users);
    const [list, setList] = useState<User[]>(() => ids.map(id => UserStore.getUser(id)).filter(Boolean) as User[]);

    useEffect(() => {
        Promise.all(ids.filter(id => !UserStore.getUser(id)).map(id => fetchUserProfile(id).catch(() => null)))
            .then(() => setList(ids.map(id => UserStore.getUser(id)).filter(Boolean) as User[]));
    }, [ids.join(",")]);

    return (
        <ErrorBoundary>
            <Modal {...modalProps} size="md" title={`Users on $G (${ids.length})`}>
                <div className="vc-gstreamproof-users-content">
                    {ids.length === 0 && <div>Nobody has been seen on this client yet.</div>}
                    {list.map(user => (
                        <div key={user.id} className="vc-gstreamproof-users-row">
                            <img className="vc-gstreamproof-users-avatar" src={IconUtils.getUserAvatarURL(user, true, 64)} />
                            <span>{user.globalName ?? user.username}</span>
                            <img className="vc-gstreamproof-users-logo" src={LOGO} />
                        </div>
                    ))}
                </div>
            </Modal>
        </ErrorBoundary>
    );
}

async function set(enabled: boolean) {
    const result = await Native.toggle(enabled);
    if (!result.success) {
        showToast({ text: result.error ?? "Failed to toggle streamproof.", variant: "danger" });
        return;
    }
    settings.store.enabled = enabled;
    showToast({ text: enabled ? "On" : "Off", variant: "success" });
}

const AccountPanelMenu = ErrorBoundary.wrap(() => {
    const { enabled, friendCount, messageCount } = settings.use(["enabled", "friendCount", "messageCount"]);
    if (!isAllowed()) return null;
    const friendCountValue = friendCount ?? 0;
    const messageCountValue = messageCount ?? 0;

    return (
        <Menu.Menu navId="vc-gstreamproof" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuCheckboxItem
                id="vc-gstreamproof-toggle"
                label="Developer Streamproof"
                checked={enabled}
                action={() => set(!enabled)}
            />
            <Menu.MenuItem
                id="vc-gstreamproof-users"
                label="Users"
                action={() => openModal(modalProps => <UsersModal modalProps={modalProps} />)}
            />
            <Menu.MenuControlItem
                id="vc-gstreamproof-friendcount"
                label={`Friend requests: ${friendCountValue}`}
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={0}
                        maxValue={5000}
                        value={friendCountValue}
                        onChange={debounce((v: number) => { settings.store.friendCount = Math.round(v); }, 50)}
                        renderValue={(v: number) => String(Math.round(v))}
                    />
                )}
            />
            <Menu.MenuItem
                id="vc-gstreamproof-friendcount-reset"
                label="Reset friend count"
                action={() => { settings.store.friendCount = null; }}
            />
            <Menu.MenuControlItem
                id="vc-gstreamproof-messagecount"
                label={`Message requests: ${messageCountValue}`}
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={0}
                        maxValue={5000}
                        value={messageCountValue}
                        onChange={debounce((v: number) => { settings.store.messageCount = Math.round(v); }, 50)}
                        renderValue={(v: number) => String(Math.round(v))}
                    />
                )}
            />
            <Menu.MenuItem
                id="vc-gstreamproof-messagecount-reset"
                label="Reset message count"
                action={() => { settings.store.messageCount = null; }}
            />
        </Menu.Menu>
    );
}, { noop: true });

export default definePlugin({
    name: "GStreamproof",
    description: "Click the shield for streamproof and a list of who is using this client, for the dev accounts.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    start() {
        if (isAllowed() && settings.store.enabled) Native.toggle(true);
    },

    stop() {
        Native.toggle(false);
    },

    openMenu(event: React.MouseEvent) {
        if (!isAllowed()) return;
        ContextMenuApi.openContextMenu(event, AccountPanelMenu);
    }
});
