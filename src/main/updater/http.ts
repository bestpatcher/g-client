/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { createHash } from "crypto";
import { writeFileSync } from "original-fs";
import { join } from "path";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { Updater } from ".";
import { ASAR_FILE } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
let PendingUpdate: string | null = null;
let PendingDigest: string | null = null;

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            // "All API requests MUST include a valid User-Agent header.
            // Requests with no User-Agent header will be rejected."
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

async function listUpdates() {
    const isOutdated = await fetchUpdate();
    if (!isOutdated) return [];

    const data = await githubGet(`/compare/${gitHash}...HEAD`);

    return data.commits.map((c: any) => ({
        hash: c.sha,
        author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
        message: c.commit.message.split("\n")[0]
    }));
}

async function fetchUpdate() {
    const data = await githubGet("/releases/tags/v2");

    const hash = data.name.slice(data.name.lastIndexOf(" ") + 1);
    if (hash === gitHash)
        return false;

    const asset = data.assets.find(a => a.name === ASAR_FILE);
    PendingUpdate = asset.browser_download_url;
    PendingDigest = asset.digest?.replace(/^sha256:/, "") ?? null;

    return true;
}

async function applyUpdate() {
    if (!PendingUpdate) return true;

    const data = await fetchBuffer(PendingUpdate);
    // GitHub's release asset CDN can briefly keep serving a stale cached copy of an
    // asset's URL after a new upload, so a successful download here is not on its own
    // proof the bytes are actually new. Check against the asset's own digest when GitHub
    // provides one, rather than silently installing whatever came back.
    if (PendingDigest && createHash("sha256").update(data).digest("hex") !== PendingDigest) {
        return false;
    }

    writeFileSync(join(__dirname, "..", ASAR_FILE), data, { flush: true });

    PendingUpdate = null;
    PendingDigest = null;

    return true;
}

const HttpUpdater: Updater = {
    getRepo: async () => `https://github.com/${gitRemote}`,
    listUpdates,
    fetchUpdate,
    applyUpdate
};

export default HttpUpdater;
