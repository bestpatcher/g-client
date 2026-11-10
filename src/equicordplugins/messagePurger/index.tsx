/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin, { IconComponent, StartAt } from "@utils/types";
import { Constants, React, RestAPI, showToast, UserStore } from "@webpack/common";

interface Hit {
    id: string;
    author: { id: string; };
    channel_id: string;
    type: number;
}

interface RestResponse {
    status: number;
    body: any;
}

interface RestError {
    status?: number;
    body?: { retry_after?: number; };
}

const logger = new Logger("MessagePurger");
const DELETABLE_TYPES = [0, 19, 20];
const DELETE_DELAY_MS = 350;

let stopRequested = false;

async function withRetry<T>(request: () => Promise<T>): Promise<T> {
    while (true) {
        try {
            return await request();
        } catch (e) {
            const err = e as RestError;
            if (err.status !== 429) throw e;
            await sleep((err.body?.retry_after ?? 1) * 1000);
        }
    }
}

async function purgeChannel(channelId: string, guildId: string | null) {
    const me = UserStore.getCurrentUser().id;
    const skipped = new Set<string>();
    let deleted = 0;

    const isMine = (m: Hit) => m.author.id === me && DELETABLE_TYPES.includes(m.type) && !skipped.has(m.id);

    async function deleteAll(hits: Hit[]) {
        for (const { id, channel_id } of hits) {
            if (stopRequested) return;
            try {
                await withRetry(() => RestAPI.del({ url: Constants.Endpoints.MESSAGE(channel_id, id) }));
                deleted++;
            } catch (e) {
                logger.warn("Could not delete message", e);
                skipped.add(id);
            }
            await sleep(DELETE_DELAY_MS);
        }
    }

    showToast({ text: "Purge started.", variant: "success" });

    let before: string | undefined;
    while (!stopRequested) {
        const res = await withRetry(() => RestAPI.get({
            url: `/channels/${channelId}/messages`,
            query: { limit: 100, ...(before ? { before } : {}) }
        })) as RestResponse;
        const messages: Hit[] = res.body;
        if (!messages.length) break;
        before = messages[messages.length - 1].id;
        await deleteAll(messages.filter(isMine));
    }

    while (guildId && !stopRequested) {
        const res = await withRetry(() => RestAPI.get({
            url: `/guilds/${guildId}/messages/search`,
            query: { author_id: me, include_nsfw: true, sort_by: "timestamp", sort_order: "desc" }
        })) as RestResponse;
        if (res.status === 202) {
            await sleep((res.body.retry_after ?? 1) * 1000);
            continue;
        }
        const hits: Hit[] = (res.body.messages as Hit[][]).flat().filter(isMine);
        if (!hits.length) break;
        await deleteAll(hits);
    }

    if (stopRequested) {
        showToast({ text: `Purge stopped. Deleted ${deleted} messages.`, variant: "success" });
    } else {
        showToast({ text: `Purged ${deleted} messages${skipped.size ? `, skipped ${skipped.size}` : ""}.`, variant: "success" });
    }
}

const PurgeIcon: IconComponent = ({ width = 20, height = 20, className }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z" />
    </svg>
);

const PurgeButton: ChatBarButtonFactory = ({ channel, isMainChat }) => {
    const [purging, setPurging] = React.useState(false);

    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={purging ? "Stop purging" : "Purge your messages in this channel"}
            onClick={() => {
                logger.info("Purge button clicked, purging =", purging, "channel =", channel.id);
                if (purging) {
                    stopRequested = true;
                    setPurging(false);
                    return;
                }
                stopRequested = false;
                setPurging(true);
                showToast({ text: "Starting purge...", variant: "success" });
                purgeChannel(channel.id, channel.guild_id ?? null)
                    .catch(e => {
                        logger.error("Purge failed", e);
                        showToast({ text: `Purge failed${(e as RestError).status ? ` (${(e as RestError).status})` : ""}.`, variant: "danger" });
                    })
                    .finally(() => setPurging(false));
            }}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill={purging ? "var(--status-danger)" : "currentColor"} d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z" />
            </svg>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "MessagePurger",
    description: "Adds a trash can button to the chat bar to delete all your messages in a channel. Click again to stop.",
    authors: [EquicordDevs.nobody],
    dependencies: ["ChatInputButtonAPI"],
    startAt: StartAt.Init,

    chatBarButton: {
        icon: PurgeIcon,
        render: PurgeButton
    },

    stop() {
        stopRequested = true;
    }
});
