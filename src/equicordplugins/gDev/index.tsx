/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addSurfacePropsProvider, notifySurfaceClassesChanged, type SurfaceId } from "@api/SurfaceClasses";
import { addUserAreaButton, removeUserAreaButton, UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import GStreamproof, { settings as streamproofSettings } from "@equicordplugins/gStreamproof";
import { EquicordDevs } from "@utils/constants";
import { checkAccess, isAllowed, useAccess } from "@utils/gAccess";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";
import { FriendsStore } from "@webpack/common";

import { settings as loadingSettings, stopLoadingStyle } from "@equicordplugins/gLoading";

const SURFACES = ["base", "headerBar", "guildBar"] as const satisfies readonly SurfaceId[];
// Discord API calls RelationshipType.INCOMING_REQUEST this; it's the "Received" group in the friends list.
const INCOMING_REQUEST = 3;

function sanitizeCount(value: number | null) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5000 ? value : null;
}

let removeProviders: Array<() => void> = [];
let realGetState: typeof FriendsStore.getState | null = null;
const wrappedRows = new WeakSet<object>();

// The friends list's "Received" header reads FriendsStore.getState().rows.getRelationshipCounts(),
// not a method on FriendsStore itself, and rows is a fresh object each time relationships change.
// So we wrap getState and, lazily, whatever rows object it hands back.
function applyRelationshipCountsOverride() {
    if (realGetState || typeof FriendsStore?.getState !== "function") return;
    realGetState = FriendsStore.getState.bind(FriendsStore);
    FriendsStore.getState = () => {
        const state = realGetState!();
        const rows = state?.rows;
        if (rows && typeof rows.getRelationshipCounts === "function" && !wrappedRows.has(rows)) {
            const realRowCounts = rows.getRelationshipCounts.bind(rows);
            rows.getRelationshipCounts = () => {
                const real = realRowCounts();
                const override = isAllowed() ? sanitizeCount(streamproofSettings.store.friendCount) : null;
                return override == null ? real : { ...real, [INCOMING_REQUEST]: override };
            };
            wrappedRows.add(rows);
        }
        return state;
    };
}

function removeRelationshipCountsOverride() {
    if (realGetState && FriendsStore) FriendsStore.getState = realGetState;
    realGetState = null;
}

async function refresh() {
    await checkAccess();
    loadingSettings.store.isDev = isAllowed();
    SURFACES.forEach(notifySurfaceClassesChanged);
}

function ShieldButton({ iconForeground, nameplate }: UserAreaRenderProps) {
    return useAccess() ? <UserAreaButton icon={<div className={classes(iconForeground, "vc-gdev-shield")} />} plated={nameplate != null} onClick={e => GStreamproof.openMenu(e)} /> : null;
}

export default definePlugin({
    name: "GDev",
    description: "Shows the shield and Developer Build for the dev accounts.",
    authors: [EquicordDevs.nobody],
    dependencies: ["UserAreaAPI", "SurfaceClassesAPI"],
    required: true,
    hidden: true,

    patches: [
        {
            find: "getPendingCount(){",
            replacement: {
                match: /(?<=getPendingCount\(\)\{)/,
                replace: "const $gCount=$self.getFriendCountOverride();if($gCount!=null)return $gCount;"
            }
        }
    ],

    getFriendCountOverride() {
        return isAllowed() ? sanitizeCount(streamproofSettings.store.friendCount) : null;
    },

    flux: {
        CONNECTION_OPEN() {
            stopLoadingStyle();
            applyRelationshipCountsOverride();
            return refresh();
        }
    },

    start() {
        removeProviders = SURFACES.map(id => addSurfacePropsProvider(id, () => isAllowed() ? { "data-gdev": "true" } : undefined));
        addUserAreaButton("g-shield", props => <ShieldButton {...props} />, 80);
        applyRelationshipCountsOverride();
        refresh();
    },

    stop() {
        removeProviders.forEach(remove => remove());
        removeUserAreaButton("g-shield");
        removeRelationshipCountsOverride();
    }
});
