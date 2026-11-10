/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import GCustomProfile from "@equicordplugins/gCustomProfile";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import definePlugin, { OptionType } from "@utils/types";
import { ContextMenuApi, FriendsStore, MediaEngineStore, Menu, MessageRequestStore, RelationshipStore, SelectedChannelStore, showToast, Slider, TextInput, useStateFromStores, UserStore, VoiceStateStore } from "@webpack/common";

import type * as NativeModule from "./native";

const Native = VencordNative.pluginHelpers.GStreamproof as PluginNative<typeof NativeModule>;

export const settings = definePluginSettings({
    enabled: { type: OptionType.CUSTOM, default: false },
    nvidiaProof: { type: OptionType.CUSTOM, default: false },
    // The real count still lives in RelationshipStore/FriendsStore; this only overrides what
    // they report. emitChange() nudges anything already subscribed to those stores (like the
    // friends list header, which only recomputes on an actual store change) to re-read it now.
    friendCount: {
        type: OptionType.CUSTOM, default: null as number | null,
        onChange: () => { RelationshipStore.emitChange(); FriendsStore.emitChange(); }
    },
    messageCount: {
        type: OptionType.CUSTOM, default: null as number | null,
        onChange: () => MessageRequestStore.emitChange()
    }
});

function parseCount(value: string) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(5000, Math.max(0, n)) : null;
}

async function set(enabled: boolean) {
    const result = await Native.toggle(enabled);
    if (!result.success) {
        showToast({ text: result.error ?? "Failed to toggle streamproof.", variant: "danger" });
        return;
    }
    settings.store.enabled = enabled;
    showToast({ text: enabled ? "Streamproof on, hidden from screen shares and recordings." : "Streamproof off.", variant: "success" });
}

async function setNvidiaProof(enabled: boolean) {
    const result = await Native.toggleNvidiaProof(enabled);
    if (!result.success) {
        showToast({ text: result.error ?? "Failed to toggle Nvidia Proof.", variant: "danger" });
        return;
    }
    settings.store.nvidiaProof = enabled;
    showToast({ text: enabled ? "Nvidia Proof on, hidden from ShadowPlay and Instant Replay." : "Nvidia Proof off.", variant: "success" });
}

function VolumeSection() {
    const me = UserStore.getCurrentUser()?.id;
    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId());
    const voiceStates = useStateFromStores([VoiceStateStore], () =>
        channelId ? Object.values(VoiceStateStore.getVoiceStatesForChannel(channelId) ?? {}) : []
    );

    const others = voiceStates.filter((vs: any) => vs.userId !== me);
    if (!others.length) return null;

    return (
        <>
            <Menu.MenuSeparator />
            {others.map((vs: any) => {
                const user = UserStore.getUser(vs.userId);
                const name = user?.globalName ?? user?.username ?? vs.userId;
                const currentVol = MediaEngineStore.getLocalVolume(vs.userId) ?? 100;
                return (
                    <Menu.MenuControlItem
                        key={vs.userId}
                        id={`fvs-vol-${vs.userId}`}
                        label={`${name}: ${Math.round(currentVol)}%`}
                        control={(controlProps: any, ref: any) => (
                            <Slider
                                {...controlProps}
                                ref={ref}
                                initialValue={currentVol}
                                minValue={0}
                                maxValue={200}
                                onValueChange={(v: number) => {
                                    MediaEngineStore.setLocalVolume(vs.userId, Math.round(v));
                                }}
                            />
                        )}
                    />
                );
            })}
        </>
    );
}

const ShieldMenu = ErrorBoundary.wrap(() => {
    const { enabled, nvidiaProof, friendCount, messageCount } = settings.use(["enabled", "nvidiaProof", "friendCount", "messageCount"]);
    if (!isAllowed()) return null;
    const friendCountValue = friendCount ?? 0;
    const messageCountValue = messageCount ?? 0;

    return (
        <Menu.Menu navId="vc-gstreamproof" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuCheckboxItem
                id="vc-gstreamproof-toggle"
                label="Developer Streamproof"
                checked={enabled}
                action={() => set(!enabled)}
            />
            <Menu.MenuCheckboxItem
                id="vc-gstreamproof-nvidia"
                label="Nvidia Proof"
                checked={nvidiaProof}
                action={() => setNvidiaProof(!nvidiaProof)}
            />
            <Menu.MenuControlItem
                id="vc-gstreamproof-friendcount"
                label={`Friend requests: ${friendCountValue}`}
                control={() => (
                    <TextInput
                        value={String(friendCountValue)}
                        onChange={v => { settings.store.friendCount = parseCount(v); }}
                        placeholder="0-5000"
                    />
                )}
            />
            <Menu.MenuItem
                id="vc-gstreamproof-friendcount-reset"
                label="Reset friend count"
                action={() => { settings.store.friendCount = null; }}
            />
            <Menu.MenuControlItem
                id="vc-gstreamproof-messagecount"
                label={`Message requests: ${messageCountValue}`}
                control={() => (
                    <TextInput
                        value={String(messageCountValue)}
                        onChange={v => { settings.store.messageCount = parseCount(v); }}
                        placeholder="0-5000"
                    />
                )}
            />
            <Menu.MenuItem
                id="vc-gstreamproof-messagecount-reset"
                label="Reset message count"
                action={() => { settings.store.messageCount = null; }}
            />
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="vc-gstreamproof-custom-profile"
                label="Custom Profile"
                action={() => GCustomProfile.openModal()}
            />
            <VolumeSection />
        </Menu.Menu>
    );
}, { noop: true });

export default definePlugin({
    name: "GStreamproof",
    description: "Click the shield to hide Discord from screen shares and recordings while still seeing it yourself, and to fake the friend request count.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    start() {
        if (isAllowed() && settings.store.enabled) Native.toggle(true);
    },

    stop() {
        Native.toggle(false);
    },

    openMenu(event: React.MouseEvent) {
        if (!isAllowed()) return;
        ContextMenuApi.openContextMenu(event, ShieldMenu);
    }
});
