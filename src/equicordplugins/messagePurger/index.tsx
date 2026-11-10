/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import { Alerts, ChannelStore, Constants, Menu, PrivateChannelSortStore, RestAPI, showToast, UserStore } from "@webpack/common";

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

function getDmChannelId(userId: string): string | null {
    for (const id of PrivateChannelSortStore.getPrivateChannelIds()) {
        const ch = ChannelStore.getChannel(id) as any;
        if (ch?.type === 1 && ch.recipients?.includes(userId)) return id;
    }
    return null;
}

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

async function purgeChannel(channelId: string) {
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

    purging.delete(channelId);
    showToast({ text: `Purged ${deleted} messages${skipped.size ? `, skipped ${skipped.size}` : ""}.`, variant: "success" });
}

function insertPurgeItem(children: any[], user: any) {
    const me = UserStore.getCurrentUser();
    if (!me || user.id === me.id) return;

    const purgeItem = (
        <Menu.MenuItem
            id="vc-purge"
            label="Purge"
            color="danger"
        >
            <Menu.MenuItem
                id="vc-purge-all"
                label="Purge Everything"
                color="danger"
                action={() => {
                    const channelId = getDmChannelId(user.id);
                    if (!channelId) {
                        showToast({ text: "No DM channel found with this user.", variant: "danger" });
                        return;
                    }
                    if (purging.has(channelId)) {
                        purging.delete(channelId);
                        showToast({ text: "Purge stopped.", variant: "success" });
                        return;
                    }
                    Alerts.show({
                        title: "Purge Everything",
                        body: `Delete all your messages in your DM with ${user.username}? This cannot be undone.`,
                        confirmText: "Purge",
                        confirmColor: "vc-text-danger",
                        cancelText: "Cancel",
                        onConfirm: () => {
                            purgeChannel(channelId).catch(e => {
                                logger.error("Purge failed", e);
                                purging.delete(channelId);
                                showToast({ text: `Purge failed${(e as RestError).status ? ` (${(e as RestError).status})` : ""}.`, variant: "danger" });
                            });
                        }
                    });
                }}
            />
        </Menu.MenuItem>
    );

    // Insert above "message-logger" if present, otherwise append
    const mlIdx = children.findIndex((c: any) => c?.props?.id === "message-logger");
    if (mlIdx !== -1) {
        children.splice(mlIdx, 0, purgeItem);
    } else {
        children.push(purgeItem);
    }
}

export default definePlugin({
    name: "MessagePurger",
    description: "Right-click a user in DMs to purge all your messages in that conversation.",
    authors: [EquicordDevs.nobody],
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "user-context"(children, props) {
            if (props?.user) insertPurgeItem(children, props.user);
        },
        "gdm-context"(children, props) {
            if (props?.user) insertPurgeItem(children, props.user);
        }
    },

    stop() {
        purging.clear();
    }
});
