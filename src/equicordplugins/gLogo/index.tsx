/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const LOGO = "https://equicord.org/assets/favicon.png";

export default definePlugin({
    name: "GLogo",
    description: "Replaces the Discord logo in the top left with the $G logo.",
    authors: [EquicordDevs.nobody],
    required: true,

    start() {
        document.documentElement.style.setProperty("--vc-glogo-image", `url("${LOGO}")`);
    },

    stop() {
        document.documentElement.style.removeProperty("--vc-glogo-image");
    }
});
