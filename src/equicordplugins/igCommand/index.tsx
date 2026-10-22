/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { Settings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { checkAccess, isAllowed, resetAccess } from "@utils/gAccess";
import { relaunch } from "@utils/native";
import { chooseFile } from "@utils/web";
import definePlugin from "@utils/types";
import { DraftType, UploadHandler } from "@webpack/common";

const PLUGINS = ["MessageLogger", "MessageLoggerEnhanced", "PinDMs"];

async function check() {
    await checkAccess();
    if (!isAllowed() || PLUGINS.every(name => Settings.plugins[name].enabled)) return;

    PLUGINS.forEach(name => Settings.plugins[name].enabled = true);
    relaunch();
}

export default definePlugin({
    name: "IgCommand",
    description: "Adds ig and patcher commands and the message logger for two accounts.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    start: check,
    stop: resetAccess,

    flux: {
        CONNECTION_OPEN: check
    },

    commands: [{
        name: "ig",
        description: "Send my Instagram.",
        inputType: ApplicationCommandInputType.BUILT_IN,
        predicate: isAllowed,
        execute(_, { channel }) {
            sendMessage(channel.id, { content: "https://www.instagram.com/turntasl" });
        }
    }, {
        name: "patcher",
        description: "Send the patcher file.",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [{
            name: "replace",
            description: "Pick the file again.",
            type: ApplicationCommandOptionType.BOOLEAN
        }],
        predicate: isAllowed,
        async execute(args, { channel }) {
            let file = findOption<boolean>(args, "replace") ? null : await DataStore.get<File>("IgCommand_patcher");
            if (!file) {
                file = await chooseFile(".exe");
                if (!file) return;
                await DataStore.set("IgCommand_patcher", file);
            }
            UploadHandler.promptToUpload([file], channel, DraftType.ChannelMessage);
        }
    }]
});
