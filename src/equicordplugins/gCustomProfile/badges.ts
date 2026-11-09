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
    { id: "server-booster", name: "Server Booster", color: "#f47fff", glyph: "B" }
];

export const NITRO_TIERS: BadgeDef[] = [
    { id: "nitro", name: "Nitro (0 months)", color: "#ff73fa", glyph: "N" },
    { id: "bronze", name: "Bronze (1 month)", color: "#c2791e", glyph: "N" },
    { id: "silver", name: "Silver (3 months)", color: "#9aa3ab", glyph: "N" },
    { id: "gold", name: "Gold (6 months)", color: "#e8b923", glyph: "N" },
    { id: "platinum", name: "Platinum (12 months)", color: "#6bd6e8", glyph: "N" },
    { id: "diamond", name: "Diamond (24 months)", color: "#7fd4f0", glyph: "N" },
    { id: "emerald", name: "Emerald (36 months)", color: "#2ecc71", glyph: "N" },
    { id: "ruby", name: "Ruby (60 months)", color: "#e0245e", glyph: "N" },
    { id: "opal", name: "Opal (72 months)", color: "#c58df0", glyph: "N" }
];

export const GIFT_TIERS: BadgeDef[] = [
    { id: "patron", name: "Patron", color: "#5865f2", glyph: "G" },
    { id: "champion", name: "Champion", color: "#57a65a", glyph: "G" },
    { id: "luminary", name: "Luminary", color: "#f4b728", glyph: "G" },
    { id: "icon", name: "Icon", color: "#eb459e", glyph: "G" },
    { id: "hero", name: "Hero", color: "#ed4245", glyph: "G" },
    { id: "legend", name: "Legend", color: "#9b59b6", glyph: "G" }
];
