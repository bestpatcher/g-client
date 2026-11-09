/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface BadgeDef {
    id: string;
    name: string;
    color: string;
    /** Real Discord badge-icons CDN hash. When set, the real asset renders instead of the gem fallback. */
    icon?: string;
}

export const BADGE_CATALOG: BadgeDef[] = [
    { id: "staff", name: "Discord Staff", color: "#5865f2", icon: "5e74e9b61934fc1f67c65515d1f7e60d" },
    { id: "partner", name: "Partnered Server Owner", color: "#5865f2", icon: "3f9748e53446a137a052f3454e2de41e" },
    { id: "mod-alumni", name: "Moderator Programs Alumni", color: "#c2791e", icon: "fee1624003e2fee35cb398e125dc479b" },
    { id: "hypesquad-events", name: "HypeSquad Events", color: "#f4b728", icon: "bf01d1073931f921909045f3a39fd264" },
    { id: "hypesquad-bravery", name: "HypeSquad Bravery", color: "#9c84ef", icon: "8a88d63823d8a71cd5e390baa45efa02" },
    { id: "hypesquad-brilliance", name: "HypeSquad Brilliance", color: "#f47b67", icon: "011940fd013da3f7fb926e4a1cd2e618" },
    { id: "hypesquad-balance", name: "HypeSquad Balance", color: "#45ddc0", icon: "3aa41de486fa12454c3761e8e223442e" },
    { id: "early-supporter", name: "Early Supporter", color: "#ff73fa", icon: "7060786766c9c840eb3019e725d2b358" },
    { id: "bug-hunter-2", name: "Bug Hunter Level 2", color: "#a0d568", icon: "848f79194d4be5ff5f81505cbd0ce1e6" },
    { id: "bug-hunter-1", name: "Bug Hunter Level 1", color: "#5bc0de", icon: "2717692c7dca7289b35297368a940dd0" },
    { id: "verified-dev", name: "Early Verified Bot Developer", color: "#5865f2", icon: "6df5892e0f35b051f8b61eace34f4967" },
    { id: "active-dev", name: "Active Developer", color: "#2ecc71", icon: "6bdc42827a38498929a4920da12695d9" },
    { id: "nitro", name: "Nitro", color: "#ff73fa", icon: "2ba85e8026a8614b640c2837bcdfe21b" },
    { id: "server-booster", name: "Server Booster", color: "#f47fff" }
];
