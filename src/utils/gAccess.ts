/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, UserStore } from "@webpack/common";

const ALLOWED = [
    "d8a7056cef8461b0a4caeeb69f7bc67957d81b6b106bc797850bdefd82c5ea74",
    "69b26ec34e3114f66916832ff3d83160ed9a9e95d131afbad05e0aa29bbec6d4"
];

// Everyone who should get the full private client, beyond the dev accounts above.
// Dev accounts are always licensed too, see isLicensed(). The exe tool pushes
// add/remove commits here directly, so this starts empty.
const LICENSED: string[] = [
    "d8a7056cef8461b0a4caeeb69f7bc67957d81b6b106bc797850bdefd82c5ea74"
];

let allowed = false;
let licensed = false;
// Switching Discord accounts without restarting the client doesn't remount
// the shield button, so it has to be told to re-check access rather than
// only checking once on mount.
const listeners = new Set<() => void>();

export const isAllowed = () => allowed;
export const isLicensed = () => allowed || licensed;

export async function checkAccess() {
    const id = new TextEncoder().encode(UserStore.getCurrentUser().id);
    const buf = await crypto.subtle.digest("SHA-256", id);
    const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    allowed = ALLOWED.includes(hash);
    licensed = LICENSED.includes(hash);
    listeners.forEach(l => l());
}

export function resetAccess() {
    allowed = false;
    licensed = false;
    listeners.forEach(l => l());
}

export function useAccess() {
    const [ok, setOk] = useState(allowed);

    useEffect(() => {
        const update = () => setOk(allowed);
        listeners.add(update);
        checkAccess().then(update);
        return () => void listeners.delete(update);
    }, []);

    return ok;
}

export function useLicense() {
    const [ok, setOk] = useState(allowed || licensed);

    useEffect(() => {
        const update = () => setOk(allowed || licensed);
        listeners.add(update);
        checkAccess().then(update);
        return () => void listeners.delete(update);
    }, []);

    return ok;
}
