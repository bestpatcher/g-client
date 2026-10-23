/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, UserStore } from "@webpack/common";

const ALLOWED = [
    "d8a7056cef8461b0a4caeeb69f7bc67957d81b6b106bc797850bdefd82c5ea74",
    "69b26ec34e3114f66916832ff3d83160ed9a9e95d131afbad05e0aa29bbec6d4",
    "fa2efd5c423f48f7e34d3826fc6fd26f0b727dc1f98d9cc52d48c38fb1b8cb33",
    "deaff5bec51f08055788d8306ce9c4938b5a65316e94f0ddeafa6911b734a4fa"
];

// Everyone who should get the full private client, beyond the dev accounts above.
// Dev accounts are always licensed too, see isLicensed().
const LICENSED: string[] = [
    "a16e69db7de77cd93c957050e8f81aedf1389f849d636ff8043f84d07167f2cd",
    "d8918cdc8a69cc35e9cca1fcd5240b55008b81949c097a4a7e172b175cf28191"
];

let allowed = false;
let licensed = false;

export const isAllowed = () => allowed;
export const isLicensed = () => allowed || licensed;

export async function checkAccess() {
    const id = new TextEncoder().encode(UserStore.getCurrentUser().id);
    const buf = await crypto.subtle.digest("SHA-256", id);
    const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    allowed = ALLOWED.includes(hash);
    licensed = LICENSED.includes(hash);
}

export function resetAccess() {
    allowed = false;
    licensed = false;
}

export function useAccess() {
    const [ok, setOk] = useState(allowed);

    useEffect(() => {
        checkAccess().then(() => setOk(allowed));
    }, []);

    return ok;
}

export function useLicense() {
    const [ok, setOk] = useState(allowed || licensed);

    useEffect(() => {
        checkAccess().then(() => setOk(allowed || licensed));
    }, []);

    return ok;
}
