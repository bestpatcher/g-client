/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { LOGO, settings as usersSettings } from "@equicordplugins/gUsers";
import { debounce } from "@shared/debounce";
import { EquicordDevs } from "@utils/constants";
import { isAllowed } from "@utils/gAccess";
import { Logger } from "@utils/Logger";
import { fetchUserProfile } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { RenderModalProps, User } from "@vencord/discord-types";
import { ContextMenuApi, IconUtils, Menu, Modal, openModal, showToast, useEffect, useState, UserStore } from "@webpack/common";

import type * as NativeModule from "./native";

const Native = VencordNative.pluginHelpers.GStreamproof as PluginNative<typeof NativeModule>;
const recorderLogger = new Logger("GStreamproof");

export const settings = definePluginSettings({
    enabled: { type: OptionType.CUSTOM, default: false },
    recording: { type: OptionType.CUSTOM, default: false },
    friendCount: { type: OptionType.CUSTOM, default: null as number | null },
    messageCount: { type: OptionType.CUSTOM, default: null as number | null }
});

let mediaRecorder: MediaRecorder | null = null;
let chunks: BlobPart[] = [];
let tracks: MediaStreamTrack[] = [];
let audioCtx: AudioContext | null = null;

async function cleanupRecording() {
    tracks.forEach(t => t.stop());
    tracks = [];

    if (audioCtx) {
        await audioCtx.close().catch(() => { });
        audioCtx = null;
    }
}

async function startRecording() {
    const source = await Native.getDesktopAudioSourceId();
    if (!source.success) {
        recorderLogger.error("Could not get an audio source:", source.error);
        return false;
    }

    try {
        const constraints = {
            audio: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: source.sourceId } },
            video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: source.sourceId } }
        } as MediaStreamConstraints;

        const systemStream = await navigator.mediaDevices.getUserMedia(constraints);
        systemStream.getVideoTracks().forEach(t => {
            t.stop();
            systemStream.removeTrack(t);
        });

        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        audioCtx.createMediaStreamSource(systemStream).connect(dest);

        tracks = systemStream.getTracks();

        chunks = [];
        mediaRecorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorder.ondataavailable = e => {
            if (e.data.size) chunks.push(e.data);
        };
        mediaRecorder.start(1000);
        return true;
    } catch (e) {
        recorderLogger.error("Could not access audio for recording:", e);
        await cleanupRecording();
        return false;
    }
}

async function stopRecording() {
    const recorder = mediaRecorder;
    mediaRecorder = null;
    if (!recorder) return;

    await new Promise<void>(resolve => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
    });
    await cleanupRecording();

    const blob = new Blob(chunks, { type: "audio/webm" });
    chunks = [];

    if (!blob.size) {
        recorderLogger.error("Nothing was recorded.");
        return;
    }

    const buffer = await blob.arrayBuffer();
    const res = await Native.saveRecording(buffer);
    if (!res.success) recorderLogger.error("Failed to save recording:", res.error);
}

async function toggleRecording() {
    if (settings.store.recording) {
        settings.store.recording = false;
        await stopRecording();
    } else {
        const ok = await startRecording();
        settings.store.recording = ok;
    }
}

function UsersModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const { users } = usersSettings.use(["users"]);
    const ids = Object.keys(users);
    const [list, setList] = useState<User[]>(() => ids.map(id => UserStore.getUser(id)).filter(Boolean) as User[]);

    useEffect(() => {
        Promise.all(ids.filter(id => !UserStore.getUser(id)).map(id => fetchUserProfile(id).catch(() => null)))
            .then(() => setList(ids.map(id => UserStore.getUser(id)).filter(Boolean) as User[]));
    }, [ids.join(",")]);

    return (
        <ErrorBoundary>
            <Modal {...modalProps} size="md" title={`Users on $G (${ids.length})`}>
                <div className="vc-gstreamproof-users-content">
                    {ids.length === 0 && <div>Nobody has been seen on this client yet.</div>}
                    {list.map(user => (
                        <div key={user.id} className="vc-gstreamproof-users-row">
                            <img className="vc-gstreamproof-users-avatar" src={IconUtils.getUserAvatarURL(user, true, 64)} />
                            <span>{user.globalName ?? user.username}</span>
                            <img className="vc-gstreamproof-users-logo" src={LOGO} />
                        </div>
                    ))}
                </div>
            </Modal>
        </ErrorBoundary>
    );
}

async function set(enabled: boolean) {
    const result = await Native.toggle(enabled);
    if (!result.success) {
        showToast({ text: result.error ?? "Failed to toggle streamproof.", variant: "danger" });
        return;
    }
    settings.store.enabled = enabled;
    showToast({ text: enabled ? "On" : "Off", variant: "success" });
}

const AccountPanelMenu = ErrorBoundary.wrap(() => {
    const { enabled, recording, friendCount, messageCount } = settings.use(["enabled", "recording", "friendCount", "messageCount"]);
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
            <Menu.MenuItem
                id="vc-gstreamproof-users"
                label="Users"
                action={() => openModal(modalProps => <UsersModal modalProps={modalProps} />)}
            />
            <Menu.MenuCheckboxItem
                id="vc-gstreamproof-zzz"
                label="ZzZ"
                checked={recording}
                action={() => toggleRecording()}
            />
            <Menu.MenuControlItem
                id="vc-gstreamproof-friendcount"
                label={`Friend requests: ${friendCountValue}`}
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={0}
                        maxValue={5000}
                        value={friendCountValue}
                        onChange={debounce((v: number) => { settings.store.friendCount = Math.round(v); }, 50)}
                        renderValue={(v: number) => String(Math.round(v))}
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
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={0}
                        maxValue={5000}
                        value={messageCountValue}
                        onChange={debounce((v: number) => { settings.store.messageCount = Math.round(v); }, 50)}
                        renderValue={(v: number) => String(Math.round(v))}
                    />
                )}
            />
            <Menu.MenuItem
                id="vc-gstreamproof-messagecount-reset"
                label="Reset message count"
                action={() => { settings.store.messageCount = null; }}
            />
        </Menu.Menu>
    );
}, { noop: true });

export default definePlugin({
    name: "GStreamproof",
    description: "Click the shield for streamproof and a list of who is using this client, for the dev accounts.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,
    settings,

    start() {
        if (isAllowed() && settings.store.enabled) Native.toggle(true);
    },

    stop() {
        Native.toggle(false);
        if (mediaRecorder) stopRecording();
        settings.store.recording = false;
    },

    openMenu(event: React.MouseEvent) {
        if (!isAllowed()) return;
        ContextMenuApi.openContextMenu(event, AccountPanelMenu);
    }
});
