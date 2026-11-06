/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

export default definePlugin({
    name: "GSilentTyping",
    description: "Never shows that you are typing, for the dev accounts.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    // DIAGNOSTIC: off during the same patch-set sweep described in gVoice.
    patches: [],

    startTyping(channelId: string) {
        if (isAllowed()) return;
        FluxDispatcher.dispatch({ type: "TYPING_START_LOCAL", channelId });
    }
});
