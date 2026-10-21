/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { EquicordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { chooseFile } from "@utils/web";
import definePlugin from "@utils/types";
import { DraftType, UploadHandler, UserStore } from "@webpack/common";

const ALLOWED = [
    "d8a7056cef8461b0a4caeeb69f7bc67957d81b6b106bc797850bdefd82c5ea74",
    "69b26ec34e3114f66916832ff3d83160ed9a9e95d131afbad05e0aa29bbec6d4"
];

let allowed = false;

async function check() {
    const id = new TextEncoder().encode(UserStore.getCurrentUser().id);
    const buf = await crypto.subtle.digest("SHA-256", id);
    allowed = ALLOWED.includes([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""));
}

export default definePlugin({
    name: "IgCommand",
    description: "Adds ig and patcher commands for two accounts.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    start: check,
    stop() {
        allowed = false;
    },

    flux: {
        CONNECTION_OPEN: check
    },

    commands: [{
        name: "ig",
        description: "Send my Instagram.",
        inputType: ApplicationCommandInputType.BUILT_IN,
        predicate: () => allowed,
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
        predicate: () => allowed,
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
