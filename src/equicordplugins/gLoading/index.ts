/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";

import logoStyle from "./loadingLogo.css?managed";
import shieldStyle from "./loadingShield.css?managed";

export const settings = definePluginSettings({
    isDev: {
        type: OptionType.CUSTOM,
        default: false
    }
});

export function stopLoadingStyle() {
    disableStyle(logoStyle);
    disableStyle(shieldStyle);
}

export default definePlugin({
    name: "GLoading",
    description: "Shows the logo and a custom message on the loading screen.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    startAt: StartAt.Init,
    settings,

    patches: [
        {
            find: "#{intl::LOADING_DID_YOU_KNOW}",
            replacement: [
                {
                    match: /_loadingText.+?(?=(\i)\[.{0,10}\.random)/,
                    replace: "$&$self.setText($1),"
                },
                {
                    match: /_eventLoadingText.+?(?=(\i)\[.{0,10}\.random)/,
                    replace: "$&$self.setText($1),"
                },
                {
                    match: /\i\.\i\.(?:string|formatToPlainString)\(\i\.\i#{intl::LOADING_DID_YOU_KNOW}\)/,
                    replace: '""',
                    noWarn: true
                }
            ]
        }
    ],

    setText(quotes: string[]) {
        quotes.length = 0;
        quotes.push(settings.store.isDev ? "Developer Build , $GMT" : "$G Private Client");
    },

    start() {
        enableStyle(settings.store.isDev ? shieldStyle : logoStyle);
    },

    stop: stopLoadingStyle
});
