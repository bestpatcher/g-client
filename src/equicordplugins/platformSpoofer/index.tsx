/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const PLATFORMS = {
    Windows: { $os: "Windows", $browser: "Discord Client", $device: "Discord Client" },
    Mac: { $os: "Mac OS X", $browser: "Discord Client", $device: "Discord Client" },
    Linux: { $os: "Linux", $browser: "Discord Client", $device: "Discord Client" },
    iOS: { $os: "iOS", $browser: "Discord iOS", $device: "Discord iOS" },
    Android: { $os: "Android", $browser: "Discord Android", $device: "Discord Android" },
    Web: { $os: "Mac OS X", $browser: "Chrome", $device: "" },
    Xbox: { $os: "Xbox", $browser: "Xbox", $device: "Xbox" },
    VR: { $os: "Android", $browser: "Discord VR", $device: "Discord VR" },
} as const;

type Platform = keyof typeof PLATFORMS;

const settings = definePluginSettings({
    platform: {
        type: OptionType.SELECT,
        description: "Platform to show other users. Requires restart to apply.",
        options: (Object.keys(PLATFORMS) as Platform[]).map((p, i) => ({
            label: p,
            value: p,
            default: i === 0,
        })),
    },
});

export default definePlugin({
    name: "PlatformSpoofer",
    description: "Spoof your platform so others see you on a different device. Requires restart to apply.",
    authors: [EquicordDevs.nobody],
    settings,

    patches: [
        {
            find: ".identifyStartTime))",
            replacement: {
                // properties object ends with $device: \i.browser — append our overrides after that
                match: /(\$device\s*:\s*\i\.browser)/,
                replace: "$1,...$self.getProperties()",
            },
        },
    ],

    getProperties(): Record<string, string> {
        const p = (settings.store.platform as Platform) ?? "Windows";
        return PLATFORMS[p];
    },
});
