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
import { FluxDispatcher, IconUtils, MediaEngineStore, React, SelectedChannelStore, Slider, UserStore, VoiceStateStore, useStateFromStores } from "@webpack/common";

// userId → real audio volume (set in the Call Volume tab)
const realVolumes = new Map<string, number>();
// userId → fake display value shown on Discord's own User Volume slider
const fakeVolumes = new Map<string, number>();

// True only while WE are dispatching, so our own volume changes aren't reverted.
let applying = false;

function getRealVolume(userId: string) {
    return realVolumes.get(userId) ?? MediaEngineStore.getLocalVolume?.(userId) ?? 100;
}

function setRealVolume(userId: string, v: number) {
    realVolumes.set(userId, v);
    applying = true;
    FluxDispatcher.dispatch({ type: "AUDIO_SET_LOCAL_VOLUME", context: "default", userId, volume: v });
    applying = false;
}

function getFakeVolume(userId: string) {
    return fakeVolumes.get(userId) ?? getRealVolume(userId);
}

// Discord's native User Volume slider: keep it draggable and let it show whatever
// value it's dragged to, but never let it touch real audio. We swap its onValueChange
// for one that only records a fake display value.
function patchUserVolumeMenu(children: any[], props: { user?: { id: string; }; }) {
    const userId = props.user?.id;
    if (!userId) return;

    function findAndReplace(arr: any[]): boolean {
        for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if (!c?.props) continue;
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
                Drag a slider to set their real volume (0–200%). The Discord User Volume slider is fake and does not change what you hear.
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
    const [vol, setVol] = React.useState(() => getRealVolume(user.userId));

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
            <img src={user.avatarURL} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{user.name}</div>
                <Slider
                    initialValue={vol}
                    minValue={0}
                    maxValue={200}
                    onValueChange={(v: number) => {
                        setVol(v);
                        setRealVolume(user.userId, Math.round(v));
                    }}
                />
            </div>
            <span style={{ fontSize: 13, opacity: 0.6, flexShrink: 0, width: 40, textAlign: "right" }}>{Math.round(vol)}%</span>
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

    // Backup guard: if Discord's fake slider ever manages to change a user's real volume
    // through its own dispatch path, snap it back to the value set in the Call Volume tab.
    flux: {
        AUDIO_SET_LOCAL_VOLUME(payload: { userId: string; volume: number; }) {
            if (applying) return;
            const real = realVolumes.get(payload.userId);
            if (real === undefined || payload.volume === real) return;
            setTimeout(() => setRealVolume(payload.userId, real), 0);
        }
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
