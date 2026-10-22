/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { EquicordDevs } from "@utils/constants";
import { addChannelToCategory, currentUserCategories, getCategory, removeChannelFromCategory } from "@plugins/pinDms/data";
import { isAllowed } from "@utils/gAccess";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";
import { ChannelStore, Menu, RestAPI } from "@webpack/common";

const CATEGORY_ID = "g-ignored";

function setMuted(channelId: string, muted: boolean) {
    return RestAPI.patch({
        url: "/users/@me/guilds/@me/settings",
        body: { channel_overrides: { [channelId]: { muted, mute_config: null } } }
    });
}

function toggle(channelId: string, ignored: boolean) {
    removeChannelFromCategory(channelId);

    if (!ignored) {
        if (!getCategory(CATEGORY_ID)) {
            currentUserCategories.unshift({ id: CATEGORY_ID, name: "Ignored", color: 15158332, channels: [], collapsed: true });
        }
        addChannelToCategory(channelId, CATEGORY_ID);
    }

    return setMuted(channelId, !ignored);
}

export default definePlugin({
    name: "IgnoredDms",
    description: "Adds an Ignore option that moves a DM into a collapsible Ignored list and mutes it.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    contextMenus: {
        "user-context"(children, { user }: { user?: User; }) {
            const channelId = user && ChannelStore.getDMFromUserId(user.id);
            if (!channelId || !isAllowed()) return;

            const ignored = !!getCategory(CATEGORY_ID)?.channels.includes(channelId);
            children.push(
                <Menu.MenuGroup>
                    <Menu.MenuItem
                        id="vc-ignore-dm"
                        label={<span className="vc-ignore-label">{ignored ? "Unignore" : "Ignore"}</span>}
                        action={() => toggle(channelId, ignored)}
                    />
                </Menu.MenuGroup>
            );
        }
    }
});
