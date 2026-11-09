/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addProfileBadge, BadgePosition, removeProfileBadge } from "@api/Badges";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";
import { closeModal, IconUtils, openModal, UserStore } from "@webpack/common";

import { BADGE_CATALOG, BadgeDef, GIFT_TIERS, NITRO_TIERS } from "./badges";
import { CustomProfileModal } from "./CustomProfileModal";
import { settings } from "./settings";

let realGetUser: typeof UserStore.getUser | null = null;
let realGetCurrentUser: typeof UserStore.getCurrentUser | null = null;
let realGetUserAvatarURL: typeof IconUtils.getUserAvatarURL | null = null;
let realGetUserBannerURL: typeof IconUtils.getUserBannerURL | null = null;

const proxyCache = new WeakMap<User, User>();

function isSelf(id: string | undefined) {
    return !!id && !!realGetCurrentUser && realGetCurrentUser()?.id === id;
}

function overrideUser(user: User): User {
    if (!isAllowed() || !isSelf(user.id)) return user;

    const cached = proxyCache.get(user);
    if (cached) return cached;

    const proxy = new Proxy(user, {
        get(target, prop, _receiver) {
            if (prop === "username" && settings.store.username) return settings.store.username;
            if (prop === "globalName" && settings.store.displayName) return settings.store.displayName;
            if (prop === "getAvatarURL" && settings.store.avatarUrl) return () => settings.store.avatarUrl;
            if (prop === "displayNameStyles" && settings.store.simulateNitro) {
                return { colors: [0xff4fd8, 0x3a5fff], effect_id: 0, font_id: 0 };
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
        if (isAllowed() && settings.store.avatarUrl && isSelf(user?.id)) return settings.store.avatarUrl;
        return (realGetUserAvatarURL as (...args: unknown[]) => string)(user, ...rest);
    };

    realGetUserBannerURL = IconUtils.getUserBannerURL.bind(IconUtils);
    IconUtils.getUserBannerURL = args => {
        if (isAllowed() && settings.store.bannerUrl && isSelf(args?.id)) return settings.store.bannerUrl;
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

function BadgeIcon({ name, color, icon }: { name: string; color: string; icon?: string; }) {
    if (icon) {
        return (
            <img
                title={name}
                alt={name}
                className="vc-gcustomprofile-badge"
                src={`https://cdn.discordapp.com/badge-icons/${icon}.png`}
            />
        );
    }

    return (
        <svg
            title={name}
            className="vc-gcustomprofile-badge"
            viewBox="0 0 16 16"
            width="16"
            height="16"
        >
            <path
                d="M8 0.5 L15.5 8 L8 15.5 L0.5 8 Z"
                fill={color}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="0.5"
            />
            <path d="M8 0.5 L15.5 8 L8 8 Z" fill="rgba(255,255,255,0.35)" />
        </svg>
    );
}

function makeBadge(def: BadgeDef, shouldShow: (userId: string) => boolean) {
    return {
        id: `gcustomprofile-${def.id}`,
        description: def.name,
        position: BadgePosition.START,
        component: () => <BadgeIcon name={def.name} color={def.color} icon={def.icon} />,
        shouldShow: ({ userId }: { userId: string; }) => isAllowed() && isSelf(userId) && shouldShow(userId)
    };
}

const registeredBadges = [
    ...BADGE_CATALOG.map(def => makeBadge(def, () => settings.store.badges.includes(def.id))),
    ...NITRO_TIERS.map(def => makeBadge(def, () => settings.store.nitroTier === def.id)),
    ...GIFT_TIERS.map(def => makeBadge(def, () => settings.store.giftTier === def.id))
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
    },

    stop() {
        removeOverrides();
        registeredBadges.forEach(b => removeProfileBadge(b));
    }
});
