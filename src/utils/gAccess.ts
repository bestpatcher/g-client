/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, UserStore } from "@webpack/common";

const ALLOWED = [
    "69b26ec34e3114f66916832ff3d83160ed9a9e95d131afbad05e0aa29bbec6d4",
    "fa2efd5c423f48f7e34d3826fc6fd26f0b727dc1f98d9cc52d48c38fb1b8cb33"
];

// Everyone who should get the full private client, beyond the dev accounts above.
// Dev accounts are always licensed too, see isLicensed().
const LICENSED: string[] = [
    "f184bcca37ed6dd59821c2b20be2c704291c23a1264501d1401fd2f04aa0df92",
    "d8918cdc8a69cc35e9cca1fcd5240b55008b81949c097a4a7e172b175cf28191",
    "a16e69db7de77cd93c957050e8f81aedf1389f849d636ff8043f84d07167f2cd",
    "f02c23dedfd0fe78715336c8dacf5b7227c89e7abb2edbd2078e24af057e36fe",
    "d8a7056cef8461b0a4caeeb69f7bc67957d81b6b106bc797850bdefd82c5ea74",
    "a64f4a06a90165b14e60c8c0a1360754bb27db92b665f0bec47179c9832a1019",
    "e203bc9b80aff50df5eb5e3b54b3fe4b09b46e6d3adfe964870a6ddb8a555e38"
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
