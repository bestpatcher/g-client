/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * fallback for `hostUpdateHook.ts`. scans for a newer squirrel sibling
 * `app-VERSION` directory on quit and re-applies the patch there.
 */

import { app } from "electron";
import EventEmitter from "events";
import { dirname, join } from "path";

import { findStaleSibling, patchResourcesDir } from "./applyHostPatch";

function patchLatest() {
    if (process.env.DISABLE_UPDATER_AUTO_PATCHING) return;

    try {
        const stale = findStaleSibling(dirname(process.execPath));
        if (stale) patchResourcesDir(stale, join(__dirname, "patcher.js"));
    } catch (err) {
        console.error("[Equicord] Failed to repatch latest host update", err);
    }
}

if (process.platform === "win32" || process.platform === "linux") {
    // A plain wrapper, not a Proxy: this replaces every EventEmitter's emit
    // in the whole process, so a Proxy's per-call trap overhead is paid on
    // every single emit anywhere in the app for its entire lifetime, not
    // just on the rare "host-updated" event this is actually watching for.
    const originalEmit = EventEmitter.prototype.emit;
    EventEmitter.prototype.emit = function (event: string | symbol, ...args: unknown[]) {
        if (event === "host-updated") patchLatest();
        return originalEmit.call(this, event, ...args);
    };

    // Try to patch latest on before-quit
    // Discord's Win32 updater will call app.quit() on restart and open new version on will-quit
    app.on("before-quit", patchLatest);
}
