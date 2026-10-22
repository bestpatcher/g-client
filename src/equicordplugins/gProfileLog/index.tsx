/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { get, set } from "@api/DataStore";
import { debounce } from "@shared/debounce";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { isAllowed } from "@utils/gAccess";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { Message, RenderModalProps, User } from "@vencord/discord-types";
import { IconUtils, Menu, Modal, moment, openModal, UserProfileStore, UserStore } from "@webpack/common";

type Field = "name" | "username" | "avatar" | "banner" | "bio";
type Snapshot = Partial<Record<Field, string | null>>;
interface Change { time: number; field: Field; old: string | null; now: string | null; }
interface Author { id: string; username?: string; global_name?: string | null; avatar?: string | null; banner?: string | null; }

const cl = classNameFactory("vc-gprofile-");
const SNAPSHOTS = "GProfileLog_snapshots";
const HISTORY = "GProfileLog_history";
const FIELDS: Record<Field, string> = { name: "Display name", username: "Username", avatar: "Avatar", banner: "Banner", bio: "Bio" };

let snapshots: Record<string, Snapshot> = {};
let history: Record<string, Change[]> = {};

const save = debounce(() => {
    set(SNAPSHOTS, snapshots);
    set(HISTORY, history);
}, 3000);

function record(id: string, seenNow: Snapshot) {
    const before = snapshots[id] ??= {};
    for (const field of Object.keys(seenNow) as Field[]) {
        const now = seenNow[field] ?? null;
        if (field in before && before[field] !== now) {
            (history[id] ??= []).push({ time: Date.now(), field, old: before[field] ?? null, now });
            history[id] = history[id].slice(-100);
        }
        before[field] = now;
    }
    save();
}

function recordAuthor(a: Author) {
    if (!isAllowed()) return;
    const seenNow: Snapshot = { username: a.username, name: a.global_name, avatar: a.avatar };
    if (a.banner !== undefined) seenNow.banner = a.banner;
    record(a.id, seenNow);
}

function avatarUrl(id: string, hash: string) {
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=128`;
}

function Value({ id, field, value }: { id: string; field: Field; value: string | null; }) {
    if (!value) return <span className={cl("none")} style={{ color: "#fff" }}>none</span>;
    if (field === "avatar") return <img className={cl("avatar")} src={avatarUrl(id, value)} />;
    if (field === "banner") return <img className={cl("banner")} src={IconUtils.getUserBannerURL({ id, banner: value, canAnimate: true, size: 300 })} />;
    return <span style={{ color: "#fff" }}>{value}</span>;
}

function pastValues(changes: Change[], field: Field) {
    const seen: string[] = [];
    for (const c of changes) {
        for (const v of [c.old, c.now]) {
            if (v && !seen.includes(v)) seen.push(v);
        }
    }
    return seen;
}

function HistoryModalContent({ user }: { user: User; }) {
    const changes = [...(history[user.id] ?? [])].reverse();
    const pastUsernames = pastValues(changes, "username").filter(v => v !== user.username);
    const pastNames = pastValues(changes, "name").filter(v => v !== (user.globalName ?? user.username));

    return (
        <div className={cl("content")} style={{ color: "#fff" }}>
            {(pastUsernames.length > 0 || pastNames.length > 0) && (
                <div className={cl("known")}>
                    {pastNames.length > 0 && <div style={{ color: "#fff" }}>Past display names: {pastNames.join(", ")}</div>}
                    {pastUsernames.length > 0 && <div style={{ color: "#fff" }}>Past usernames: {pastUsernames.join(", ")}</div>}
                </div>
            )}
            {changes.length === 0 && <div style={{ color: "#fff" }}>No changes saved for this person yet.</div>}
            {changes.map(c => (
                <div key={c.time + c.field} className={cl("row")}>
                    <div className={cl("meta")} style={{ color: "#fff" }}>{FIELDS[c.field]} changed {moment(c.time).format("MMM D, YYYY h:mm A")}</div>
                    <div className={cl("values")}>
                        <Value id={user.id} field={c.field} value={c.old} />
                        <span style={{ color: "#fff" }}>→</span>
                        <Value id={user.id} field={c.field} value={c.now} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function HistoryModal({ user, modalProps }: { user: User; modalProps: RenderModalProps; }) {
    return (
        <ErrorBoundary>
            <Modal {...modalProps} size="md" title="">
                <div style={{ color: "#fff", fontWeight: 600, fontSize: "18px", marginBottom: "12px" }}>{`${user.globalName ?? user.username} history`}</div>
                <HistoryModalContent user={user} />
            </Modal>
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "GProfileLog",
    description: "Saves avatar, name, banner and bio changes of people you see.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    async start() {
        snapshots = await get(SNAPSHOTS) ?? {};
        history = await get(HISTORY) ?? {};
    },

    contextMenus: {
        "user-context"(children, { user }: { user?: User; }) {
            if (!user || !isAllowed()) return;
            children.push(
                <Menu.MenuGroup>
                    <Menu.MenuItem id="vc-gprofile" label="Profile History" action={() => openModal(modalProps => <HistoryModal user={user} modalProps={modalProps} />)} />
                </Menu.MenuGroup>
            );
        }
    },

    flux: {
        USER_UPDATE({ user }: { user: Author; }) {
            recordAuthor(user);
        },
        MESSAGE_CREATE({ message }: { message: Message; }) {
            recordAuthor(message.author);
        },
        LOAD_MESSAGES_SUCCESS({ messages }: { messages: Message[]; }) {
            new Map(messages.map(m => [m.author.id, m.author])).forEach(recordAuthor);
        },
        async USER_PROFILE_FETCH_SUCCESS({ user }: { user: Author; }) {
            if (!isAllowed()) return;
            await Promise.resolve();
            const profile = UserProfileStore.getUserProfile(user.id);
            if (profile) record(user.id, { bio: profile.bio, banner: profile.banner });
        }
    }
});
