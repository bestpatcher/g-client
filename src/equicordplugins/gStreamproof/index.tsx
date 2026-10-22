/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { LOGO, settings as usersSettings } from "@equicordplugins/gUsers";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import { fetchUserProfile } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { RenderModalProps, User } from "@vencord/discord-types";
import { ContextMenuApi, IconUtils, Menu, Modal, openModal, showToast, useEffect, useState, UserStore } from "@webpack/common";

import type * as NativeModule from "./native";

const Native = VencordNative.pluginHelpers.GStreamproof as PluginNative<typeof NativeModule>;

const settings = definePluginSettings({
    enabled: { type: OptionType.CUSTOM, default: false }
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
    showToast({ text: enabled ? "Streamproof on, hidden from screen shares and recordings." : "Streamproof off.", variant: "success" });
}

const AccountPanelMenu = ErrorBoundary.wrap(() => {
    const { enabled } = settings.use(["enabled"]);
    if (!isAllowed()) return null;

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
