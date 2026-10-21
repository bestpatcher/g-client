/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import { EquicordDevs } from "@utils/constants";
import { sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import { Message, RenderModalProps } from "@vencord/discord-types";
import "./style.css";
import { ChannelStore, Clickable, GuildStore, Modal, NavigationRouter, openModal, RestAPI, TextInput, useEffect, useState, UserStore } from "@webpack/common";

const cl = classNameFactory("vc-globalsearch-");

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

function Results({ modalProps }: { modalProps: RenderModalProps; }) {
    const [text, setText] = useState("");
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState<Hit[]>([]);
    const [progress, setProgress] = useState("Type something and press Enter.");

    useEffect(() => {
        if (!query) return;
        let stopped = false;
        setHits([]);
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
    }, [query]);

    return (
        <Modal {...modalProps} size="lg" title="Search all messages">
            <div className={cl("body")}>
                <div onKeyDown={e => e.key === "Enter" && setQuery(text.trim())}>
                    <TextInput value={text} onChange={setText} placeholder="Search every chat and server" autoFocus />
                </div>
                <div className={cl("status")}>{hits.length} found. {progress}</div>
                {hits.map(m => (
                    <Clickable
                        key={m.id}
                        className={cl("hit")}
                        onClick={() => {
                            const { guild_id } = ChannelStore.getChannel(m.channel_id) ?? {};
                            modalProps.onClose();
                            NavigationRouter.transitionTo(`/channels/${guild_id ?? "@me"}/${m.channel_id}/${m.id}`);
                        }}
                    >
                        <div className={cl("where")}>{m.author?.username} in {where(m)}</div>
                        <div>{m.content.slice(0, 200)}</div>
                    </Clickable>
                ))}
            </div>
        </Modal>
    );
}

function SearchItem() {
    return (
        <Clickable className={cl("item")} onClick={() => openModal(p => <Results modalProps={p} />)}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path fill="currentColor" d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z" />
            </svg>
            <span>Search</span>
        </Clickable>
    );
}

export default definePlugin({
    name: "GlobalSearch",
    description: "Adds a search bar to the direct messages list that searches your messages everywhere.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    patches: [{
        find: 'tutorialId:"direct-messages"',
        replacement: {
            match: /(?<="family-center"\)(?:&&undefined)?:null,)/,
            replace: "$self.renderSearch(),"
        }
    }],

    renderSearch: ErrorBoundary.wrap(SearchItem, { noop: true })
});
