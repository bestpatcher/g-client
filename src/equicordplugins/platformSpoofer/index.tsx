/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const PLATFORMS = {
    Windows: {
        os: "Windows",
        browser: "Discord Client",
        browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9195 Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36",
        os_version: "10.0.19045",
    },
    Mac: {
        os: "Mac OS X",
        browser: "Discord Client",
        browser_user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.316 Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36",
        os_version: "10.15.7",
    },
    Linux: {
        os: "Linux",
        browser: "Discord Client",
        browser_user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.65 Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36",
        os_version: "",
    },
    iOS: {
        os: "iOS",
        browser: "Discord iOS",
        browser_user_agent: "Discord/253002 CFNetwork/1568.300.101 Darwin/24.2.0",
        os_version: "18.2",
    },
    Android: {
        os: "Android",
        browser: "Discord Android",
        browser_user_agent: "Discord-Android/253002;RNA",
        os_version: "14",
    },
    Web: {
        os: "Windows",
        browser: "Chrome",
        browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        os_version: "10.0.19045",
    },
    VR: {
        os: "Android",
        browser: "Discord VR",
        browser_user_agent: "Discord/253002 (Android 10; Meta Quest 3)",
        os_version: "10",
    },
} as const;

type Platform = keyof typeof PLATFORMS;

const settings = definePluginSettings({
    platform: {
        type: OptionType.SELECT,
        description: "Platform to spoof in the gateway identify payload.",
        options: (Object.keys(PLATFORMS) as Platform[]).map((p, i) => ({
            label: p,
            value: p,
            default: i === 0,
        })),
        restartNeeded: true,
    },
});

export default definePlugin({
    name: "PlatformSpoofer",
    description: "Spoof your platform in the Discord gateway identify payload. Requires restart to apply.",
    authors: [EquicordDevs.nobody],
    settings,

    patches: [
        {
            find: ".identifyStartTime))",
            replacement: {
                match: /(?<=properties:\{os:\i,browser:\i,(?:release_channel:\i,)?browser_user_agent:\i,browser_version:\i,os_version:\i)/,
                replace: ",...$self.getSpoof()",
            },
        },
    ],

    getSpoof() {
        const p = settings.store.platform as Platform ?? "Windows";
        return PLATFORMS[p] ?? PLATFORMS.Windows;
    },
});
