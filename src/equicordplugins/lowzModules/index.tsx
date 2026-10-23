/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import { BackupRestoreIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import SettingsPlugin from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import { Margins } from "@utils/margins";
import { removeFromArray } from "@utils/misc";
import { relaunch } from "@utils/native";
import definePlugin, { PluginNative } from "@utils/types";
import { Modal, openModal, TextInput, useState } from "@webpack/common";

const Native = VencordNative.pluginHelpers.LowzModules as PluginNative<typeof import("./native")>;

function discordBranchLabel() {
    switch (window.GLOBAL_ENV.RELEASE_CHANNEL) {
        case "canary": return "Discord Canary";
        case "ptb": return "Discord PTB";
        default: return "Discord";
    }
}

export function openSauce() {
    openModal(modalProps => <KeyModal modalProps={modalProps} />);
}

export function prefetchPatcher() {
    Native.prefetchPatcher();
}

function KeyModal({ modalProps }: { modalProps: object; }) {
    const [key, setKey] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    async function submit(mode: "on" | "off") {
        setBusy(true);
        setMessage("");
        const res = await Native.injectWithKey(key, mode);
        setBusy(false);
        setMessage(res.success ? `${discordBranchLabel()} ${mode === "on" ? "On" : "Off"}` : res.error ?? "Something went wrong.");
    }

    return (
        <ErrorBoundary>
            <Modal {...modalProps} size="sm" title="whats yo fuckin key">
                <TextInput
                    value={key}
                    onChange={setKey}
                    placeholder="License key"
                    disabled={busy}
                    onKeyDown={e => { if (e.key === "Enter" && key.trim() && !busy) submit("on"); }}
                />
                <div style={{ marginTop: "16px" }}>
                    <Button disabled={busy || !key.trim()} onClick={() => submit("on")}>{busy ? "Injecting..." : "Inject"}</Button>
                </div>
                <div style={{ marginTop: "8px" }}>
                    <Button variant="secondary" disabled={busy || !key.trim()} onClick={() => submit("off")}>turn dis bih off</Button>
                </div>
                {message && <div style={{ color: "#fff", marginTop: "12px" }}>{message}</div>}
            </Modal>
        </ErrorBoundary>
    );
}

function LowzModulesTab() {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [done, setDone] = useState(false);

    async function run(action: typeof Native.changeModules | typeof Native.stereoDefault | typeof Native.restoreOriginalModules) {
        setBusy(true);
        const res = await action();
        setBusy(false);
        setDone(res.success);
        setMessage(res.success ? "Done. Restart Discord to apply." : res.error ?? "Something went wrong.");
    }

    return (
        <SettingsTab>
            <Heading>Lowz Modules</Heading>
            <Paragraph className={Margins.bottom16}>
                Change Modules installs the Lowz voice modules. Stereo Default installs the stereo default voice modules. Your original files are saved the first time you use either button. If your mic starts breaking up partway through calls, try Restore Original to put Discord's own voice modules back.
            </Paragraph>
            <div className={Margins.bottom16}>
                <Button disabled={busy} onClick={() => run(Native.changeModules)}>Change Modules</Button>
                {" "}
                <Button variant="secondary" disabled={busy} onClick={() => run(Native.stereoDefault)}>Stereo Default</Button>
                {" "}
                <Button variant="secondary" disabled={busy} onClick={() => run(Native.restoreOriginalModules)}>Restore Original</Button>
            </div>
            {message && <Paragraph className={Margins.bottom16}>{message}</Paragraph>}
            {done && <Button onClick={relaunch}>Restart Discord</Button>}
        </SettingsTab>
    );
}

export default definePlugin({
    name: "LowzModules",
    description: "Adds a Lowz Modules page to settings that swaps your voice modules.",
    authors: [EquicordDevs.nobody],
    required: true,

    start() {
        SettingsPlugin.customEntries.push({
            key: "equicord_lowz_modules",
            title: "Lowz Modules",
            Component: wrapTab(LowzModulesTab, "LowzModules"),
            Icon: BackupRestoreIcon
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "equicord_lowz_modules");
    }
});
