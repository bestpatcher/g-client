/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { getCurrentChannel } from "@utils/discord";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Constants, RestAPI, showToast, UserStore } from "@webpack/common";

interface Hit {
    id: string;
    channel_id: string;
    type: number;
}

interface RestError {
    status?: number;
    body?: { retry_after?: number; };
}

const DELETABLE_TYPES = [0, 19, 20];
const BATCH_SIZE = 5;

const settings = definePluginSettings({
    purging: {
        type: OptionType.BOOLEAN,
        description: "Whether a purge is running.",
        default: false,
        hidden: true
    }
});

async function withRetry<T>(request: () => Promise<T>): Promise<T> {
    while (true) {
        try {
            return await request();
        } catch (e) {
            const { status, body } = e as RestError;
            if (status !== 429) throw e;
            await sleep((body?.retry_after ?? 1) * 1000);
        }
    }
}

async function purge(guildId: string | null, channelId: string) {
    const skipped = new Set<string>();
    let deleted = 0;

    settings.store.purging = true;

    while (settings.store.purging) {
        const res = await withRetry(() => RestAPI.get({
            url: guildId ? `/guilds/${guildId}/messages/search` : `/channels/${channelId}/messages/search`,
            query: {
                author_id: UserStore.getCurrentUser().id,
                include_nsfw: true,
                sort_by: "timestamp",
                sort_order: "asc"
            }
        }));
        if (res.status === 202) {
            await sleep((res.body.retry_after ?? 1) * 1000);
            continue;
        }

        const hits: Hit[] = res.body.messages
            .flat()
            .filter((m: Hit & { hit?: boolean; }) => m.hit && DELETABLE_TYPES.includes(m.type) && !skipped.has(m.id));
        if (!hits.length) break;

        for (let i = 0; i < hits.length && settings.store.purging; i += BATCH_SIZE) {
            await Promise.all(hits.slice(i, i + BATCH_SIZE).map(async ({ id, channel_id }) => {
                try {
                    await withRetry(() => RestAPI.del({ url: Constants.Endpoints.MESSAGE(channel_id, id) }));
                    deleted++;
                } catch {
                    skipped.add(id);
                }
            }));
        }
    }

    settings.store.purging = false;
    showToast({ text: `Purged ${deleted} messages.`, variant: "success", position: "bottom" });
}

function PurgeIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z" />
        </svg>
    );
}

const PurgeButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { purging } = settings.use(["purging"]);

    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={purging ? "Stop purging" : "Delete all your messages here"}
            onClick={() => {
                if (purging) return void (settings.store.purging = false);

                const channel = getCurrentChannel();
                if (channel) purge(channel.guild_id ?? null, channel.id);
            }}
        >
            <span style={{ color: purging ? "var(--status-danger)" : undefined }}><PurgeIcon /></span>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "MessagePurger",
    description: "Adds a button next to the message box that deletes all your messages in that DM or server as fast as Discord allows.",
    authors: [EquicordDevs.nobody],
    settings,

    chatBarButton: {
        icon: PurgeIcon,
        render: PurgeButton
    },

    start() {
        settings.store.purging = false;
    },

    stop() {
        settings.store.purging = false;
    }
});
