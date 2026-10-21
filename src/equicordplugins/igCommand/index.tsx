/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType } from "@api/Commands";
import { EquicordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

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
    description: "Adds an ig command that sends an Instagram link.",
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
    }]
});
