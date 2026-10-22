/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle, styleMap } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Menu, UserStore } from "@webpack/common";

const STYLE = "GMessageColor";

const COLORS = {
    Red: "#ff4d4d",
    Orange: "#ff9500",
    Yellow: "#ffd60a",
    Green: "#30d158",
    Cyan: "#64d2ff",
    Blue: "#0a84ff",
    Purple: "#bf5af2",
    Pink: "#ff6ad5",
    "Baby blue": "#89cff0",
    White: "#ffffff"
};

const settings = definePluginSettings({
    color: { type: OptionType.CUSTOM, default: "" },
    glow: { type: OptionType.CUSTOM, default: false }
});

styleMap.set(STYLE, { name: STYLE, source: "", classNames: {}, dom: null });

function apply() {
    const { color, glow } = settings.store;
    const style = styleMap.get(STYLE)!;

    disableStyle(STYLE);
    if (!color) return;

    style.source = `[data-gown]:not(.messagelogger-deleted) [id^="message-content-"] { text-shadow: ${glow ? `0 0 4px ${color}, 0 0 9px ${color}` : "none"} !important; }
[data-gown]:not(.messagelogger-deleted) [id^="message-content-"], [data-gown]:not(.messagelogger-deleted) [id^="message-content-"] * { color: ${color} !important; }`;
    enableStyle(STYLE);
}

function set(color: string, glow = settings.store.glow) {
    settings.store.color = color;
    settings.store.glow = glow;
    apply();
}

export default definePlugin({
    name: "GMessageColor",
    description: "Lets you pick a color and glow for your own messages.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    start: apply,
    stop: () => disableStyle(STYLE),

    patches: [{
        find: "Message must not be a thread starter message",
        replacement: {
            match: /\)\("li",\{/,
            replace: '$&"data-gown":$self.own(arguments[0].message),'
        }
    }],

    own: (message: Message) => message.author.id === UserStore.getCurrentUser().id || undefined,

    contextMenus: {
        "channel-attach"(children) {
            const { color, glow } = settings.store;

            children.push(
                <Menu.MenuItem id="vc-gcolor" label="Message Color">
                    {Object.entries(COLORS).map(([name, value]) => (
                        <Menu.MenuRadioItem
                            key={name}
                            id={`vc-gcolor-${name}`}
                            group="vc-gcolor"
                            label={<span style={{ color: value }}>{name}</span>}
                            checked={color === value}
                            action={() => set(value)}
                        />
                    ))}
                    <Menu.MenuSeparator />
                    <Menu.MenuCheckboxItem id="vc-gcolor-glow" label="Glow" checked={glow} action={() => set(color, !glow)} />
                    <Menu.MenuItem id="vc-gcolor-off" label="Default color" action={() => set("", false)} />
                </Menu.MenuItem>
            );
        }
    }
});
