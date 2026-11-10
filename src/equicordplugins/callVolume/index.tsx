/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import SettingsPlugin from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import { Margins } from "@utils/margins";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { ContextMenuApi, IconUtils, MediaEngineStore, Menu, React, SelectedChannelStore, Slider, UserStore, VoiceStateStore, useStateFromStores } from "@webpack/common";

// userId → real audio volume (what Call Volume tab controls)
const realVolumes = new Map<string, number>();
// userId → fake display volume (what Discord's own slider shows)
const fakeVolumes = new Map<string, number>();

function getRealVolume(userId: string) {
    return realVolumes.get(userId) ?? MediaEngineStore.getLocalVolume?.(userId) ?? 100;
}
function setRealVolume(userId: string, v: number) {
    realVolumes.set(userId, v);
    MediaEngineStore.setLocalVolume?.(userId, v);
}
function getFakeVolume(userId: string) {
    return fakeVolumes.get(userId) ?? 100;
}

function patchUserVolumeMenu(children: any[], props: { user?: { id: string; }; }) {
    const userId = props.user?.id;
    if (!userId) return;

    function findAndReplace(arr: any[]): boolean {
        for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if (!c?.props) continue;
            // Found the user-volume slider
            if (c.props.id === "user-volume" || (typeof c.props.label === "string" && c.props.label.includes("Volume") && c.props.control)) {
                const origControl = c.props.control;
                arr[i] = React.cloneElement(c, {
                    control: (controlProps: any, ref: any) => {
                        const el = origControl(controlProps, ref);
                        if (!el) return el;
                        return React.cloneElement(el, {
                            initialValue: getFakeVolume(userId),
                            onValueChange: (v: number) => { fakeVolumes.set(userId, Math.round(v)); },
                        });
                    }
                });
                return true;
            }
            // Recurse into group children
            const gc = c.props.children;
            if (Array.isArray(gc) && findAndReplace(gc)) return true;
        }
        return false;
    }

    findAndReplace(children);
}

function MicIcon(props: { width?: number; height?: number; }) {
    return (
        <svg width={props.width ?? 16} height={props.height ?? 16} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z" />
        </svg>
    );
}

interface VoiceUser {
    userId: string;
    name: string;
    avatarURL: string;
}

function VolumeContextMenu({ userId, onClose }: { userId: string; onClose: () => void; }) {
    const [vol, setVol] = React.useState(() => getRealVolume(userId));

    return (
        <Menu.Menu navId={`cv-vol-${userId}`} onClose={onClose}>
            <Menu.MenuControlItem
                id="cv-volume-slider"
                label={`Volume: ${Math.round(vol)}%`}
                control={(controlProps: any, ref: any) => (
                    <Slider
                        {...controlProps}
                        ref={ref}
                        initialValue={vol}
                        minValue={0}
                        maxValue={200}
                        onValueChange={(v: number) => {
                            setVol(v);
                            setRealVolume(userId, Math.round(v));
                        }}
                    />
                )}
            />
        </Menu.Menu>
    );
}

function CallVolumeTab() {
    const me = UserStore.getCurrentUser()?.id ?? "";
    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId() ?? "");
    const others = useStateFromStores([VoiceStateStore, SelectedChannelStore], () => {
        const cid = SelectedChannelStore.getVoiceChannelId();
        if (!cid) return [] as VoiceUser[];
        const states = VoiceStateStore.getVoiceStatesForChannel(cid);
        if (!states) return [] as VoiceUser[];
        return Object.values(states)
            .filter((vs: any) => vs.userId !== me)
            .map((vs: any) => {
                const user = UserStore.getUser(vs.userId);
                return {
                    userId: vs.userId,
                    name: user?.globalName ?? user?.username ?? vs.userId,
                    avatarURL: user ? IconUtils.getUserAvatarURL(user, false, 32) : IconUtils.getDefaultAvatarURL(vs.userId),
                };
            });
    }, [me]);

    if (!channelId) {
        return (
            <SettingsTab title="Call Volume">
                <Paragraph className={Margins.bottom16}>You are not in a voice call.</Paragraph>
            </SettingsTab>
        );
    }

    if (!others.length) {
        return (
            <SettingsTab title="Call Volume">
                <Paragraph className={Margins.bottom16}>Nobody else is in the call.</Paragraph>
            </SettingsTab>
        );
    }

    return (
        <SettingsTab title="Call Volume">
            <Paragraph className={Margins.bottom16}>
                Right-click a person to adjust their real volume (0–200%).
            </Paragraph>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {others.map(u => (
                    <CallVolumeRow key={u.userId} user={u} />
                ))}
            </div>
        </SettingsTab>
    );
}

function CallVolumeRow({ user }: { user: VoiceUser; }) {
    const vol = getRealVolume(user.userId);

    function openVolumeMenu(e: React.MouseEvent) {
        ContextMenuApi.openContextMenu(e, () => (
            <VolumeContextMenu userId={user.userId} onClose={ContextMenuApi.closeContextMenu} />
        ));
    }

    return (
        <div
            onContextMenu={openVolumeMenu}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 6,
                cursor: "context-menu",
                userSelect: "none",
                background: "var(--background-secondary)",
            }}
        >
            <img
                src={user.avatarURL}
                alt=""
                style={{ width: 32, height: 32, borderRadius: "50%" }}
            />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{user.name}</span>
            <span style={{ fontSize: 13, opacity: 0.6 }}>{Math.round(vol)}%</span>
        </div>
    );
}

export default definePlugin({
    name: "CallVolume",
    description: "Adds a Call Volume tab to set real audio levels. The Discord User Volume slider becomes a fake display-only spoof.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "user-context": patchUserVolumeMenu,
        "gdm-context": patchUserVolumeMenu,
        "group-dm-context": patchUserVolumeMenu,
    },

    start() {
        if (!isAllowed()) return;
        SettingsPlugin.customEntries.push({
            key: "equicord_call_volume",
            title: "Call Volume",
            Component: wrapTab(CallVolumeTab, "CallVolume"),
            Icon: MicIcon,
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, (e: any) => e.key === "equicord_call_volume");
        realVolumes.clear();
        fakeVolumes.clear();
    }
});
