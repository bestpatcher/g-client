/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { debounce } from "@shared/debounce";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import definePlugin, { OptionType } from "@utils/types";
import { extractAndLoadChunksLazy } from "@webpack";
import { ContextMenuApi, FriendsStore, Menu, MessageRequestStore, RelationshipStore, showToast } from "@webpack/common";

import type * as NativeModule from "./native";

const Native = VencordNative.pluginHelpers.GStreamproof as PluginNative<typeof NativeModule>;

// Menu.MenuSliderControl only fills in once Discord's own webpack chunk for it has loaded,
// which doesn't always happen before the shield menu is first opened. Force it early.
const requireMenuSliderControl = extractAndLoadChunksLazy(["SLIDER)", "handleSize:16"]);

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

async function set(enabled: boolean) {
    const result = await Native.toggle(enabled);
    if (!result.success) {
        showToast({ text: result.error ?? "Failed to toggle streamproof.", variant: "danger" });
        return;
    }
    settings.store.enabled = enabled;
    showToast({ text: enabled ? "Streamproof on, hidden from screen shares and recordings." : "Streamproof off.", variant: "success" });
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
            {Menu.MenuSliderControl && (
                <>
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
                </>
            )}
        </Menu.Menu>
    );
}, { noop: true });

export default definePlugin({
    name: "GStreamproof",
    description: "Click the shield to hide Discord from screen shares and recordings while still seeing it yourself, and to fake the friend request count.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    start() {
        if (isAllowed() && settings.store.enabled) Native.toggle(true);
        if (isAllowed()) requireMenuSliderControl().catch(() => {});
    },

    stop() {
        Native.toggle(false);
    },

    async openMenu(event: React.MouseEvent) {
        if (!isAllowed()) return;
        await requireMenuSliderControl();
        ContextMenuApi.openContextMenu(event, ShieldMenu);
    }
});
