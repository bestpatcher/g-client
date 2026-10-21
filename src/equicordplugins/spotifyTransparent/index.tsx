/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "SpotifyTransparent",
    description: "Makes the Spotify player above your name transparent.",
    authors: [EquicordDevs.nobody],
    enabledByDefault: true
});
