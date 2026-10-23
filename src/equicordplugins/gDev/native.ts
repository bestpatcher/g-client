/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, desktopCapturer, type IpcMainInvokeEvent } from "electron";
import { mkdir, writeFile } from "fs/promises";
import { join, normalize } from "path";

const RECORDINGS_DIR = normalize(join(app.getPath("documents"), "GClient Recordings"));

export async function getDesktopAudioSourceId(_: IpcMainInvokeEvent) {
    try {
        const sources = await desktopCapturer.getSources({ types: ["screen"] });
        if (!sources.length) return { success: false, error: "No audio source available." };
        return { success: true, sourceId: sources[0].id };
    } catch {
        return { success: false, error: "Could not access audio for recording." };
    }
}

export async function saveRecording(_: IpcMainInvokeEvent, buffer: unknown) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
        return { success: false, error: "Nothing was recorded." };
    }

    try {
        await mkdir(RECORDINGS_DIR, { recursive: true });
        const filename = `call-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
        const dest = normalize(join(RECORDINGS_DIR, filename));
        if (!dest.startsWith(RECORDINGS_DIR)) return { success: false, error: "Invalid destination." };

        await writeFile(dest, Buffer.from(buffer));
        return { success: true, path: dest };
    } catch {
        return { success: false, error: "Failed to save the recording." };
    }
}
