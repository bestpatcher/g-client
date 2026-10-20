/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { addUserAreaButton, removeUserAreaButton, UserAreaButton, UserAreaButtonFactory, UserAreaRenderProps } from "@api/UserArea";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { MediaEngineStore } from "@webpack/common";

const logger = new Logger("GVoice");

type Loose = Record<string, any>;

const settings = definePluginSettings({
    micMode: {
        type: OptionType.SELECT,
        description: "Microphone mode. Rejoin the voice channel after changing it. Stereo only helps if your microphone is stereo, and works best with noise suppression and echo cancellation turned off.",
        options: [
            { label: "Mono", value: "mono", default: true },
            { label: "Stereo", value: "stereo" }
        ],
        onChange: () => reapplyTransportOptions()
    },
    fakeMute: {
        type: OptionType.BOOLEAN,
        description: "Show everyone that you are muted. You can still talk.",
        default: false,
        onChange: () => resendVoiceState()
    },
    fakeDeafen: {
        type: OptionType.BOOLEAN,
        description: "Show everyone that you are deafened and muted. You can still hear and talk.",
        default: false,
        onChange: () => resendVoiceState()
    }
});

// ---------- Fake mute / fake deafen ----------
// The gateway voice state message (op 4) is rewritten on its way out, so other people see
// a muted or deafened state while your real audio settings stay untouched.

let originalSend: WebSocket["send"] | null = null;
let gatewaySocket: WebSocket | null = null;
let realVoiceState: Loose | null = null;
let warnedBinary = false;

function withFakeState(d: Loose): Loose {
    const out = { ...d };
    if (settings.store.fakeDeafen) {
        out.self_deaf = true;
        out.self_mute = true;
    } else if (settings.store.fakeMute) {
        out.self_mute = true;
    }
    return out;
}

function installSendHook() {
    if (originalSend) return;

    const orig = WebSocket.prototype.send;
    originalSend = orig;

    WebSocket.prototype.send = function (this: WebSocket, data: any) {
        if (typeof data === "string") {
            if (data.includes("\"op\":4")) {
                try {
                    const msg = JSON.parse(data);
                    if (msg?.op === 4 && msg.d && "self_mute" in msg.d) {
                        gatewaySocket = this;
                        realVoiceState = { ...msg.d };
                        data = JSON.stringify({ ...msg, d: withFakeState(msg.d) });
                    }
                } catch (e) {
                    logger.error("Failed to process voice state message", e);
                }
            }
        } else if (!warnedBinary && this.url?.includes("gateway")) {
            warnedBinary = true;
            logger.warn("Gateway is using binary messages, fake mute and fake deafen are unavailable.");
        }

        return orig.call(this, data);
    };
}

function resendVoiceState() {
    if (!gatewaySocket || !realVoiceState || gatewaySocket.readyState !== WebSocket.OPEN) return;
    gatewaySocket.send(JSON.stringify({ op: 4, d: realVoiceState }));
}

// ---------- Stereo microphone ----------
// Voice connections are wrapped so the audio encoder always asks for 2 channels in stereo mode.

const wrappedConnections = new Map<Loose, (options: Loose) => unknown>();
const lastOptions = new WeakMap<Loose, Loose>();

function withChannels(options: Loose): Loose {
    if (settings.store.micMode !== "stereo" || !options?.audioEncoder) return options;
    return { ...options, audioEncoder: { ...options.audioEncoder, channels: 2 } };
}

function wrapConnection(connection: Loose) {
    if (!connection || wrappedConnections.has(connection) || typeof connection.setTransportOptions !== "function") return;

    const orig = connection.setTransportOptions as (options: Loose) => unknown;
    wrappedConnections.set(connection, orig);

    connection.setTransportOptions = function (this: Loose, options: Loose) {
        lastOptions.set(connection, options);
        return orig.call(this, withChannels(options));
    };
    logger.info("Wrapped a voice connection for stereo support");
}

function wrapAllConnections() {
    const engine = (MediaEngineStore as Loose).getMediaEngine?.();
    const connections = engine?.connections;
    if (!connections) {
        logger.warn("Could not find voice connections, stereo microphone is unavailable.");
        return;
    }
    for (const connection of Array.from<Loose>(connections.values?.() ?? connections)) wrapConnection(connection);
}

function reapplyTransportOptions() {
    for (const [connection] of wrappedConnections) {
        const options = lastOptions.get(connection);
        if (options) connection.setTransportOptions(options);
    }
}

// ---------- Buttons next to mute and deafen ----------

function MicIcon({ className, slashed }: { className?: string; slashed?: boolean; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            {slashed && <path d="M4 4l16 16" stroke="var(--status-danger)" strokeWidth="2.4" strokeLinecap="round" />}
        </svg>
    );
}

function HeadphonesIcon({ className, slashed }: { className?: string; slashed?: boolean; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2v-8H5v-1a7 7 0 0 1 14 0v1h-2v8h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9Z" />
            {slashed && <path d="M4 4l16 16" stroke="var(--status-danger)" strokeWidth="2.4" strokeLinecap="round" />}
        </svg>
    );
}

function StereoIcon({ className, stereo }: { className?: string; stereo?: boolean; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            {stereo
                ? <>
                    <circle cx="9" cy="12" r="5.5" fill="currentColor" />
                    <circle cx="15" cy="12" r="5.5" fill="currentColor" opacity="0.55" />
                </>
                : <circle cx="12" cy="12" r="5.5" fill="currentColor" />}
        </svg>
    );
}

function FakeMuteButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { fakeMute } = settings.use(["fakeMute"]);
    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : fakeMute ? "Fake Mute: on" : "Fake Mute: off"}
            icon={<MicIcon className={iconForeground} slashed={fakeMute} />}
            role="switch"
            aria-checked={fakeMute}
            redGlow={fakeMute}
            plated={nameplate != null}
            onClick={() => { settings.store.fakeMute = !settings.store.fakeMute; resendVoiceState(); }}
        />
    );
}

function FakeDeafenButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { fakeDeafen } = settings.use(["fakeDeafen"]);
    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : fakeDeafen ? "Fake Deafen: on" : "Fake Deafen: off"}
            icon={<HeadphonesIcon className={iconForeground} slashed={fakeDeafen} />}
            role="switch"
            aria-checked={fakeDeafen}
            redGlow={fakeDeafen}
            plated={nameplate != null}
            onClick={() => { settings.store.fakeDeafen = !settings.store.fakeDeafen; resendVoiceState(); }}
        />
    );
}

function MicModeButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { micMode } = settings.use(["micMode"]);
    const stereo = micMode === "stereo";
    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : stereo ? "Microphone: Stereo" : "Microphone: Mono"}
            icon={<StereoIcon className={iconForeground} stereo={stereo} />}
            role="switch"
            aria-checked={stereo}
            orangeGlow={stereo}
            plated={nameplate != null}
            onClick={() => { settings.store.micMode = stereo ? "mono" : "stereo"; reapplyTransportOptions(); }}
        />
    );
}

const fakeMuteFactory: UserAreaButtonFactory = props => <FakeMuteButton {...props} />;
const fakeDeafenFactory: UserAreaButtonFactory = props => <FakeDeafenButton {...props} />;
const micModeFactory: UserAreaButtonFactory = props => <MicModeButton {...props} />;

export default definePlugin({
    name: "GVoice",
    description: "Stereo or mono microphone, plus fake mute and fake deafen buttons next to your voice controls.",
    tags: ["Utility", "Voice"],
    authors: [EquicordDevs.nobody],
    dependencies: ["UserAreaAPI"],
    enabledByDefault: true,
    settings,

    flux: {
        RTC_CONNECTION_STATE() {
            wrapAllConnections();
        }
    },

    start() {
        installSendHook();
        addUserAreaButton("g-fake-mute", fakeMuteFactory, 90);
        addUserAreaButton("g-fake-deafen", fakeDeafenFactory, 91);
        addUserAreaButton("g-mic-mode", micModeFactory, 92);
        wrapAllConnections();
    },

    stop() {
        removeUserAreaButton("g-fake-mute");
        removeUserAreaButton("g-fake-deafen");
        removeUserAreaButton("g-mic-mode");

        if (originalSend) {
            WebSocket.prototype.send = originalSend;
            originalSend = null;
            if (gatewaySocket && realVoiceState && gatewaySocket.readyState === WebSocket.OPEN) {
                gatewaySocket.send(JSON.stringify({ op: 4, d: realVoiceState }));
            }
        }

        for (const [connection, orig] of wrappedConnections) connection.setTransportOptions = orig;
        wrappedConnections.clear();
    }
});
