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
import { isAllowed } from "@utils/gAccess";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Menu, UserStore } from "@webpack/common";

const MARK = "⁣‌‍⁣";
export const LOGO = "https://equicord.org/assets/favicon.png";
const KEYS: "users"[] = ["users"];
const STATUS_KEYS: "status"[] = ["status"];
const cl = classNameFactory("vc-gusers-");

export const settings = definePluginSettings({
    users: { type: OptionType.CUSTOM, default: {} as Record<string, true> },
    // Own opt-in status, set from the "Client Status" account panel menu.
    // Only "online" broadcasts; nobody is tracked without choosing it themselves.
    status: { type: OptionType.CUSTOM, default: "away" as "online" | "away" }
});

function seen({ author, content }: Message) {
    if (isAllowed() && author && content?.includes(MARK) && !settings.store.users[author.id]) {
        settings.store.users = { ...settings.store.users, [author.id]: true };
    }
}

const Logo = ErrorBoundary.wrap(({ id }: { id: string; }) => {
    const { users } = settings.use(KEYS);
    if (!isAllowed()) return null;
    return users[id] || id === UserStore.getCurrentUser().id ? <img className={cl("logo")} src={LOGO} /> : null;
}, { noop: true });

const ClientStatusMenu = ErrorBoundary.wrap(() => {
    const { status } = settings.use(STATUS_KEYS);

    return (
        <Menu.MenuGroup>
            <Menu.MenuItem id="vc-gusers-client-status" label="Client Status">
                <Menu.MenuRadioItem
                    id="vc-gusers-client-status-online"
                    label="Online"
                    group="vc-gusers-client-status"
                    checked={status === "online"}
                    action={() => settings.store.status = "online"}
                />
                <Menu.MenuRadioItem
                    id="vc-gusers-client-status-away"
                    label="Away"
                    group="vc-gusers-client-status"
                    checked={status === "away"}
                    action={() => settings.store.status = "away"}
                />
            </Menu.MenuItem>
        </Menu.MenuGroup>
    );
}, { noop: true });

export default definePlugin({
    name: "GUsers",
    description: "Shows the logo next to everyone using this client, for the dev accounts, and lets anyone set their own client status.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    onBeforeMessageSend(_, message) {
        if (settings.store.status === "online" && message.content.trim() && !message.content.endsWith("`")) message.content += MARK;
    },

    renderMessageDecoration: ({ message }) => <Logo id={message.author.id} />,
    renderMemberListDecorator: ({ user }) => user ? <Logo id={user.id} /> : null,

    contextMenus: {
        "vc-ap-server-profile"(children) {
            children.push(<ClientStatusMenu />);
        }
    },

    flux: {
        MESSAGE_CREATE({ message }: { message: Message; }) {
            seen(message);
        },
        LOAD_MESSAGES_SUCCESS({ messages }: { messages: Message[]; }) {
            messages.forEach(seen);
        }
    }
});
