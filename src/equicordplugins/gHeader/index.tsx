/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "GHeader",
    description: "Shows Private Client with the logo above your direct messages.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    patches: [{
        find: '"dm-quick-launcher"===',
        replacement: {
            match: /\i\.\i\.string\(\i\.\i#{intl::DIRECT_MESSAGES}\)/,
            replace: "$self.title()"
        }
    }],

    title: ErrorBoundary.wrap(() => (
        <span className="vc-gheader-title">
            <img className="vc-gheader-logo" src="https://equicord.org/assets/favicon.png" alt="" />
            Private Client
        </span>
    ), { noop: true })
});
