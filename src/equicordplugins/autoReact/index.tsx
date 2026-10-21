/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import { Channel, Message, RenderModalProps } from "@vencord/discord-types";
import { Constants, Menu, MessageStore, Modal, openModal, RestAPI, SearchableSelect, showToast, TextInput, useState, UserStore } from "@webpack/common";

interface Rule {
    emoji: string;
    burst: boolean;
    userId: string;
}

interface RestError {
    status?: number;
    body?: { retry_after?: number; };
}

const rules = new Map<string, Rule>();

async function react(channelId: string, messageId: string, { emoji, burst }: Rule) {
    while (true) {
        try {
            return await RestAPI.put({
                url: Constants.Endpoints.REACTION(channelId, messageId, emoji, "@me"),
                query: burst ? { type: 1 } : undefined
            });
        } catch (e) {
            const { status, body } = e as RestError;
            if (status !== 429) throw e;
            await sleep((body?.retry_after ?? 1) * 1000);
        }
    }
}

function parseEmoji(input: string) {
    const custom = input.trim().match(/^<a?:(\w+):(\d+)>$/);
    return custom ? `${custom[1]}:${custom[2]}` : input.trim();
}

function AutoReactModal({ modalProps, channel }: { modalProps: RenderModalProps; channel: Channel; }) {
    const meId = UserStore.getCurrentUser().id;
    const [emoji, setEmoji] = useState("");
    const [type, setType] = useState("normal");
    const [userId, setUserId] = useState(meId);

    const ids = new Set([meId, ...(channel.recipients ?? []), ...MessageStore.getMessages(channel.id).toArray().map((m: Message) => m.author.id)]);
    const people = [...ids].map(id => ({
        label: id === meId ? "Just me" : UserStore.getUser(id)?.username ?? id,
        value: id
    }));

    const start = () => {
        if (!emoji.trim()) return showToast({ text: "Type or paste an emoji first.", variant: "critical", position: "bottom" });
        rules.set(channel.id, { emoji: parseEmoji(emoji), burst: type === "super", userId });
        showToast({ text: "Auto React is on for this chat.", variant: "success", position: "bottom" });
        modalProps.onClose();
    };

    return (
        <Modal {...modalProps} size="md" title="Auto React" actions={[{ text: "Start", variant: "primary", onClick: start }]}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
                <TextInput value={emoji} onChange={setEmoji} placeholder="Type or paste an emoji" />
                <SearchableSelect
                    options={[{ label: "Normal reaction", value: "normal" }, { label: "Super reaction", value: "super" }]}
                    value={type}
                    onChange={setType}
                />
                <SearchableSelect options={people} value={userId} onChange={setUserId} />
            </div>
        </Modal>
    );
}

export default definePlugin({
    name: "AutoReact",
    description: "Adds an Auto React option to the plus menu next to the message box.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    stop() {
        rules.clear();
    },

    flux: {
        MESSAGE_CREATE({ message, channelId, optimistic }: { message: Message; channelId: string; optimistic?: boolean; }) {
            const rule = rules.get(channelId);
            if (optimistic || rule?.userId !== message.author?.id) return;
            return react(channelId, message.id, rule);
        }
    },

    contextMenus: {
        "channel-attach"(children, { channel }: { channel: Channel; }) {
            const on = rules.has(channel.id);
            children.push(
                <Menu.MenuItem
                    id="vc-auto-react"
                    label={on ? "Stop Auto React" : "Auto React"}
                    action={() => {
                        if (!on) return openModal(p => <AutoReactModal modalProps={p} channel={channel} />);
                        rules.delete(channel.id);
                        showToast({ text: "Auto React is off.", variant: "success", position: "bottom" });
                    }}
                />
            );
        }
    }
});
