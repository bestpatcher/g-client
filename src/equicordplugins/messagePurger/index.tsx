/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Constants, RestAPI, showToast, UserStore } from "@webpack/common";

interface Hit {
    id: string;
    author: { id: string; };
    channel_id: string;
    type: number;
}

interface RestError {
    status?: number;
    body?: { retry_after?: number; };
}

const logger = new Logger("MessagePurger");
const DELETABLE_TYPES = [0, 19, 20];
const DELETE_DELAY_MS = 700;

const settings = definePluginSettings({
    purging: {
        type: OptionType.CUSTOM,
        default: [] as string[]
    }
});

const isPurging = (channelId: string) => settings.store.purging.includes(channelId);
const setPurging = (channelId: string, on: boolean) => {
    settings.store.purging = on
        ? [...settings.store.purging, channelId]
        : settings.store.purging.filter(id => id !== channelId);
};

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
    const me = UserStore.getCurrentUser().id;
    const skipped = new Set<string>();
    let deleted = 0;

    const isMine = (m: Hit) => m.author.id === me && DELETABLE_TYPES.includes(m.type) && !skipped.has(m.id);

    async function deleteAll(hits: Hit[]) {
        for (const { id, channel_id } of hits) {
            if (!isPurging(channelId)) return;

            try {
                await withRetry(() => RestAPI.del({ url: Constants.Endpoints.MESSAGE(channel_id, id) }));
                deleted++;
            } catch (e) {
                logger.warn("Could not delete a message", e);
                skipped.add(id);
            }
            await sleep(DELETE_DELAY_MS);
        }
    }

    setPurging(channelId, true);
    showToast({ text: "Purge started.", variant: "success", position: "bottom" });

    // Walks the channel history, which is always up to date, unlike search.
    let before: string | undefined;
    while (isPurging(channelId)) {
        const res = await withRetry(() => RestAPI.get({ url: `/channels/${channelId}/messages`, query: { limit: 100, before } }));
        const messages: Hit[] = res.body;
        if (!messages.length) break;

        before = messages[messages.length - 1].id;
        await deleteAll(messages.filter(isMine));
    }

    // Search is the only way to reach the other channels of a server, but it can lag behind.
    while (guildId && isPurging(channelId)) {
        const res = await withRetry(() => RestAPI.get({
            url: `/guilds/${guildId}/messages/search`,
            query: { author_id: me, include_nsfw: true, sort_by: "timestamp", sort_order: "desc" }
        }));
        if (res.status === 202) {
            await sleep((res.body.retry_after ?? 1) * 1000);
            continue;
        }

        const hits: Hit[] = res.body.messages.flat().filter(isMine);
        logger.info("Search returned", hits.length, "deletable messages");
        if (!hits.length) break;

        await deleteAll(hits);
    }

    setPurging(channelId, false);
    showToast({ text: `Purged ${deleted} messages${skipped.size ? `, skipped ${skipped.size}` : ""}.`, variant: "success", position: "bottom" });
}

function PurgeIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z" />
        </svg>
    );
}

const PurgeButton: ChatBarButtonFactory = ({ channel, isMainChat }) => {
    const { purging: purgingChannels } = settings.use(["purging"]);
    const purging = purgingChannels.includes(channel.id);

    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={purging ? "Stop purging" : "Delete all your messages here"}
            onClick={() => {
                if (purging) return setPurging(channel.id, false);

                purge(channel.guild_id ?? null, channel.id).catch(e => {
                    logger.error("Purge failed", e);
                    setPurging(channel.id, false);
                    showToast({ text: `Purge failed${(e as RestError).status ? ` with error ${(e as RestError).status}` : ""}.`, variant: "critical", position: "bottom" });
                });
            }}
        >
            <span style={{ color: purging ? "var(--status-danger)" : undefined }}><PurgeIcon /></span>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "MessagePurger",
    description: "Adds a button next to the message box that deletes all your messages in that DM or server one at a time, newest first.",
    authors: [EquicordDevs.nobody],
    settings,

    chatBarButton: {
        icon: PurgeIcon,
        render: PurgeButton
    },

    start() {
        settings.store.purging = [];
    },

    stop() {
        settings.store.purging = [];
    }
});
