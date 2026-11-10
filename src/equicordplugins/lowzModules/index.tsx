/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
import { Channel } from "@vencord/discord-types";
import { ChannelStore, IconUtils, Menu, React, RelationshipStore, RestAPI, UserStore, useStateFromStores, useState } from "@webpack/common";

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
                await sleep(5000);
            } catch {
                failed++;
            }
        }

        setProgress(`Done — ${sent} sent, ${failed} failed`);
        setSending(false);
    };

    return (
        <ModalRoot {...modalProps} size="medium">
            <style>{`
                .vc-massdm-textarea, .vc-massdm-search {
                    color: var(--text-normal) !important;
                    caret-color: var(--text-normal) !important;
                }
                .vc-massdm-textarea::placeholder, .vc-massdm-search::placeholder {
                    color: var(--text-muted) !important;
                }
            `}</style>
            <ModalHeader>
                <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Mass DM</span>
                <ModalCloseButton onClose={modalProps.onClose} />
            </ModalHeader>

            <ModalContent style={{ padding: "12px 16px 0" }}>
                {/* Message composer */}
                <div style={{
                    background: "var(--channeltextarea-background)",
                    border: "1px solid var(--background-modifier-accent)",
                    borderRadius: 8,
                    marginBottom: 8,
                    overflow: "hidden",
                }}>
                    <textarea
                        className="vc-massdm-textarea"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sending}
                        rows={2}
                        style={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            color: "var(--text-normal)",
                            padding: "10px 12px 4px",
                            fontSize: 14,
                            resize: "none",
                            outline: "none",
                            boxSizing: "border-box",
                            fontFamily: "inherit",
                            display: "block",
                        }}
                    />
                    <div style={{ display: "flex", alignItems: "center", padding: "4px 8px 6px", gap: 6 }}>
                        <button
                            onClick={() => fileInput?.click()}
                            disabled={sending}
                            style={{
                                background: "none",
                                border: "none",
                                color: "var(--interactive-normal)",
                                cursor: "pointer",
                                padding: "2px 4px",
                                borderRadius: 4,
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2a1 1 0 0 1 1 1v8h8a1 1 0 1 1 0 2h-8v8a1 1 0 1 1-2 0v-8H3a1 1 0 1 1 0-2h8V3a1 1 0 0 1 1-1Z" />
                            </svg>
                            Attach
                        </button>
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
                                borderRadius: 3,
                                padding: "1px 6px",
                                fontSize: 11,
                                color: "var(--text-muted)",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                            }}>
                                {file.name}
                                <span onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} style={{ cursor: "pointer", color: "var(--status-danger)", lineHeight: 1 }}>×</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* Recipients row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Friends — {selected.size} of {friends.length} selected
                    </span>
                    <div style={{ display: "flex", gap: 10 }}>
                        <span onClick={() => !sending && setSelected(new Set(friends.map(f => f.id)))} style={{ color: "var(--text-link)", cursor: "pointer", fontSize: 12 }}>All</span>
                        <span onClick={() => !sending && setSelected(new Set())} style={{ color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>None</span>
                    </div>
                </div>

                {/* Search */}
                <input
                    className="vc-massdm-search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    style={{
                        width: "100%",
                        background: "var(--input-background, var(--background-secondary))",
                        border: "1px solid var(--background-modifier-accent)",
                        borderRadius: 4,
                        color: "var(--text-normal)",
                        padding: "5px 10px",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                        marginBottom: 6,
                    }}
                />

                {/* Friend list */}
                <div style={{
                    maxHeight: 180,
                    overflowY: "auto",
                    borderRadius: 6,
                    border: "1px solid var(--background-modifier-accent)",
                    marginBottom: 10,
                }}>
                    {filtered.length === 0
                        ? <div style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>No friends found</div>
                        : filtered.map(friend => {
                            const isSelected = selected.has(friend.id);
                            return (
                                <div
                                    key={friend.id}
                                    onClick={() => !sending && toggle(friend.id)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "5px 10px",
                                        cursor: sending ? "default" : "pointer",
                                        background: isSelected ? "var(--background-modifier-selected)" : "transparent",
                                        userSelect: "none",
                                    }}
                                >
                                    <img src={friend.avatarURL} style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 13, color: isSelected ? "var(--text-normal)" : "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {friend.globalName ?? friend.username}
                                    </span>
                                    <div style={{
                                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                                        border: `2px solid ${isSelected ? "var(--brand-experiment)" : "var(--background-modifier-accent)"}`,
                                        background: isSelected ? "var(--brand-experiment)" : "transparent",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        {isSelected && (
                                            <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    }
                </div>

                {progress && (
                    <div style={{
                        fontSize: 12,
                        color: progress.startsWith("Done") ? "var(--text-positive)" : "var(--text-muted)",
                        marginBottom: 8,
                        textAlign: "center",
                    }}>
                        {progress}
                    </div>
                )}
            </ModalContent>

            <ModalFooter style={{ padding: "12px 16px" }}>
                <Button
                    onClick={handleSend}
                    disabled={sending || selected.size === 0 || (!message.trim() && !attachments.length)}
                    style={{ width: "100%", fontWeight: 600 }}
                >
                    {sending ? "Sending..." : `Mass DM — ${selected.size} ${selected.size === 1 ? "person" : "people"}`}
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "LowzModules",
    description: "Adds a Lowz Modules page to settings that swaps your voice modules.",
    authors: [EquicordDevs.nobody],
    required: true,
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "channel-attach"(children, { channel }: { channel: Channel; }) {
            if (channel.type !== 1) return;
            children.push(
                <Menu.MenuItem
                    id="vc-mass-dm"
                    label="Mass DM"
                    action={() => openModal(modalProps => <MassDMModal modalProps={modalProps} />)}
                />
            );
        }
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
