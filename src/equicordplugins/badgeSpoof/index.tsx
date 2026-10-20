/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgePosition, type BadgeUserArgs } from "@api/Badges";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

const isMe = ({ userId }: BadgeUserArgs) => userId === UserStore.getCurrentUser().id;

export default definePlugin({
    name: "BadgeSpoof",
    description: "Shows an Early Supporter badge on your own profile. Only you can see them.",
    authors: [EquicordDevs.nobody],
    dependencies: ["BadgeAPI"],
    required: true,

    userProfileBadge: {
        id: "g-early-supporter",
        description: "Early Supporter",
        iconSrc: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png",
        position: BadgePosition.START,
        shouldShow: isMe
    }
});
