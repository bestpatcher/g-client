/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps } from "@webpack";

const PLATFORMS = {
    Windows: { os: "Windows", browser: "Discord Client", device: "Discord Client" },
    Mac: { os: "Mac OS X", browser: "Discord Client", device: "Discord Client" },
    Linux: { os: "Linux", browser: "Discord Client", device: "Discord Client" },
    iOS: { os: "iOS", browser: "Discord iOS", device: "Discord iOS" },
    Android: { os: "Android", browser: "Discord Android", device: "Discord Android" },
    Web: { os: "Linux", browser: "Chrome", device: "" },
    Xbox: { os: "Xbox", browser: "Discord Embedded", device: "Xbox" },
    VR: { os: "Android", browser: "Discord VR", device: "Meta Quest" },
} as const;

type Platform = keyof typeof PLATFORMS;

const settings = definePluginSettings({
    platform: {
        type: OptionType.SELECT,
        description: "Platform to show other users.",
        options: (Object.keys(PLATFORMS) as Platform[]).map((p, i) => ({
            label: p,
            value: p,
            default: i === 0,
        })),
        onChange: () => forceIdentify(),
    },
});

let _origSend: Function | null = null;
let _socket: any = null;

function getSocket(): any | null {
    return findByProps("getSocket", "isConnected")?.getSocket() ?? null;
}

function patchSocket(socket: any) {
    if (!socket || socket.__psPatched) return;
    _origSend = socket.send.bind(socket);
    socket.send = function (op: number, data: any, flag?: boolean) {
        if (op === 2 && data?.properties) {
            const p = (settings.store.platform as Platform) ?? "Windows";
            Object.assign(data.properties, PLATFORMS[p]);
        }
        return _origSend!(op, data, flag);
    };
    socket.__psPatched = true;
    _socket = socket;
}

function unpatchSocket() {
    if (_socket && _origSend) {
        _socket.send = _origSend;
        delete _socket.__psPatched;
    }
    _origSend = null;
    _socket = null;
}

function forceIdentify() {
    const socket = getSocket();
    if (!socket) return;
    if (!socket.__psPatched) {
        unpatchSocket();
        patchSocket(socket);
    }
    socket.sessionId = null;
    socket.seq = 0;
    const ws = socket.webSocket;
    if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close(1000);
    } else if (!ws) {
        socket.close();
        setTimeout(() => socket.connect(), 500);
    }
}

export default definePlugin({
    name: "PlatformSpoofer",
    description: "Spoof your platform so others see you on a different device.",
    authors: [EquicordDevs.nobody],
    settings,

    start() {
        const socket = getSocket();
        if (!socket) return;
        patchSocket(socket);
        const GCS = findByProps("getSocket", "isConnected");
        if (GCS?.isConnected()) forceIdentify();
    },

    stop() {
        unpatchSocket();
    },
});
