/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "GTheme",
    description: "Red and black settings menu with a different shade of red on every option.",
    authors: [EquicordDevs.nobody],
    required: true
});
