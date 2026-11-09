/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface BadgeDef {
    id: string;
    name: string;
    color: string;
    glyph: string;
}

export const BADGE_CATALOG: BadgeDef[] = [
    { id: "staff", name: "Discord Staff", color: "#5865f2", glyph: "S" },
    { id: "partner", name: "Partnered Server Owner", color: "#5865f2", glyph: "P" },
    { id: "mod-alumni", name: "Moderator Programs Alumni", color: "#c2791e", glyph: "M" },
    { id: "hypesquad-events", name: "HypeSquad Events", color: "#f4b728", glyph: "E" },
    { id: "hypesquad-bravery", name: "HypeSquad Bravery", color: "#9c84ef", glyph: "B" },
    { id: "hypesquad-brilliance", name: "HypeSquad Brilliance", color: "#f47b67", glyph: "B" },
    { id: "hypesquad-balance", name: "HypeSquad Balance", color: "#45ddc0", glyph: "B" },
    { id: "early-supporter", name: "Early Supporter", color: "#ff73fa", glyph: "E" },
    { id: "bug-hunter-2", name: "Bug Hunter Level 2", color: "#a0d568", glyph: "2" },
    { id: "bug-hunter-1", name: "Bug Hunter Level 1", color: "#5bc0de", glyph: "1" },
    { id: "verified-dev", name: "Early Verified Bot Developer", color: "#5865f2", glyph: "D" },
    { id: "active-dev", name: "Active Developer", color: "#2ecc71", glyph: "A" },
    { id: "server-booster", name: "Server Booster", color: "#f47fff", glyph: "N" }
];
