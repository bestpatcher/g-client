/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, type IpcMainInvokeEvent } from "electron";

export function toggle(_event: IpcMainInvokeEvent, enabled: unknown) {
    if (typeof enabled !== "boolean") return { success: false, error: "Invalid value." };

    const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === "Discord") ?? BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: "Discord window not found." };

    win.setContentProtection(enabled);
    return { success: true };
}
