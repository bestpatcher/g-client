/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { addSurfacePropsProvider, notifySurfaceClassesChanged, type SurfaceId } from "@api/SurfaceClasses";
import { addUserAreaButton, removeUserAreaButton, UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import ErrorBoundary from "@components/ErrorBoundary";
import { debounce } from "@shared/debounce";
import { EquicordDevs } from "@utils/constants";
import { checkAccess, isAllowed, useAccess } from "@utils/gAccess";
import GStreamproof from "@equicordplugins/gStreamproof";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { ContextMenuApi, Menu } from "@webpack/common";

import { settings as loadingSettings, stopLoadingStyle } from "@equicordplugins/gLoading";

const SURFACES = ["base", "headerBar", "guildBar"] as const satisfies readonly SurfaceId[];

const settings = definePluginSettings({
    friendCount: { type: OptionType.CUSTOM, default: null as number | null }
});

let removeProviders: Array<() => void> = [];

async function refresh() {
    await checkAccess();
    loadingSettings.store.isDev = isAllowed();
    SURFACES.forEach(notifySurfaceClassesChanged);
}

function ShieldButton({ iconForeground, nameplate }: UserAreaRenderProps) {
    return useAccess() ? <UserAreaButton icon={<div className={classes(iconForeground, "vc-gdev-shield")} />} plated={nameplate != null} onClick={e => GStreamproof.openMenu(e)} /> : null;
}

const FriendCountMenu = ErrorBoundary.wrap(() => {
    const { friendCount } = settings.use(["friendCount"]);
    if (!isAllowed()) return null;
    const value = friendCount ?? 0;

    return (
        <Menu.Menu navId="vc-gdev-friendcount" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuControlItem
                id="vc-gdev-friendcount-slider"
                label={`Friend requests: ${value}`}
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={0}
                        maxValue={5000}
                        value={value}
                        onChange={debounce((v: number) => { settings.store.friendCount = Math.round(v); }, 50)}
                        renderValue={(v: number) => String(Math.round(v))}
                    />
                )}
            />
            <Menu.MenuItem
                id="vc-gdev-friendcount-reset"
                label="Reset to real count"
                action={() => { settings.store.friendCount = null; }}
            />
        </Menu.Menu>
    );
}, { noop: true });

export default definePlugin({
    name: "GDev",
    description: "Shows the shield and Dev Build for the dev accounts.",
    authors: [EquicordDevs.nobody],
    dependencies: ["UserAreaAPI", "SurfaceClassesAPI", "ContextMenuAPI"],
    required: true,
    hidden: true,
    settings,

    patches: [
        {
            find: "getPendingCount(){",
            replacement: {
                match: /(?<=getPendingCount\(\)\{)/,
                replace: "const $gCount=$self.getFriendCountOverride();if($gCount!=null)return $gCount;"
            }
        },
        {
            find: "#{intl::DISCODO_DISABLED}",
            replacement: {
                match: /(?=tutorialId:"friends-list")/,
                replace: "onContextMenu:$self.onFriendsContextMenu,"
            }
        }
    ],

    getFriendCountOverride() {
        return isAllowed() ? settings.store.friendCount : null;
    },

    onFriendsContextMenu(event: React.MouseEvent) {
        if (!isAllowed()) return;
        ContextMenuApi.openContextMenu(event, FriendCountMenu);
    },

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
