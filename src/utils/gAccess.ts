/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, UserStore } from "@webpack/common";

const ALLOWED = [
];

// Everyone who should get the full private client, beyond the dev accounts above.
// Dev accounts are always licensed too, see isLicensed().
const LICENSED: string[] = [
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
