/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, Message, RenderModalProps } from "@vencord/discord-types";
import { Constants, EmojiStore, Menu, MessageStore, Modal, openModal, RestAPI, SearchableSelect, showToast, TextInput, useState, UserStore } from "@webpack/common";

interface Reaction {
    emoji: string;
    burst: boolean;
}

interface Rule extends Reaction {
    userIds: string[];
}

const EVERYWHERE = "everywhere";

const settings = definePluginSettings({
    everywhere: {
        type: OptionType.CUSTOM,
        default: null as Reaction | null
    }
});

interface RestError {
    status?: number;
    body?: { retry_after?: number; };
}

const rules = new Map<string, Rule>();

async function react(channelId: string, messageId: string, { emoji, burst }: Reaction) {
    const variants = emoji.includes(":") ? [emoji] : [emoji, emoji.includes("\uFE0F") ? emoji.replaceAll("\uFE0F", "") : emoji + "\uFE0F"];

    for (const [i, variant] of variants.entries()) {
        while (true) {
            try {
                return await RestAPI.put({
                    url: Constants.Endpoints.REACTION(channelId, messageId, variant, "@me"),
                    query: burst ? { type: 1 } : undefined
                });
            } catch (e) {
                const { status, body } = e as RestError;
                if (status === 429) await sleep((body?.retry_after ?? 1) * 1000);
                else if (i === variants.length - 1) throw e;
                else break;
            }
        }
    }
}

function parseEmoji(input: string) {
    const text = input.trim();
    const custom = text.match(/^<a?:(\w+):(\d+)>$/);
    if (custom) return `${custom[1]}:${custom[2]}`;

    const name = text.replace(/^:|:$/g, "").toLowerCase();
    const found = Object.values(EmojiStore.getGuilds()).flatMap(g => g._emojis).find(e => e.name.toLowerCase() === name);
    if (found) return `${found.name}:${found.id}`;

    return EmojiStore.getByName(name)?.surrogates ?? text;
}

function AutoReactModal({ modalProps, channel }: { modalProps: RenderModalProps; channel: Channel; }) {
    const meId = UserStore.getCurrentUser().id;
    const [emoji, setEmoji] = useState("");
    const [type, setType] = useState("normal");
    const [userIds, setUserIds] = useState<string[]>([EVERYWHERE]);

    const ids = new Set([...(channel.recipients ?? []), ...MessageStore.getMessages(channel.id).toArray().map((m: Message) => m.author.id)]);
    ids.delete(meId);
    const people = [
        { label: "Me, in every chat and server", value: EVERYWHERE },
        ...[...ids].map(id => ({ label: UserStore.getUser(id)?.username ?? id, value: id }))
    ];

    const start = () => {
        if (!emoji.trim()) return showToast({ text: "Type or paste an emoji first.", variant: "critical", position: "bottom" });
        if (!userIds.length) return showToast({ text: "Pick at least one person.", variant: "critical", position: "bottom" });
        const reaction = { emoji: parseEmoji(emoji), burst: type === "super" };
        const others = userIds.filter(id => id !== EVERYWHERE);
        if (userIds.includes(EVERYWHERE)) settings.store.everywhere = reaction;
        if (others.length) rules.set(channel.id, { ...reaction, userIds: others });
        showToast({ text: "Auto React is on.", variant: "success", position: "bottom" });
        modalProps.onClose();
    };

    return (
        <Modal {...modalProps} size="md" title="Auto React" actions={[{ text: "Start", variant: "primary", onClick: start }]}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
                <TextInput value={emoji} onChange={setEmoji} placeholder="Type an emoji, or a custom one like :name:" />
                <SearchableSelect
                    options={[{ label: "Normal reaction", value: "normal" }, { label: "Super reaction", value: "super" }]}
                    value={type}
                    onChange={setType}
                />
                <SearchableSelect options={people} value={userIds} onChange={setUserIds} multi closeOnSelect={false} placeholder="Pick people" />
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

    settings,

    stop() {
        rules.clear();
    },

    flux: {
        MESSAGE_CREATE({ message, channelId, optimistic }: { message: Message; channelId: string; optimistic?: boolean; }) {
            const authorId = message.author?.id;
            const rule = rules.get(channelId);
            const reaction = rule?.userIds.includes(authorId) ? rule : authorId === UserStore.getCurrentUser().id ? settings.store.everywhere : null;
            if (optimistic || !reaction) return;
            return react(channelId, message.id, reaction);
        }
    },

    contextMenus: {
        "channel-attach"(children, { channel }: { channel: Channel; }) {
            children.push(
                <Menu.MenuItem
                    id="vc-auto-react"
                    label="Auto React"
                    action={() => openModal(p => <AutoReactModal modalProps={p} channel={channel} />)}
                />
            );
            if (rules.has(channel.id)) {
                children.push(<Menu.MenuItem id="vc-auto-react-stop" label="Stop Auto React in this chat" action={() => rules.delete(channel.id)} />);
            }
            if (settings.store.everywhere) {
                children.push(<Menu.MenuItem id="vc-auto-react-stop-all" label="Stop Auto React everywhere" action={() => { settings.store.everywhere = null; }} />);
            }
        }
    }
});
