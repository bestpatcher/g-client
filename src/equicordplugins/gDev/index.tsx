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
import GStreamproof from "@equicordplugins/gStreamproof";
import { classes } from "@utils/misc";
import definePlugin, { PluginNative } from "@utils/types";
import { MediaEngineStore, showToast, useState } from "@webpack/common";

import { settings as loadingSettings, stopLoadingStyle } from "@equicordplugins/gLoading";

const SURFACES = ["base", "headerBar", "guildBar"] as const satisfies readonly SurfaceId[];
const Native = VencordNative.pluginHelpers.GDev as PluginNative<typeof import("./native")>;

let removeProviders: Array<() => void> = [];

async function refresh() {
    await checkAccess();
    loadingSettings.store.isDev = isAllowed();
    SURFACES.forEach(notifySurfaceClassesChanged);
}

function ShieldButton({ iconForeground, nameplate }: UserAreaRenderProps) {
    return useAccess() ? <UserAreaButton icon={<div className={classes(iconForeground, "vc-gdev-shield")} />} plated={nameplate != null} onClick={e => GStreamproof.openMenu(e)} /> : null;
}

interface ZzzIconProps {
    color?: string;
    width?: number;
    height?: number;
}

function ZzzIcon({ color = "currentColor", width = 20, height = 20 }: ZzzIconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" role="img">
            <text x="1" y="9" fontSize="9" fontWeight="700" fill={color}>Z</text>
            <text x="8" y="15" fontSize="7" fontWeight="700" fill={color}>z</text>
            <text x="13.5" y="20" fontSize="5" fontWeight="700" fill={color}>Z</text>
        </svg>
    );
}

let mediaRecorder: MediaRecorder | null = null;
let chunks: BlobPart[] = [];
let tracks: MediaStreamTrack[] = [];
let audioCtx: AudioContext | null = null;

async function cleanup() {
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
        showToast({ text: source.error ?? "Could not start recording.", variant: "danger" });
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

        let micStream: MediaStream | null = null;
        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: MediaEngineStore.getInputDeviceId() ?? undefined }
            });
        } catch {
            micStream = null;
        }

        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        audioCtx.createMediaStreamSource(systemStream).connect(dest);
        if (micStream) audioCtx.createMediaStreamSource(micStream).connect(dest);

        tracks = [...systemStream.getTracks(), ...(micStream?.getTracks() ?? [])];

        chunks = [];
        mediaRecorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorder.ondataavailable = e => {
            if (e.data.size) chunks.push(e.data);
        };
        mediaRecorder.start(1000);
        return true;
    } catch {
        showToast({ text: "Could not access audio for recording.", variant: "danger" });
        await cleanup();
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
    await cleanup();

    const blob = new Blob(chunks, { type: "audio/webm" });
    chunks = [];

    if (!blob.size) {
        showToast({ text: "Nothing was recorded.", variant: "danger" });
        return;
    }

    const buffer = await blob.arrayBuffer();
    const res = await Native.saveRecording(buffer);
    showToast({
        text: res.success ? "Recording saved." : (res.error ?? "Failed to save recording."),
        variant: res.success ? "success" : "danger"
    });
}

function RecordButton() {
    const [recording, setRecording] = useState(false);
    const [busy, setBusy] = useState(false);

    if (!useAccess()) return null;

    async function toggle() {
        if (busy) return;
        setBusy(true);

        if (recording) {
            await stopRecording();
            setRecording(false);
        } else {
            const ok = await startRecording();
            setRecording(ok);
        }

        setBusy(false);
    }

    return (
        <UserAreaButton
            icon={<ZzzIcon />}
            tooltipText="ZzZ"
            onClick={toggle}
        />
    );
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
        addUserAreaButton("g-call-recorder", () => <RecordButton />, 10);
        addUserAreaButton("g-shield", props => <ShieldButton {...props} />, 80);
        refresh();
    },

    stop() {
        removeProviders.forEach(remove => remove());
        removeUserAreaButton("g-shield");
        removeUserAreaButton("g-call-recorder");
        if (mediaRecorder) stopRecording();
    }
});
