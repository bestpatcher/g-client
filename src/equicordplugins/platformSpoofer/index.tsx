/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";

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
        description: "Platform to show other users. Applies on next Discord restart.",
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
    startAt: StartAt.Init,

    start() {
        const originalSend = WebSocket.prototype.send;
        const self = this;

        WebSocket.prototype.send = function (data: string | ArrayBufferLike | Blob | ArrayBufferView) {
            if (typeof data === "string") {
                try {
                    const json = JSON.parse(data);
                    if (json.op === 2 && json.d?.properties) {
                        const p = (settings.store.platform as Platform) ?? "Windows";
                        json.d.properties = { ...json.d.properties, ...PLATFORMS[p] };
                        data = JSON.stringify(json);
                    }
                } catch { }
            }
            return originalSend.call(this, data);
        };

        this._originalSend = originalSend;
    },

    stop() {
        if (this._originalSend) {
            WebSocket.prototype.send = this._originalSend;
            this._originalSend = undefined;
        }
    },

    _originalSend: undefined as (WebSocket["send"]) | undefined,
});
