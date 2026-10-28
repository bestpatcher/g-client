/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import definePlugin, { OptionType } from "@utils/types";
import { ContextMenuApi, FriendsStore, Menu, MessageRequestStore, RelationshipStore, showToast, TextInput, UserStore } from "@webpack/common";

import type * as NativeModule from "./native";

const Native = VencordNative.pluginHelpers.GStreamproof as PluginNative<typeof NativeModule>;

export const settings = definePluginSettings({
    enabled: { type: OptionType.CUSTOM, default: false },
    // The real count still lives in RelationshipStore/FriendsStore; this only overrides what
    // they report. emitChange() nudges anything already subscribed to those stores (like the
    // friends list header, which only recomputes on an actual store change) to re-read it now.
    friendCount: {
        type: OptionType.CUSTOM, default: null as number | null,
        onChange: () => { RelationshipStore.emitChange(); FriendsStore.emitChange(); }
    },
    messageCount: {
        type: OptionType.CUSTOM, default: null as number | null,
        onChange: () => MessageRequestStore.emitChange()
    }
});

function parseCount(value: string) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(5000, Math.max(0, n)) : null;
}

// NVIDIA's capture driver refuses to record the whole desktop while ANY window
// has Windows' capture-exclusion flag set, so holding content protection on all
// the time kills ShadowPlay/GeForce Experience recording outright. Only the
// actual Discord stream needs Discord hidden, so we arm protection with the
// toggle but only apply it while a Discord stream is actually live, leaving
// NVIDIA recording free to work the rest of the time.
let streaming = false;
let applied = false;

async function apply() {
    const should = settings.store.enabled && streaming;
    if (should === applied) return;
    const result = await Native.toggle(should);
    if (!result.success) {
        showToast({ text: result.error ?? "Failed to toggle streamproof.", variant: "danger" });
        return;
    }
    applied = should;
}

function set(enabled: boolean) {
    settings.store.enabled = enabled;
    apply();
    showToast({
        text: enabled
            ? "Streamproof armed, Discord hides itself whenever you go live, NVIDIA recording stays unaffected otherwise."
            : "Streamproof off.",
        variant: "success"
    });
}

const ShieldMenu = ErrorBoundary.wrap(() => {
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
            <Menu.MenuControlItem
                id="vc-gstreamproof-friendcount"
                label={`Friend requests: ${friendCountValue}`}
                control={() => (
                    <TextInput
                        value={String(friendCountValue)}
                        onChange={v => { settings.store.friendCount = parseCount(v); }}
                        placeholder="0-5000"
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
                control={() => (
                    <TextInput
                        value={String(messageCountValue)}
                        onChange={v => { settings.store.messageCount = parseCount(v); }}
                        placeholder="0-5000"
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
    description: "Click the shield to hide Discord from your own Discord streams while leaving NVIDIA recording unaffected, and to fake the friend request count.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    flux: {
        STREAM_CREATE(e: { streamKey: string; }) {
            if (!e.streamKey?.endsWith(UserStore.getCurrentUser().id)) return;
            streaming = true;
            return apply();
        },
        STREAM_DELETE(e: { streamKey: string; }) {
            if (!e.streamKey?.endsWith(UserStore.getCurrentUser().id)) return;
            streaming = false;
            return apply();
        }
    },

    start() {
        streaming = false;
        applied = false;
    },

    stop() {
        streaming = false;
        applied = false;
        Native.toggle(false);
    },

    openMenu(event: React.MouseEvent) {
        if (!isAllowed()) return;
        ContextMenuApi.openContextMenu(event, ShieldMenu);
    }
});
