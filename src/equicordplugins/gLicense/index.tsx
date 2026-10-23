/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins, stopPlugin } from "@api/PluginManager";
import { EquicordDevs } from "@utils/constants";
import { checkAccess, isLicensed } from "@utils/gAccess";
import definePlugin from "@utils/types";

// Everything that makes this client the private $G build rather than regular Discord.
// Anyone not on the allow list (see @utils/gAccess) gets all of this switched off.
const GATED_PLUGINS = [
    "GVoice",
    "GHeader",
    "GStreamproof",
    "GLogo",
    "GTheme",
    "GProfileLog",
    "GUsers",
    "GDev",
    "GMessageColor",
    "GLoading",
    "LowzModules"
];

function lockDown() {
    if (isLicensed()) return;

    for (const name of GATED_PLUGINS) {
        const plugin = plugins[name];
        if (plugin?.started) stopPlugin(plugin);
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
