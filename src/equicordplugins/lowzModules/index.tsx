/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { BackupRestoreIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import SettingsPlugin from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import { Margins } from "@utils/margins";
import { removeFromArray, sleep } from "@utils/misc";
import { relaunch } from "@utils/native";
import definePlugin, { PluginNative } from "@utils/types";
import { IconUtils, RelationshipStore, RestAPI, TabBar, UserStore, useStateFromStores } from "@webpack/common";
import { useState } from "@webpack/common";

const Native = VencordNative.pluginHelpers.LowzModules as PluginNative<typeof import("./native")>;

// ─── Modules Tab ─────────────────────────────────────────────────────────────

function ModulesTab() {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [done, setDone] = useState(false);

    async function run(action: typeof Native.changeModules | typeof Native.stereoDefault) {
        setBusy(true);
        const res = await action();
        setBusy(false);
        setDone(res.success);
        setMessage(res.success ? "Done. Restart Discord to apply." : res.error ?? "Something went wrong.");
    }

    return (
        <div>
            <Paragraph className={Margins.bottom16}>
                Change Modules installs the Lowz voice modules. Stereo Default installs the stereo default voice modules. Your original files are saved the first time you use either button.
            </Paragraph>
            <div className={Margins.bottom16}>
                <Button disabled={busy} onClick={() => run(Native.changeModules)}>Change Modules</Button>
                {" "}
                <Button variant="secondary" disabled={busy} onClick={() => run(Native.stereoDefault)}>Stereo Default</Button>
            </div>
            {message && <Paragraph className={Margins.bottom16}>{message}</Paragraph>}
            {done && <Button onClick={relaunch}>Restart Discord</Button>}
        </div>
    );
}

// ─── Mass DM Tab ─────────────────────────────────────────────────────────────

interface Friend {
    id: string;
    username: string;
    globalName: string | null;
    avatarURL: string;
}

function MassDMTab() {
    const friends = useStateFromStores([RelationshipStore, UserStore], () => {
        const rels = RelationshipStore.getRelationships();
        return Object.entries(rels)
            .filter(([, type]) => type === 1)
            .map(([id]): Friend => {
                const user = UserStore.getUser(id);
                return {
                    id,
                    username: user?.username ?? "Unknown",
                    globalName: user?.globalName ?? null,
                    avatarURL: user ? IconUtils.getUserAvatarURL(user, false, 32) : IconUtils.getDefaultAvatarURL(id),
                };
            })
            .sort((a, b) => (a.globalName ?? a.username).localeCompare(b.globalName ?? b.username));
    });

    const [selected, setSelected] = useState<Set<string>>(() => new Set(friends.map(f => f.id)));
    const [message, setMessage] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState("");
    const [search, setSearch] = useState("");
    const fileInputRef = { current: null as HTMLInputElement | null };

    const filtered = friends.filter(f =>
        (f.globalName ?? f.username).toLowerCase().includes(search.toLowerCase())
    );

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const selectAll = () => setSelected(new Set(friends.map(f => f.id)));
    const deselectAll = () => setSelected(new Set());

    const removeAttachment = (i: number) =>
        setAttachments(prev => prev.filter((_, idx) => idx !== i));

    const handleSend = async () => {
        const targets = friends.filter(f => selected.has(f.id));
        if (!targets.length || (!message.trim() && !attachments.length)) return;

        setSending(true);
        let sent = 0, failed = 0;

        for (const friend of targets) {
            setProgress(`${sent + 1} / ${targets.length} — ${friend.globalName ?? friend.username}`);
            try {
                // Open or reuse DM channel
                const dmRes = await RestAPI.post({
                    url: "/users/@me/channels",
                    body: { recipient_id: friend.id },
                });
                const channelId = dmRes.body?.id;
                if (!channelId) { failed++; continue; }

                if (attachments.length > 0) {
                    const form = new FormData();
                    if (message.trim()) form.append("content", message.trim());
                    attachments.forEach((file, i) => form.append(`files[${i}]`, file, file.name));
                    await RestAPI.post({ url: `/channels/${channelId}/messages`, body: form });
                } else {
                    await RestAPI.post({
                        url: `/channels/${channelId}/messages`,
                        body: { content: message.trim() },
                    });
                }

                sent++;
                await sleep(400);
            } catch {
                failed++;
            }
        }

        setProgress(`Done — ${sent} sent, ${failed} failed`);
        setSending(false);
        setMessage("");
        setAttachments([]);
    };

    return (
        <div>
            {/* Composer */}
            <Paragraph className={Margins.bottom8} style={{ fontWeight: 600, color: "var(--header-primary)" }}>Message</Paragraph>
            <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={sending}
                rows={4}
                style={{
                    width: "100%",
                    background: "var(--input-background)",
                    border: "1px solid var(--background-modifier-accent)",
                    borderRadius: 4,
                    color: "var(--text-normal)",
                    padding: "8px 10px",
                    fontSize: 14,
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 10,
                    fontFamily: "inherit",
                }}
            />

            {/* Attachments */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
                <Button
                    size={Button.Sizes.SMALL}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                >
                    + Attach
                </Button>
                <input
                    ref={el => { fileInputRef.current = el; }}
                    type="file"
                    multiple
                    accept="image/*,video/*,.gif,.mp4,.webm"
                    style={{ display: "none" }}
                    onChange={e => {
                        if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                    }}
                />
                {attachments.map((file, i) => (
                    <div key={i} style={{
                        background: "var(--background-modifier-accent)",
                        borderRadius: 4,
                        padding: "3px 8px",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                    }}>
                        {file.name}
                        <span
                            onClick={() => removeAttachment(i)}
                            style={{ cursor: "pointer", color: "var(--status-danger)", fontWeight: "bold" }}
                        >×</span>
                    </div>
                ))}
            </div>

            {/* Friend list header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Paragraph style={{ fontWeight: 600, color: "var(--header-primary)", margin: 0 }}>
                    Recipients ({selected.size} / {friends.length} selected)
                </Paragraph>
                <div style={{ display: "flex", gap: 6 }}>
                    <Button size={Button.Sizes.TINY} onClick={selectAll} disabled={sending}>Select All</Button>
                    <Button size={Button.Sizes.TINY} color={Button.Colors.RED} onClick={deselectAll} disabled={sending}>Deselect All</Button>
                </div>
            </div>

            {/* Search */}
            <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search friends..."
                style={{
                    width: "100%",
                    background: "var(--input-background)",
                    border: "1px solid var(--background-modifier-accent)",
                    borderRadius: 4,
                    color: "var(--text-normal)",
                    padding: "6px 10px",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 6,
                }}
            />

            {/* Friend list */}
            <div style={{
                maxHeight: 220,
                overflowY: "auto",
                background: "var(--background-secondary-alt)",
                borderRadius: 6,
                border: "1px solid var(--background-modifier-accent)",
                marginBottom: 12,
            }}>
                {filtered.length === 0
                    ? <Paragraph style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>No friends found</Paragraph>
                    : filtered.map(friend => {
                        const isSelected = selected.has(friend.id);
                        return (
                            <div
                                key={friend.id}
                                onClick={() => !sending && toggle(friend.id)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "7px 12px",
                                    cursor: sending ? "default" : "pointer",
                                    background: isSelected ? "var(--background-modifier-selected)" : "transparent",
                                    userSelect: "none",
                                }}
                            >
                                <img
                                    src={friend.avatarURL}
                                    style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }}
                                />
                                <span style={{ flex: 1, fontSize: 14, color: isSelected ? "var(--text-normal)" : "var(--text-muted)" }}>
                                    {friend.globalName ?? friend.username}
                                    {friend.globalName && (
                                        <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}>
                                            @{friend.username}
                                        </span>
                                    )}
                                </span>
                                <div style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 3,
                                    flexShrink: 0,
                                    border: `2px solid ${isSelected ? "var(--brand-experiment)" : "var(--background-modifier-accent)"}`,
                                    background: isSelected ? "var(--brand-experiment)" : "transparent",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    {isSelected && (
                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        );
                    })
                }
            </div>

            {/* Progress */}
            {progress && (
                <Paragraph className={Margins.bottom12} style={{
                    color: progress.startsWith("Done") ? "var(--text-positive)" : "var(--text-muted)",
                    fontSize: 13,
                }}>
                    {progress}
                </Paragraph>
            )}

            {/* Send */}
            <Button
                size={Button.Sizes.MEDIUM}
                onClick={handleSend}
                disabled={sending || selected.size === 0 || (!message.trim() && !attachments.length)}
                style={{ width: "100%", fontWeight: 700 }}
            >
                {sending ? "Sending..." : `Mass DM (${selected.size})`}
            </Button>
        </div>
    );
}

// ─── Tabbed settings page ─────────────────────────────────────────────────────

type LowzTab = "modules" | "massdm";

function LowzModulesTab() {
    const [tab, setTab] = useState<LowzTab>("modules");

    return (
        <SettingsTab>
            <Heading>Lowz Modules</Heading>
            <TabBar
                type="top"
                look="brand"
                className={Margins.bottom16}
                selectedItem={tab}
                onItemSelect={(id: LowzTab) => setTab(id)}
            >
                <TabBar.Item id="modules">Modules</TabBar.Item>
                <TabBar.Item id="massdm">Mass DM</TabBar.Item>
            </TabBar>

            {tab === "modules" && <ModulesTab />}
            {tab === "massdm" && <MassDMTab />}
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
