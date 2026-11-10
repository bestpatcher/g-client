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
    /** Badge name shown on the profile and in the hover showcase. Falls back to `name` (the settings dropdown label). */
    displayName?: string;
    /** Subtitle shown in the hover showcase, under the badge name. Falls back to "Discord". */
    infoLabel?: string;
}

const BADGE_ICON = (hash: string) => `https://cdn.discordapp.com/badge-icons/${hash}.png`;
// Not on Discord's own CDN under a stable hash; mirrored by a third-party
// profile-spoofing tool whose whole purpose is faithfully copying these.
// Unverified against the real client, confirm visually once shipped.
const TIER_ICON = (tier: string) => `https://www.cordspoofer.com/assets/img/badges/${tier}.png`;

// Real Nitro tier badges show "Subscriber since <date>" in the hover showcase,
// not a static label. Fake a plausible one from how long the tier implies
// you've been subscribed, so it reads like a real account's badge.
function subscriberSince(monthsAgo: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `Subscriber since ${mm}/${dd}/${d.getFullYear()}`;
}

export const BADGE_CATALOG: BadgeDef[] = [
    { id: "staff", name: "Discord Staff", color: "#5865f2", url: BADGE_ICON("5e74e9b61934fc1f67c65515d1f7e60d") },
    { id: "partner", name: "Partnered Server Owner", color: "#5865f2", url: BADGE_ICON("3f9748e53446a137a052f3454e2de41e") },
    { id: "mod-alumni", name: "Moderator Programs Alumni", color: "#c2791e", url: BADGE_ICON("fee1624003e2fee35cb398e125dc479b") },
    { id: "hypesquad-events", name: "HypeSquad Events", color: "#f4b728", url: BADGE_ICON("bf01d1073931f921909045f3a39fd264") },
    { id: "hypesquad-bravery", name: "HypeSquad Bravery", color: "#9c84ef", url: BADGE_ICON("8a88d63823d8a71cd5e390baa45efa02") },
    { id: "hypesquad-brilliance", name: "HypeSquad Brilliance", color: "#f47b67", url: BADGE_ICON("011940fd013da3f7fb926e4a1cd2e618") },
    { id: "hypesquad-balance", name: "HypeSquad Balance", color: "#45ddc0", url: BADGE_ICON("3aa41de486fa12454c3761e8e223442e") },
    { id: "early-supporter", name: "Early Supporter", color: "#ff73fa", url: BADGE_ICON("7060786766c9c840eb3019e725d2b358") },
    { id: "bug-hunter-1", name: "Bug Hunter Level 1", color: "#5bc0de", url: BADGE_ICON("2717692c7dca7289b35297368a940dd0") },
    { id: "bug-hunter-2", name: "Bug Hunter Level 2", color: "#a0d568", url: BADGE_ICON("848f79194d4be5ff5f81505cbd0ce1e6") },
    { id: "verified-dev", name: "Early Verified Bot Developer", color: "#5865f2", url: BADGE_ICON("6df5892e0f35b051f8b61eace34f4967") },
    { id: "active-dev", name: "Active Developer", color: "#2ecc71", url: BADGE_ICON("6bdc42827a38498929a4920da12695d9") },
    { id: "server-booster", name: "Server Booster", color: "#f47fff" }
];

export const NITRO_TIERS: BadgeDef[] = [
    { id: "starter", name: "Nitro", color: "#ff73fa", url: BADGE_ICON("2ba85e8026a8614b640c2837bcdfe21b"), infoLabel: subscriberSince(0) },
    { id: "bronze", name: "Bronze (1 month)", color: "#c2791e", url: TIER_ICON("bronze"), displayName: "Nitro Bronze", infoLabel: subscriberSince(1) },
    { id: "silver", name: "Silver (3 months)", color: "#9aa3ab", url: TIER_ICON("silver"), displayName: "Nitro Silver", infoLabel: subscriberSince(3) },
    { id: "gold", name: "Gold (6 months)", color: "#e8b923", url: TIER_ICON("gold"), displayName: "Nitro Gold", infoLabel: subscriberSince(6) },
    { id: "platinum", name: "Platinum (1 year)", color: "#6bd6e8", url: TIER_ICON("platinum"), displayName: "Nitro Platinum", infoLabel: subscriberSince(12) },
    { id: "diamond", name: "Diamond (2 years)", color: "#7fd4f0", url: TIER_ICON("diamond"), displayName: "Nitro Diamond", infoLabel: subscriberSince(24) },
    { id: "emerald", name: "Emerald (3 years)", color: "#2ecc71", url: TIER_ICON("emerald"), displayName: "Nitro Emerald", infoLabel: subscriberSince(36) },
    { id: "ruby", name: "Ruby (5 years)", color: "#e0245e", url: TIER_ICON("ruby"), displayName: "Nitro Ruby", infoLabel: subscriberSince(60) },
    { id: "opal", name: "Opal (6+ years)", color: "#c58df0", url: TIER_ICON("opal"), displayName: "Nitro Opal", infoLabel: subscriberSince(84) }
];

export const GIFT_TIERS: BadgeDef[] = [
    { id: "patron", name: "Patron", color: "#5865f2", url: BADGE_ICON("ac305d1b9481f312ce4419e7f8296558") },
    { id: "champion", name: "Champion", color: "#57a65a", url: BADGE_ICON("8b7792c4f65953d3ff564f23429cb79e") },
    { id: "luminary", name: "Luminary", color: "#f4b728", url: BADGE_ICON("3119f5504b2cd09576a323908c7c3517") },
    { id: "icon", name: "Icon", color: "#eb459e", url: BADGE_ICON("64f2413c9b9803661322aaad25826b62") },
    { id: "hero", name: "Hero", color: "#ed4245", url: BADGE_ICON("77d65b1f210014a11eb1582ee06ab684") },
    { id: "legend", name: "Legend", color: "#9b59b6", url: BADGE_ICON("7fe346cfc5da1340087d8759a9e7a395") }
];
