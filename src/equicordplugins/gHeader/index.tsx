/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addSurfacePropsProvider } from "@api/SurfaceClasses";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { getIntlMessage } from "@utils/discord";
import { useAccess, useLicense } from "@utils/gAccess";
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
        }
    ],

    start() {
        removeProvider = addSurfacePropsProvider("headerBar", () => ({ "data-gheader": "true" }));
    },

    stop() {
        removeProvider();
    },

    title: ErrorBoundary.wrap(() => {
        const dev = useAccess();
        const licensed = useLicense();
        if (!licensed) return <span>{getIntlMessage("DIRECT_MESSAGES")}</span>;
        return <span className={dev ? "vc-gheader-title vc-gheader-dev" : "vc-gheader-title"}>{dev ? "Dev Build" : "Private Client"}</span>;
    }, { noop: true })
});
