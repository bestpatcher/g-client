/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin, { IconComponent } from "@utils/types";
import { Constants, React, RestAPI, UserStore } from "@webpack/common";

interface Hit {
    id: string;
    author: { id: string; };
    channel_id: string;
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
const DELETE_DELAY_MS = 350;

let stopRequested = false;

async function withRetry<T>(request: () => Promise<T>): Promise<T> {
    while (true) {
        try {
            return await request();
        } catch (e) {
            const err = e as RestError;
            if (err.status !== 429) throw e;
            const retryAfter = err.body?.retry_after ?? 1;
            logger.warn(`Rate limited, retrying in ${retryAfter}s`);
            await sleep(retryAfter * 1000);
        }
    }
}

async function purgeChannel(channelId: string) {
    const me = UserStore.getCurrentUser().id;
    let deleted = 0;
    let before: string | undefined;

    logger.info("Starting purge for channel", channelId, "as user", me);

    while (!stopRequested) {
        const res = await withRetry(() => RestAPI.get({
            url: Constants.Endpoints.MESSAGES(channelId),
            query: { limit: 100, ...(before ? { before } : {}) }
        })) as RestResponse;

        const messages: Hit[] = Array.isArray(res.body) ? res.body : [];
        logger.info(`Fetched ${messages.length} messages`);

        if (!messages.length) break;
        before = messages[messages.length - 1].id;

        for (const msg of messages) {
            if (stopRequested) break;
            if (msg.author.id !== me) continue;
            try {
                await withRetry(() => RestAPI.del({ url: Constants.Endpoints.MESSAGE(msg.channel_id, msg.id) }));
                deleted++;
                logger.info(`Deleted message ${msg.id} (total: ${deleted})`);
            } catch (e) {
                logger.warn("Could not delete message", msg.id, e);
            }
            await sleep(DELETE_DELAY_MS);
        }
    }

    logger.info(`Purge complete. Deleted ${deleted} messages.`);
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
                if (purging) {
                    stopRequested = true;
                    setPurging(false);
                    logger.info("Purge stopped by user");
                    return;
                }
                stopRequested = false;
                setPurging(true);
                logger.info("Purge started by user for channel", channel.id);
                purgeChannel(channel.id)
                    .catch(e => logger.error("Purge failed", e))
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

    chatBarButton: {
        icon: PurgeIcon,
        render: PurgeButton
    },

    stop() {
        stopRequested = true;
    }
});
