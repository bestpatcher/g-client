/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addGlobalContextMenuPatch, GlobalContextMenuPatchCallback, removeGlobalContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { addUserAreaButton, removeUserAreaButton, UserAreaButton, UserAreaButtonFactory, UserAreaRenderProps } from "@api/UserArea";
import { openSauce, prefetchPatcher } from "@equicordplugins/lowzModules";
import { EquicordDevs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { isLicensed } from "@utils/gAccess";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { find } from "@webpack";
import { FluxDispatcher, MediaEngineStore, Menu, SelectedChannelStore, showToast } from "@webpack/common";

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
    micBoost: {
        type: OptionType.SLIDER,
        description: "Microphone input volume in percent. Goes past the normal 100 limit.",
        markers: [100, 150, 200, 250, 300],
        stickToMarkers: false,
        default: 100,
        onChange: (volume: number) => applyMicBoost(volume)
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
    },
    menuReady: {
        type: OptionType.CUSTOM,
        default: false
    },
    diagnostics: {
        type: OptionType.COMPONENT,
        component: () => (
            <Button type="button" variant="secondary" onClick={() => copyWithToast(buildReport(), "Diagnostics copied.")}>
                Copy diagnostics
            </Button>
        )
    }
});

let boostResult = "not applied";

// Discord clamps its own store to 100, so values above that go straight to the audio engine.
function applyMicBoost(volume: number = settings.store.micBoost) {
    if (volume <= 100) {
        FluxDispatcher.dispatch({ type: "AUDIO_SET_INPUT_VOLUME", volume });
        boostResult = "normal volume";
        return;
    }
    const engine: Loose | undefined = (MediaEngineStore as Loose).getMediaEngine?.();
    if (typeof engine?.setInputVolume !== "function") {
        boostResult = "engine has no setInputVolume";
        logger.warn(boostResult, engine && Object.getOwnPropertyNames(Object.getPrototypeOf(engine)).filter(n => /volume|gain/i.test(n)));
        return;
    }
    try {
        engine.setInputVolume(volume);
        boostResult = `engine accepted ${volume}`;
    } catch (e) {
        boostResult = `engine threw: ${String(e)}`;
        logger.error("Failed to boost mic", e);
    }
}

// ---------- Fake mute / fake deafen ----------
// The gateway voice state message (op 4) is rewritten on its way out, so other people see
// a muted or deafened state while your real audio settings stay untouched.

let originalSend: WebSocket["send"] | null = null;
let gatewaySocket: WebSocket | null = null;
let realVoiceState: Loose | null = null;
let warnedBinary = false;
let patchHits = 0;
let lastRealMute: unknown = null;
let lastRealDeaf: unknown = null;

const stats = {
    gatewayUrl: "",
    stringSends: 0,
    binarySends: 0,
    ops: {} as Record<string, number>,
    op4Seen: 0,
    lastOp4Keys: [] as string[],
    lastOp4Real: null as Loose | null,
    lastOp4Sent: null as Loose | null
};

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
        const isGateway = Boolean(this.url?.includes("gateway"));
        if (isGateway) {
            stats.gatewayUrl = this.url.split("?")[0] + (this.url.includes("encoding=") ? "?" + this.url.split("?")[1] : "");
            if (typeof data === "string") {
                stats.stringSends++;
                const op = /"op":\s*(\d+)/.exec(data.slice(0, 80))?.[1];
                if (op) stats.ops[op] = (stats.ops[op] ?? 0) + 1;
            } else stats.binarySends++;
        }

        if (typeof data === "string") {
            if (data.includes("\"op\":4")) {
                try {
                    const msg = JSON.parse(data);
                    if (msg?.op === 4 && msg.d && "self_mute" in msg.d) {
                        gatewaySocket = this;
                        realVoiceState = { ...msg.d };
                        const sent = patchHits === 0 ? withFakeState(msg.d) : msg.d;
                        stats.op4Seen++;
                        stats.lastOp4Keys = Object.keys(msg.d);
                        stats.lastOp4Real = { self_mute: msg.d.self_mute, self_deaf: msg.d.self_deaf };
                        stats.lastOp4Sent = { self_mute: sent.self_mute, self_deaf: sent.self_deaf };
                        logger.info("Voice state sent", stats.lastOp4Real, "->", stats.lastOp4Sent);
                        data = JSON.stringify({ ...msg, d: sent });
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

// The patch below runs inside the function Discord uses to send your voice status.
// It remembers that function and its last arguments, so it can be called again on demand.
let senderCtx: Loose | null = null;
let senderName: string | null = null;
let senderArgs: unknown[] = [];

function captureSender(ctx: unknown, args: ArrayLike<unknown> | undefined) {
    if (!ctx || typeof ctx !== "object" || !args) return;
    const target = ctx as Loose;

    if (senderCtx !== target || !senderName) {
        const proto = Object.getPrototypeOf(target);
        const names = [...(proto ? Object.getOwnPropertyNames(proto) : []), ...Object.getOwnPropertyNames(target)];
        senderName = null;
        for (const name of names) {
            if (name === "constructor") continue;
            try {
                const fn = target[name];
                if (typeof fn === "function" && Function.prototype.toString.call(fn).includes("self_deaf")) {
                    senderName = name;
                    break;
                }
            } catch { }
        }
        senderCtx = senderName ? target : null;
        if (senderName) logger.info("Found the voice status sender:", senderName);
    }

    if (senderName) senderArgs = Array.from(args);
}

function resendVoiceState() {
    if (senderCtx && senderName && SelectedChannelStore.getVoiceChannelId()) {
        try {
            senderCtx[senderName](...senderArgs);
            return;
        } catch (e) {
            logger.error("Failed to resend voice status", e);
        }
    }
    if (!gatewaySocket || !realVoiceState || gatewaySocket.readyState !== WebSocket.OPEN) return;
    gatewaySocket.send(JSON.stringify({ op: 4, d: realVoiceState }));
}

// ---------- Stereo microphone ----------
// Voice connections are wrapped so the audio encoder always asks for 2 channels in stereo mode.

const wrappedConnections = new Map<Loose, (options: Loose) => unknown>();
const lastOptions = new WeakMap<Loose, Loose>();
const transportLog: Loose[] = [];

function withChannels(options: Loose): Loose {
    if (settings.store.micMode !== "stereo" || !options) return options;
    // Only widen to 2 channels. Forcing fec off and the bitrate up to 512kbps made the
    // stream far more sensitive to ordinary network jitter, which is what was causing
    // the mic to break up for listeners mid-call.
    return {
        ...options,
        ...options.audioEncoder && { audioEncoder: { ...options.audioEncoder, channels: 2 } }
    };
}

function wrapConnection(connection: Loose) {
    if (!connection || wrappedConnections.has(connection) || typeof connection.setTransportOptions !== "function") return;

    const orig = connection.setTransportOptions as (options: Loose) => unknown;
    wrappedConnections.set(connection, orig);

    connection.setTransportOptions = function (this: Loose, options: Loose) {
        lastOptions.set(connection, options);
        transportLog.push({
            keys: Object.keys(options ?? {}),
            encoderKeys: options?.audioEncoder ? Object.keys(options.audioEncoder) : null,
            channelsBefore: options?.audioEncoder?.channels,
            stereoMode: settings.store.micMode === "stereo"
        });
        if (transportLog.length > 8) transportLog.shift();
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
    for (const connection of Array.from<Loose>(connections.values?.() ?? connections)) wrapConnection(connection.conn);
}

let voiceConnectionClass: Loose | undefined;
let originalUpdateVideoQuality: ((...args: unknown[]) => unknown) | undefined;

// Discord calls updateVideoQuality on every voice connection, which gives access to the native connection (this.conn).
function hookVoiceConnectionClass() {
    voiceConnectionClass = find((m: Loose) => m?.prototype?.updateVideoQuality);
    if (!voiceConnectionClass) {
        logger.warn("Could not find the voice connection class, stereo microphone is unavailable.");
        return;
    }
    const orig = originalUpdateVideoQuality = voiceConnectionClass.prototype.updateVideoQuality;
    voiceConnectionClass.prototype.updateVideoQuality = function (this: Loose, ...args: unknown[]) {
        const ret = orig?.apply(this, args);
        wrapConnection(this.conn);
        return ret;
    };
}

function reapplyTransportOptions() {
    for (const [connection] of wrappedConnections) {
        const options = lastOptions.get(connection);
        if (options) connection.setTransportOptions(options);
    }
}

function buildReport() {
    const engine = (MediaEngineStore as Loose).getMediaEngine?.();
    const connections = engine?.connections;
    const list = connections ? Array.from<Loose>(connections.values?.() ?? connections) : [];
    const first = list[0];
    return JSON.stringify({
        plugin: "GVoice diagnostics v5",
        voiceClassFound: Boolean(voiceConnectionClass),
        micBoost: { setting: settings.store.micBoost, storeVolume: MediaEngineStore.getInputVolume(), result: boostResult },
        sender: { found: Boolean(senderName), name: senderName, argCount: senderArgs.length },
        patchHits,
        lastRealMute,
        lastRealDeaf,
        settings: { micMode: settings.store.micMode, fakeMute: settings.store.fakeMute, fakeDeafen: settings.store.fakeDeafen },
        sendHookInstalled: Boolean(originalSend),
        socketCaptured: Boolean(gatewaySocket),
        gateway: stats,
        engine: {
            hasGetMediaEngine: typeof (MediaEngineStore as Loose).getMediaEngine,
            engineKeys: engine ? Object.keys(engine).slice(0, 50) : null,
            connectionsType: connections?.constructor?.name ?? null,
            connectionCount: list.length,
            wrapped: wrappedConnections.size,
            connectionKeys: first ? Object.keys(first).slice(0, 50) : null,
            connectionMethods: first
                ? Object.getOwnPropertyNames(Object.getPrototypeOf(first)).filter(n => /option|encoder|transport|audio|channel|stereo/i.test(n))
                : null
        },
        transportLog
    }, null, 2);
}

function notify(message: string) {
    showToast({ text: message, variant: "success", position: "bottom" });
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

function toggleFake(key: "fakeMute" | "fakeDeafen") {
    settings.store[key] = !settings.store[key];
    resendVoiceState();
    notify(settings.store[key] ? "On" : "Off");
}

function collectIds(nodes: unknown, ids: string[] = []) {
    for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
        const props = (node as { props?: { id?: unknown; children?: unknown; }; } | null)?.props;
        if (!props) continue;
        if (typeof props.id === "string") ids.push(props.id);
        collectIds(props.children, ids);
    }
    return ids;
}

const voiceMenuPatch: GlobalContextMenuPatchCallback = (navId, children) => {
    const ids = collectIds(children);
    const text = [navId, ...ids].join(" ");
    const input = /input-(device|volume|profile|mode)/.test(text) || /input/i.test(navId);
    const output = !navId.startsWith("user") && /output/i.test(text);
    if (!input && !output) return;

    const key = input ? "fakeMute" : "fakeDeafen";
    settings.store.menuReady = true;
    children.push(
        <Menu.MenuGroup>
            <Menu.MenuCheckboxItem
                id={`g-${key}`}
                label={input ? "Fake Mute" : "Fake Deafen"}
                checked={settings.store[key]}
                action={() => toggleFake(key)}
            />
            {input && (
                <Menu.MenuItem
                    id="g-open-sauce"
                    label="Open Da Sauce"
                    action={openSauce}
                />
            )}
        </Menu.MenuGroup>
    );
};

function FakeMuteButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { fakeMute, menuReady } = settings.use(["fakeMute", "menuReady"]);
    if (menuReady) return null;

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : fakeMute ? "Fake Mute: on" : "Fake Mute: off"}
            icon={<MicIcon className={iconForeground} slashed={fakeMute} />}
            role="switch"
            aria-checked={fakeMute}
            redGlow={fakeMute}
            plated={nameplate != null}
            onClick={() => toggleFake("fakeMute")}
        />
    );
}

function FakeDeafenButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { fakeDeafen, menuReady } = settings.use(["fakeDeafen", "menuReady"]);
    if (menuReady) return null;

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : fakeDeafen ? "Fake Deafen: on" : "Fake Deafen: off"}
            icon={<HeadphonesIcon className={iconForeground} slashed={fakeDeafen} />}
            role="switch"
            aria-checked={fakeDeafen}
            redGlow={fakeDeafen}
            plated={nameplate != null}
            onClick={() => toggleFake("fakeDeafen")}
        />
    );
}

const fakeMuteFactory: UserAreaButtonFactory = props => <FakeMuteButton {...props} />;
const fakeDeafenFactory: UserAreaButtonFactory = props => <FakeDeafenButton {...props} />;

export default definePlugin({
    name: "GVoice",
    description: "Stereo or mono microphone, plus fake mute and fake deafen buttons next to your voice controls.",
    tags: ["Utility", "Voice"],
    authors: [EquicordDevs.nobody],
    dependencies: ["UserAreaAPI", "ContextMenuAPI"],
    enabledByDefault: true,
    settings,

    patches: [
        {
            // Discord builds its voice status message with these exact field names
            find: "self_deaf:",
            all: true,
            noWarn: true,
            replacement: [
                {
                    match: /self_mute:((?:!!)?\i(?:\.\i)*)/,
                    replace: "self_mute:$self.fakeMuteValue($1,this,arguments)"
                },
                {
                    match: /self_deaf:((?:!!)?\i(?:\.\i)*)/,
                    replace: "self_deaf:$self.fakeDeafenValue($1,this,arguments)"
                }
            ]
        }
    ],

    fakeMuteValue(real: boolean, ctx?: unknown, args?: ArrayLike<unknown>) {
        patchHits++;
        lastRealMute = real;
        // This runs on every voice status build, for every $G user, whether or not they've
        // ever touched fake mute/deafen. captureSender does an expensive reflective scan, so
        // only pay for it when the feature could actually matter.
        if (settings.store.fakeMute || settings.store.fakeDeafen) captureSender(ctx, args);
        if (!isLicensed()) return real;
        return settings.store.fakeMute || settings.store.fakeDeafen ? true : real;
    },

    fakeDeafenValue(real: boolean, ctx?: unknown, args?: ArrayLike<unknown>) {
        patchHits++;
        lastRealDeaf = real;
        if (settings.store.fakeMute || settings.store.fakeDeafen) captureSender(ctx, args);
        if (!isLicensed()) return real;
        return settings.store.fakeDeafen ? true : real;
    },

    flux: {
        RTC_CONNECTION_STATE() {
            wrapAllConnections();
            if (settings.store.micBoost > 100) applyMicBoost();
        },
        AUDIO_SET_INPUT_VOLUME() {
            if (settings.store.micBoost > 100) applyMicBoost();
        },
        AUDIO_SET_INPUT_DEVICE() {
            if (settings.store.micBoost > 100) applyMicBoost();
        }
    },

    start() {
        logger.info("GVoice started");
        installSendHook();
        if (settings.store.micBoost > 100) applyMicBoost();
        prefetchPatcher();
        addGlobalContextMenuPatch(voiceMenuPatch);
        addUserAreaButton("g-fake-mute", fakeMuteFactory, 90);
        addUserAreaButton("g-fake-deafen", fakeDeafenFactory, 91);
        hookVoiceConnectionClass();
        wrapAllConnections();
    },

    stop() {
        removeGlobalContextMenuPatch(voiceMenuPatch);
        removeUserAreaButton("g-fake-mute");
        removeUserAreaButton("g-fake-deafen");

        if (originalSend) {
            WebSocket.prototype.send = originalSend;
            originalSend = null;
            if (gatewaySocket && realVoiceState && gatewaySocket.readyState === WebSocket.OPEN) {
                gatewaySocket.send(JSON.stringify({ op: 4, d: realVoiceState }));
            }
        }

        if (voiceConnectionClass && originalUpdateVideoQuality) voiceConnectionClass.prototype.updateVideoQuality = originalUpdateVideoQuality;
        for (const [connection, orig] of wrappedConnections) connection.setTransportOptions = orig;
        wrappedConnections.clear();
    }
});
