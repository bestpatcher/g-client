/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addSurfacePropsProvider } from "@api/SurfaceClasses";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

let removeProvider = () => { };

export default definePlugin({
    name: "GHeader",
    description: "Shows Private Client in red glow instead of Direct Messages.",
    dependencies: ["SurfaceClassesAPI"],
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    patches: [
        {
            find: '"dm-quick-launcher"===',
            replacement: {
                match: /\i\.\i\.string\(\i\.\i#{intl::DIRECT_MESSAGES}\)/,
                replace: "$self.title()"
            }
        },
        {
            find: "#{intl::DIRECT_MESSAGES}",
            all: true,
            noWarn: true,
            replacement: {
                match: /\i\.\i\.(?:string|formatToPlainString)\(\i\.\i#{intl::DIRECT_MESSAGES}\)/g,
                replace: '"Private Client"'
            }
        }
    ],

    start() {
        removeProvider = addSurfacePropsProvider("headerBar", () => ({ "data-gheader": "true" }));
    },

    stop() {
        removeProvider();
    },

    title: ErrorBoundary.wrap(() => <span className="vc-gheader-title">Private Client</span>, { noop: true })
});
