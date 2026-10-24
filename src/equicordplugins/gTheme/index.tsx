/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export default definePlugin({
    name: "GTheme",
    description: "Dark settings menu glowing purple mixed with pink for Private Client, white for Developer Build, a different shade on every option.",
    authors: [EquicordDevs.nobody],
    required: true,
    managedStyle: style
});
