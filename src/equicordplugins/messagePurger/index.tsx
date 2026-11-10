/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import { Constants, RestAPI, showToast, useReducer, UserStore } from "@webpack/common";

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

const purging = new Set<string>();

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

async function purgeChannel(guildId: string | null, channelId: string, rerender: () => void) {
    const me = UserStore.getCurrentUser().id;
    const skipped = new Set<string>();
    let deleted = 0;

    const isMine = (m: Hit) => m.author.id === me && DELETABLE_TYPES.includes(m.type) && !skipped.has(m.id);

    async function deleteAll(hits: Hit[]) {
        for (const { id, channel_id } of hits) {
            if (!purging.has(channelId)) return;
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

    purging.add(channelId);
    rerender();
    showToast({ text: "Purge started.", variant: "success" });

    let before: string | undefined;
    while (purging.has(channelId)) {
        const res = await withRetry(() => RestAPI.get({
            url: `/channels/${channelId}/messages`,
            query: { limit: 100, ...(before ? { before } : {}) }
        })) as RestResponse;
        const messages: Hit[] = res.body;
        if (!messages.length) break;
        before = messages[messages.length - 1].id;
        await deleteAll(messages.filter(isMine));
    }

    while (guildId && purging.has(channelId)) {
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

    purging.delete(channelId);
    rerender();
    showToast({ text: `Purged ${deleted} messages${skipped.size ? `, skipped ${skipped.size}` : ""}.`, variant: "success" });
}

function PurgeIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z" />
        </svg>
    );
}

const PurgeButton: ChatBarButtonFactory = ({ channel, isMainChat }) => {
    const [, rerender] = useReducer(x => x + 1, 0);
    const isPurging = purging.has(channel.id);

    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={isPurging ? "Stop purging" : "Delete all your messages here"}
            onClick={() => {
                if (isPurging) {
                    purging.delete(channel.id);
                    rerender();
                    showToast({ text: "Purge stopped.", variant: "success" });
                    return;
                }
                purgeChannel(channel.guild_id ?? null, channel.id, rerender).catch(e => {
                    logger.error("Purge failed", e);
                    purging.delete(channel.id);
                    rerender();
                    showToast({ text: `Purge failed${(e as RestError).status ? ` (${(e as RestError).status})` : ""}.`, variant: "danger" });
                });
            }}
        >
            <span style={{ color: isPurging ? "var(--status-danger)" : undefined }}>
                <PurgeIcon />
            </span>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "MessagePurger",
    description: "Adds a button next to the message box that deletes all your messages in that channel or server, newest first.",
    authors: [EquicordDevs.nobody],

    chatBarButton: {
        icon: PurgeIcon,
        render: PurgeButton
    },

    stop() {
        purging.clear();
    }
});
