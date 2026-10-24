/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins, stopPlugin } from "@api/PluginManager";
import { EquicordDevs } from "@utils/constants";
import { checkAccess, isLicensed } from "@utils/gAccess";
import definePlugin from "@utils/types";
import { PluginMeta } from "~plugins";

// Only the framework API plugins (contextMenu, badges, messageEvents, etc.) are left
// running for anyone not on the allow list. Everything else, $G or regular Equicord,
// gets switched off so an unlicensed user just sees stock Discord.
function isFrameworkApi(name: string) {
    return PluginMeta[name]?.folderName.includes("/_api/") ?? false;
}

function lockDown() {
    if (isLicensed()) return;

    for (const name in plugins) {
        if (name === "GLicense" || isFrameworkApi(name)) continue;
        const plugin = plugins[name];
        if (plugin.started) stopPlugin(plugin);
    }
}

export default definePlugin({
    name: "GLicense",
    description: "Locks the private client's mods to the allowed user list.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    flux: {
        async CONNECTION_OPEN() {
            await checkAccess();
            lockDown();
        }
    }
});
