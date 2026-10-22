/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addSurfacePropsProvider, notifySurfaceClassesChanged, type SurfaceId } from "@api/SurfaceClasses";
import { addUserAreaButton, removeUserAreaButton, UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { EquicordDevs } from "@utils/constants";
import { checkAccess, isAllowed, useAccess } from "@utils/gAccess";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";

import { settings as loadingSettings, stopLoadingStyle } from "@equicordplugins/gLoading";

const SURFACES = ["base", "headerBar", "guildBar"] as const satisfies readonly SurfaceId[];

let removeProviders: Array<() => void> = [];

async function refresh() {
    await checkAccess();
    loadingSettings.store.isDev = isAllowed();
    SURFACES.forEach(notifySurfaceClassesChanged);
}

function ShieldButton({ iconForeground, nameplate }: UserAreaRenderProps) {
    return useAccess() ? <UserAreaButton icon={<div className={classes(iconForeground, "vc-gdev-shield")} />} plated={nameplate != null} /> : null;
}

export default definePlugin({
    name: "GDev",
    description: "Shows the shield and Dev Build for the dev accounts.",
    authors: [EquicordDevs.nobody],
    dependencies: ["UserAreaAPI", "SurfaceClassesAPI"],
    required: true,
    hidden: true,

    flux: {
        CONNECTION_OPEN() {
            stopLoadingStyle();
            return refresh();
        }
    },

    start() {
        removeProviders = SURFACES.map(id => addSurfacePropsProvider(id, () => isAllowed() ? { "data-gdev": "true" } : undefined));
        addUserAreaButton("g-shield", props => <ShieldButton {...props} />, 80);
        refresh();
    },

    stop() {
        removeProviders.forEach(remove => remove());
        removeUserAreaButton("g-shield");
    }
});
