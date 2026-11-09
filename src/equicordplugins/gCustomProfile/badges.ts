/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface BadgeDef {
    id: string;
    name: string;
    color: string;
    /** Real Discord badge asset URL. When set, the real asset renders instead of the gem fallback. */
    url?: string;
}

export const BADGE_CATALOG: BadgeDef[] = [
    { id: "staff", name: "Discord Staff", color: "#5865f2", url: "https://discord.com/assets/48d5bdcffe9e7848067c2e187f1ef951.svg" },
    { id: "partner", name: "Partnered Server Owner", color: "#5865f2", url: "https://discord.com/assets/34306011e46e87f8ef25f3415d3b99ca.svg" },
    { id: "mod-alumni", name: "Moderator Programs Alumni", color: "#c2791e", url: "https://discord.com/assets/c981e58b5ea4b7fedd3a643cf0c60564.svg" },
    { id: "hypesquad-events", name: "HypeSquad Events", color: "#f4b728", url: "https://discord.com/assets/e666a84a7a5ea2abbbfa73adf22e627b.svg" },
    { id: "hypesquad-bravery", name: "HypeSquad Bravery", color: "#9c84ef", url: "https://discord.com/assets/efcc751513ec434ea4275ecda4f61136.svg" },
    { id: "hypesquad-brilliance", name: "HypeSquad Brilliance", color: "#f47b67", url: "https://discord.com/assets/ec8e92568a7c8f19a052ef42f862ff18.svg" },
    { id: "hypesquad-balance", name: "HypeSquad Balance", color: "#45ddc0", url: "https://discord.com/assets/9f00b18e292e10fc0ae84ff5332e8b0b.svg" },
    { id: "early-supporter", name: "Early Supporter", color: "#ff73fa", url: "https://discord.com/assets/b802e9af134ff492276d94220e36ec5c.svg" },
    { id: "bug-hunter-1", name: "Bug Hunter Level 1", color: "#5bc0de", url: "https://discord.com/assets/8353d89b529e13365c415aef08d1d1f4.svg" },
    { id: "bug-hunter-2", name: "Bug Hunter Level 2", color: "#a0d568", url: "https://discord.com/assets/f599063762165e0d23e8b11b684765a8.svg" },
    { id: "verified-dev", name: "Early Verified Bot Developer", color: "#5865f2", url: "https://discord.com/assets/4441e07fe0f46b3cb41b79366236fca6.svg" },
    { id: "active-dev", name: "Active Developer", color: "#2ecc71", url: "https://discord.com/assets/26c7a60fb1654315e0be26107bd47470.svg" },
    { id: "server-booster", name: "Server Booster", color: "#f47fff", url: "https://discord.com/assets/ca18353be0e57a2b3b3132fa1c08d6b4.svg" }
];

export const NITRO_TIERS: BadgeDef[] = [
    { id: "starter", name: "Nitro Starter", color: "#ff73fa", url: "https://cdn.discordapp.com/assets/content/f61ddf640d11d9bdfaf9de265eb862edf28986b659e545f293b54adf229433af.svg" },
    { id: "bronze", name: "Bronze (1 month)", color: "#c2791e", url: "https://discord.com/assets/0386191373eb17c272df.svg" },
    { id: "silver", name: "Silver (3 months)", color: "#9aa3ab", url: "https://discord.com/assets/9d4d362c62da3c985845.svg" },
    { id: "gold", name: "Gold (6 months)", color: "#e8b923", url: "https://discord.com/assets/8725fe12ada9afa51c1a.svg" },
    { id: "platinum", name: "Platinum (1 year)", color: "#6bd6e8", url: "https://discord.com/assets/746689c803e06be87705.svg" },
    { id: "diamond", name: "Diamond (2 years)", color: "#7fd4f0", url: "https://discord.com/assets/f3521e2861ff44a0384d.svg" },
    { id: "emerald", name: "Emerald (3 years)", color: "#2ecc71", url: "https://discord.com/assets/f2b9b02fb22cc6459922.svg" },
    { id: "ruby", name: "Ruby (5 years)", color: "#e0245e", url: "https://discord.com/assets/ecf86e18838013c9d95a.svg" },
    { id: "opal", name: "Opal (6+ years)", color: "#c58df0", url: "https://discord.com/assets/b4fc7a9c37ec2fae36e3.svg" }
];

export const GIFT_TIERS: BadgeDef[] = [
    { id: "patron", name: "Patron", color: "#5865f2", url: "https://cdn.discordapp.com/badge-icons/ac305d1b9481f312ce4419e7f8296558.png" },
    { id: "champion", name: "Champion", color: "#57a65a", url: "https://cdn.discordapp.com/badge-icons/8b7792c4f65953d3ff564f23429cb79e.png" },
    { id: "luminary", name: "Luminary", color: "#f4b728", url: "https://cdn.discordapp.com/badge-icons/3119f5504b2cd09576a323908c7c3517.png" },
    { id: "icon", name: "Icon", color: "#eb459e", url: "https://cdn.discordapp.com/badge-icons/64f2413c9b9803661322aaad25826b62.png" },
    { id: "hero", name: "Hero", color: "#ed4245", url: "https://cdn.discordapp.com/badge-icons/77d65b1f210014a11eb1582ee06ab684.png" },
    { id: "legend", name: "Legend", color: "#9b59b6", url: "https://cdn.discordapp.com/badge-icons/7fe346cfc5da1340087d8759a9e7a395.png" }
];
