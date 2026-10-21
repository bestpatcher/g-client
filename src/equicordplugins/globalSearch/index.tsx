/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import { Message, RenderModalProps } from "@vencord/discord-types";
import { ChannelStore, Clickable, GuildStore, Modal, NavigationRouter, openModal, RestAPI, TextInput, useEffect, useState, UserStore } from "@webpack/common";

interface Hit extends Message {
    hit?: boolean;
}

async function search(url: string, content: string, onPage: (hits: Hit[]) => boolean) {
    for (let offset = 0, total = 1; offset < total; offset += 25) {
        try {
            const res = await RestAPI.get({ url, query: { content, include_nsfw: true, offset } });
            if (res.status === 202) {
                await sleep((res.body.retry_after ?? 1) * 1000);
                offset -= 25;
                continue;
            }
            total = res.body.total_results;
            if (onPage(res.body.messages.map((group: Hit[]) => group.find(m => m.hit) ?? group[0]))) return;
        } catch (e) {
            const { status, body } = e as { status?: number; body?: { retry_after?: number; }; };
            if (status !== 429) return;
            await sleep((body?.retry_after ?? 1) * 1000);
            offset -= 25;
        }
        await sleep(300);
    }
}

function where(m: Hit) {
    const channel = ChannelStore.getChannel(m.channel_id);
    const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id)?.name : null;
    const name = channel?.name || channel?.recipients?.map(id => UserStore.getUser(id)?.username).join(", ");
    return guild ? `${guild} #${name}` : name || "Direct message";
}

function Results({ modalProps, query }: { modalProps: RenderModalProps; query: string; }) {
    const [hits, setHits] = useState<Hit[]>([]);
    const [progress, setProgress] = useState("Searching...");

    useEffect(() => {
        let stopped = false;
        const targets = [
            ...ChannelStore.getSortedPrivateChannels().map(c => `/channels/${c.id}/messages/search`),
            ...GuildStore.getGuildIds().map(id => `/guilds/${id}/messages/search`)
        ];

        (async () => {
            for (const [i, url] of targets.entries()) {
                if (stopped) return;
                setProgress(`Searching ${i + 1} of ${targets.length}...`);
                await search(url, query, found => {
                    if (!stopped) setHits(prev => [...prev, ...found]);
                    return stopped;
                });
            }
            setProgress("Done.");
        })();

        return () => { stopped = true; };
    }, []);

    return (
        <Modal {...modalProps} size="lg" title={`Results for "${query}"`} subtitle={`${hits.length} found. ${progress}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
                {hits.map(m => (
                    <Clickable
                        key={m.id}
                        onClick={() => {
                            const { guild_id } = ChannelStore.getChannel(m.channel_id) ?? {};
                            modalProps.onClose();
                            NavigationRouter.transitionTo(`/channels/${guild_id ?? "@me"}/${m.channel_id}/${m.id}`);
                        }}
                        style={{ padding: 8, borderRadius: 6, background: "var(--background-secondary)" }}
                    >
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{m.author.username} in {where(m)}</div>
                        <div>{m.content.slice(0, 200)}</div>
                    </Clickable>
                ))}
            </div>
        </Modal>
    );
}

function SearchBar() {
    const [value, setValue] = useState("");

    return (
        <div
            style={{ padding: "8px 8px 0" }}
            onKeyDown={e => {
                if (e.key !== "Enter" || !value.trim()) return;
                openModal(p => <Results modalProps={p} query={value.trim()} />);
            }}
        >
            <TextInput value={value} onChange={setValue} placeholder="Search all messages" />
        </div>
    );
}

export default definePlugin({
    name: "GlobalSearch",
    description: "Adds a search bar to the direct messages list that searches your messages everywhere.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    patches: [{
        find: '"dm-quick-launcher"===',
        replacement: {
            match: /#{intl::DIRECT_MESSAGES}\)\}\),/,
            replace: "$&$self.renderSearch(),"
        }
    }],

    renderSearch: ErrorBoundary.wrap(SearchBar, { noop: true })
});
