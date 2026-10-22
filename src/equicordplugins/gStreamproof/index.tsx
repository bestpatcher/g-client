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
import { ContextMenuApi, Menu, showToast } from "@webpack/common";

import type * as NativeModule from "./native";

const Native = VencordNative.pluginHelpers.GStreamproof as PluginNative<typeof NativeModule>;

let accountPanelRef: React.RefObject<HTMLDivElement> | null = null;

const settings = definePluginSettings({
    enabled: { type: OptionType.CUSTOM, default: false }
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
        </Menu.Menu>
    );
}, { noop: true });

export default definePlugin({
    name: "GStreamproof",
    description: "Right click your account panel to hide Discord from screen shares and recordings while still seeing it yourself.",
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

    patches: [
        {
            find: "handleOpenSettingsContextMenu=",
            replacement: {
                match: /ref:(\i),style:\i(?=.{0,250}#{intl::USER_PROFILE_ACCOUNT_POPOUT_BUTTON_A11Y_LABEL})/,
                replace: "$&,onContextMenu:($self.grabRef($1),$self.openMenu)"
            }
        }
    ],

    grabRef(ref: React.RefObject<HTMLDivElement>) {
        accountPanelRef = ref;
        return ref;
    },

    openMenu(event: React.UIEvent) {
        if (!isAllowed()) return;
        ContextMenuApi.openContextMenu(event, AccountPanelMenu);
    }
});
