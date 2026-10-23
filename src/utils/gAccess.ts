/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState, UserStore } from "@webpack/common";

const ALLOWED = [
    "d8a7056cef8461b0a4caeeb69f7bc67957d81b6b106bc797850bdefd82c5ea74",
    "69b26ec34e3114f66916832ff3d83160ed9a9e95d131afbad05e0aa29bbec6d4",
    "fa2efd5c423f48f7e34d3826fc6fd26f0b727dc1f98d9cc52d48c38fb1b8cb33"
];

let allowed = false;

export const isAllowed = () => allowed;

export async function checkAccess() {
    const id = new TextEncoder().encode(UserStore.getCurrentUser().id);
    const buf = await crypto.subtle.digest("SHA-256", id);
    allowed = ALLOWED.includes([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""));
}

export function resetAccess() {
    allowed = false;
}

export function useAccess() {
    const [ok, setOk] = useState(allowed);

    useEffect(() => {
        checkAccess().then(() => setOk(allowed));
    }, []);

    return ok;
}
