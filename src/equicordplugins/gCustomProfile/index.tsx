/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";
import { closeModal, IconUtils, openModal, UserStore } from "@webpack/common";

import { BADGE_CATALOG, BadgeDef, GIFT_TIERS, NITRO_TIERS } from "./badges";
import { CustomProfileModal } from "./CustomProfileModal";
import { getRemoteProfile, ProfileSource, startDirectorySync, stopDirectorySync } from "./directory";
import { settings } from "./settings";

let realGetUser: typeof UserStore.getUser | null = null;
let realGetCurrentUser: typeof UserStore.getCurrentUser | null = null;
let realGetUserAvatarURL: typeof IconUtils.getUserAvatarURL | null = null;
let realGetUserBannerURL: typeof IconUtils.getUserBannerURL | null = null;

const proxyCache = new WeakMap<User, User>();

function isSelf(id: string | undefined) {
    return !!id && !!realGetCurrentUser && realGetCurrentUser()?.id === id;
}

// My own client edits locally for instant preview. Everyone else's fake
// profile (including how OTHER $G/Private clients see mine) comes from the
// synced directory, since this client has no way to locally edit anyone
// else's settings.
function resolveOverride(userId: string | undefined): ProfileSource | undefined {
    if (!userId) return undefined;
    if (isSelf(userId) && isAllowed()) return settings.store;
    return getRemoteProfile(userId);
}

function overrideUser(user: User): User {
    if (!resolveOverride(user.id)) return user;

    const cached = proxyCache.get(user);
    if (cached) return cached;

    const proxy = new Proxy(user, {
        get(target, prop, _receiver) {
            const source = resolveOverride(target.id);
            if (source) {
                if (prop === "username" && source.username) return source.username;
                if (prop === "globalName" && source.displayName) return source.displayName;
                if (prop === "getAvatarURL" && source.avatarUrl) return () => source.avatarUrl;
                if (prop === "displayNameStyles" && source.simulateNitro) {
                    return { colors: [0xff4fd8, 0x3a5fff], effect_id: 0, font_id: 0 };
                }
            }
            return Reflect.get(target, prop, target);
        }
    });
    proxyCache.set(user, proxy);
    return proxy;
}

function applyOverrides() {
    if (realGetUser) return;

    realGetUser = UserStore.getUser.bind(UserStore);
    UserStore.getUser = (id: string) => {
        const user = realGetUser!(id);
        return user ? overrideUser(user) : user;
    };

    realGetCurrentUser = UserStore.getCurrentUser.bind(UserStore);
    UserStore.getCurrentUser = () => {
        const user = realGetCurrentUser!();
        return user ? overrideUser(user) : user;
    };

    realGetUserAvatarURL = IconUtils.getUserAvatarURL.bind(IconUtils);
    IconUtils.getUserAvatarURL = (user, ...rest: unknown[]) => {
        const override = resolveOverride(user?.id);
        if (override?.avatarUrl) return override.avatarUrl;
        return (realGetUserAvatarURL as (...args: unknown[]) => string)(user, ...rest);
    };

    realGetUserBannerURL = IconUtils.getUserBannerURL.bind(IconUtils);
    IconUtils.getUserBannerURL = args => {
        const override = resolveOverride(args?.id);
        if (override?.bannerUrl) return override.bannerUrl;
        return realGetUserBannerURL!(args);
    };
}

function removeOverrides() {
    if (realGetUser) UserStore.getUser = realGetUser;
    if (realGetCurrentUser) UserStore.getCurrentUser = realGetCurrentUser;
    if (realGetUserAvatarURL) IconUtils.getUserAvatarURL = realGetUserAvatarURL;
    if (realGetUserBannerURL) IconUtils.getUserBannerURL = realGetUserBannerURL;
    realGetUser = realGetCurrentUser = realGetUserAvatarURL = realGetUserBannerURL = null;
}

function GemIcon({ name, color }: { name: string; color: string; }) {
    return (
        <svg
            title={name}
            className="vc-gcustomprofile-badge"
            viewBox="0 0 20 20"
            width="20"
            height="20"
        >
            <path
                d="M10 0.5 L19.5 10 L10 19.5 L0.5 10 Z"
                fill={color}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="0.5"
            />
            <path d="M10 0.5 L19.5 10 L10 10 Z" fill="rgba(255,255,255,0.35)" />
        </svg>
    );
}

function makeBadge(def: BadgeDef, hasBadge: (source: ProfileSource) => boolean): ProfileBadge {
    const base = {
        id: `gcustomprofile-${def.id}`,
        description: def.name,
        name: def.name,
        infoLabel: "Discord",
        position: BadgePosition.START,
        shouldShow: ({ userId }: { userId: string; }) => {
            const source = resolveOverride(userId);
            return !!source && hasBadge(source);
        }
    };

    // Real Discord badge: render through the native iconSrc path so it gets
    // Discord's own badge image element, sizing and CSS, identical to a real one.
    if (def.url) {
        return { ...base, iconSrc: def.url };
    }

    // No verified real asset for this one, show a gem placeholder sized to match.
    return { ...base, component: () => <GemIcon name={def.name} color={def.color} /> };
}

const registeredBadges = [
    ...BADGE_CATALOG.map(def => makeBadge(def, s => s.badges.includes(def.id))),
    ...NITRO_TIERS.map(def => makeBadge(def, s => s.nitroTier === def.id)),
    ...GIFT_TIERS.map(def => makeBadge(def, s => s.giftTier === def.id))
];

function openCustomProfileModal() {
    if (!isAllowed()) return;
    const key = openModal(modalProps => (
        <ErrorBoundary noop onError={() => closeModal(key)}>
            <CustomProfileModal modalProps={modalProps} />
        </ErrorBoundary>
    ));
}

export default definePlugin({
    name: "GCustomProfile",
    description: "Lets dev accounts fake their username, avatar, banner and badges across the whole client.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    openModal: openCustomProfileModal,

    start() {
        applyOverrides();
        registeredBadges.forEach(b => addProfileBadge(b));
        startDirectorySync();
    },

    stop() {
        stopDirectorySync();
        removeOverrides();
        registeredBadges.forEach(b => removeProfileBadge(b));
    }
});
