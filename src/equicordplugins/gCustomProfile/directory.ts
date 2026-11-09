/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

// GCLIENT_PROFILE_TOKEN on the gmt-license-api Render service. Shipping inside
// the client (unlike ADMIN_TOKEN, which never leaves the separate admin tool)
// means a leaked client leaks this too, so the server caps the blast radius:
// it only accepts a write for a userId whose hash is already in gAccess.ts's
// ALLOWED (dev) array, re-checked live against GitHub on every write.
const API_BASE = "https://gmt-license-api-1.onrender.com";
const PROFILE_TOKEN = "-D6TkPZzFZMdCuXOMSXdqgFPjUWMukRQ";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const logger = new Logger("GCustomProfile");

export interface ProfileSource {
    username: string;
    displayName: string;
    avatarUrl: string;
    bannerUrl: string;
    simulateNitro: boolean;
    badges: string[];
    nitroTier: string;
    giftTier: string;
}

let directory: Record<string, ProfileSource> = {};
let intervalId: number | undefined;
let abortController: AbortController | undefined;

export function getRemoteProfile(userId: string): ProfileSource | undefined {
    return directory[userId];
}

export async function refreshDirectory() {
    abortController?.abort();
    abortController = new AbortController();

    try {
        const res = await fetch(`${API_BASE}/v1/gclient/profiles`, { signal: abortController.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.ok) directory = data.profiles ?? {};
    } catch (e) {
        logger.warn("Failed to refresh Custom Profile directory", e);
    }
}

export async function publishProfile(userId: string, profile: ProfileSource): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/v1/gclient/profiles`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-GClient-Profile-Token": PROFILE_TOKEN
            },
            body: JSON.stringify({ userId, profile })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
            logger.warn("Custom Profile publish rejected", data?.reason ?? res.status);
            return false;
        }
        directory = { ...directory, [userId]: profile };
        return true;
    } catch (e) {
        logger.warn("Failed to publish Custom Profile", e);
        return false;
    }
}

export function startDirectorySync() {
    if (intervalId !== undefined) return;
    refreshDirectory();
    intervalId = setInterval(refreshDirectory, REFRESH_INTERVAL_MS) as unknown as number;
}

export function stopDirectorySync() {
    if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
    }
    abortController?.abort();
    directory = {};
}
