/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { UserStore } from "@webpack/common";

const MARK = "⁣‌‍⁣";
const LOGO = "https://equicord.org/assets/favicon.png";
const KEYS: "users"[] = ["users"];
const cl = classNameFactory("vc-gusers-");

const settings = definePluginSettings({
    users: { type: OptionType.CUSTOM, default: {} as Record<string, true> }
});

function seen({ author, content }: Message) {
    if (author && content?.includes(MARK) && !settings.store.users[author.id]) {
        settings.store.users = { ...settings.store.users, [author.id]: true };
    }
}

const Logo = ErrorBoundary.wrap(({ id }: { id: string; }) => {
    const { users } = settings.use(KEYS);
    return users[id] || id === UserStore.getCurrentUser().id ? <img className={cl("logo")} src={LOGO} /> : null;
}, { noop: true });

export default definePlugin({
    name: "GUsers",
    description: "Shows the logo next to everyone using this client.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    renderMessageDecoration: ({ message }) => <Logo id={message.author.id} />,
    renderMemberListDecorator: ({ user }) => user ? <Logo id={user.id} /> : null,

    flux: {
        MESSAGE_CREATE({ message }: { message: Message; }) {
            seen(message);
        },
        LOAD_MESSAGES_SUCCESS({ messages }: { messages: Message[]; }) {
            messages.forEach(seen);
        }
    }
});
