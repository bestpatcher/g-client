/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { Button } from "@components/Button";
import { BackupRestoreIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import SettingsPlugin from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import { Margins } from "@utils/margins";
import { removeFromArray, sleep } from "@utils/misc";
import { openModal, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot } from "@utils/modal";
import { relaunch } from "@utils/native";
import definePlugin, { PluginNative } from "@utils/types";
import { ChannelStore, IconUtils, React, RelationshipStore, RestAPI, UserStore, useStateFromStores, useState } from "@webpack/common";

const Native = VencordNative.pluginHelpers.LowzModules as PluginNative<typeof import("./native")>;

// ─── Lowz Modules Settings Tab (unchanged) ───────────────────────────────────

function LowzModulesTab() {
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
        <SettingsTab>
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
        </SettingsTab>
    );
}

// ─── Mass DM Modal ────────────────────────────────────────────────────────────

interface Friend {
    id: string;
    username: string;
    globalName: string | null;
    avatarURL: string;
}

function MassDMModal({ modalProps }: { modalProps: any; }) {
    const friends = useStateFromStores([RelationshipStore, UserStore], () =>
        RelationshipStore.getFriendIDs().map((id): Friend => {
            const user = UserStore.getUser(id);
            return {
                id,
                username: user?.username ?? "Unknown",
                globalName: user?.globalName ?? null,
                avatarURL: user ? IconUtils.getUserAvatarURL(user, false, 32) : IconUtils.getDefaultAvatarURL(id),
            };
        }).sort((a, b) => (a.globalName ?? a.username).localeCompare(b.globalName ?? b.username))
    );

    const [selected, setSelected] = useState<Set<string>>(() => new Set(friends.map(f => f.id)));
    const [message, setMessage] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState("");
    const [search, setSearch] = useState("");
    let fileInput: HTMLInputElement | null = null;

    const filtered = friends.filter(f =>
        (f.globalName ?? f.username).toLowerCase().includes(search.toLowerCase())
    );

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const handleSend = async () => {
        const targets = friends.filter(f => selected.has(f.id));
        if (!targets.length || (!message.trim() && !attachments.length)) return;

        setSending(true);
        let sent = 0, failed = 0;

        for (const friend of targets) {
            setProgress(`${sent + 1} / ${targets.length} — ${friend.globalName ?? friend.username}`);
            try {
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
    };

    return (
        <ModalRoot {...modalProps} size="medium">
            <ModalHeader>
                <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Mass DM</span>
                <ModalCloseButton onClose={modalProps.onClose} />
            </ModalHeader>

            <ModalContent style={{ padding: "16px 16px 0" }}>
                {/* Message composer */}
                <Paragraph className={Margins.bottom8} style={{ fontWeight: 600, color: "var(--header-primary)" }}>Message</Paragraph>
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={sending}
                    rows={3}
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
                        marginBottom: 8,
                        fontFamily: "inherit",
                    }}
                />

                {/* Attach */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
                    <button
                        onClick={() => fileInput?.click()}
                        disabled={sending}
                        style={{
                            background: "var(--background-modifier-accent)",
                            border: "none",
                            borderRadius: 4,
                            color: "var(--text-normal)",
                            padding: "4px 10px",
                            fontSize: 13,
                            cursor: "pointer",
                        }}
                    >+ Attach</button>
                    <input
                        ref={el => { fileInput = el; }}
                        type="file"
                        multiple
                        accept="image/*,video/*,.gif,.mp4,.webm"
                        style={{ display: "none" }}
                        onChange={e => {
                            if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                        }}
                    />
                    {attachments.map((file, i) => (
                        <span key={file.name} style={{
                            background: "var(--background-modifier-accent)",
                            borderRadius: 4,
                            padding: "3px 8px",
                            fontSize: 12,
                            color: "var(--text-muted)",
                        }}>
                            {file.name}{" "}
                            <span
                                onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                style={{ cursor: "pointer", color: "var(--status-danger)" }}
                            >×</span>
                        </span>
                    ))}
                </div>

                {/* Recipients header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Paragraph style={{ fontWeight: 600, color: "var(--header-primary)", margin: 0 }}>
                        Recipients ({selected.size} / {friends.length})
                    </Paragraph>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setSelected(new Set(friends.map(f => f.id)))} disabled={sending} style={{ background: "none", border: "none", color: "var(--text-link)", cursor: "pointer", fontSize: 13 }}>Select all</button>
                        <button onClick={() => setSelected(new Set())} disabled={sending} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>Deselect all</button>
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
                    maxHeight: 200,
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
                                        padding: "6px 12px",
                                        cursor: sending ? "default" : "pointer",
                                        background: isSelected ? "var(--background-modifier-selected)" : "transparent",
                                        userSelect: "none",
                                    }}
                                >
                                    <img src={friend.avatarURL} style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 14, color: isSelected ? "var(--text-normal)" : "var(--text-muted)" }}>
                                        {friend.globalName ?? friend.username}
                                        {friend.globalName && <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}>@{friend.username}</span>}
                                    </span>
                                    <div style={{
                                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                                        border: `2px solid ${isSelected ? "var(--brand-experiment)" : "var(--background-modifier-accent)"}`,
                                        background: isSelected ? "var(--brand-experiment)" : "transparent",
                                        display: "flex", alignItems: "center", justifyContent: "center",
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

                {progress && (
                    <Paragraph className={Margins.bottom8} style={{
                        color: progress.startsWith("Done") ? "var(--text-positive)" : "var(--text-muted)",
                        fontSize: 13,
                    }}>
                        {progress}
                    </Paragraph>
                )}
            </ModalContent>

            <ModalFooter>
                <Button
                    onClick={handleSend}
                    disabled={sending || selected.size === 0 || (!message.trim() && !attachments.length)}
                    style={{ width: "100%", fontWeight: 700 }}
                >
                    {sending ? "Sending..." : `Mass DM (${selected.size})`}
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

// ─── Chat bar button (DMs only) ───────────────────────────────────────────────

const MassDMButton: ChatBarButtonFactory = ({ channel }) => {
    // Only show in DM channels (type 1 = DM)
    if (channel.type !== 1) return null;

    return (
        <ChatBarButton
            tooltip="Mass DM"
            onClick={() => openModal(modalProps => <MassDMModal modalProps={modalProps} />)}
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM9 11H7V9h2v2Zm4 0h-2V9h2v2Zm4 0h-2V9h2v2Z" />
            </svg>
        </ChatBarButton>
    );
};

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "LowzModules",
    description: "Adds a Lowz Modules page to settings that swaps your voice modules.",
    authors: [EquicordDevs.nobody],
    required: true,
    dependencies: ["ChatInputButtonAPI"],

    chatBarButton: {
        render: MassDMButton
    },

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
