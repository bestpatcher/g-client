/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { fetchBuffer } from "@main/utils/http";
import { createHash } from "crypto";
import { type IpcMainInvokeEvent } from "electron";
import { access, readdir, readFile, rename, writeFile } from "fs/promises";
import { join } from "path";

import gitRemote from "~git-remote";

const FILES = {
    "discord_voice.node": "61795e71867da74457d79fce45b6a5bf9477d9dbb28599b14906c6319352c47a",
    "openh264-2.6.0-win64.dll": "2076cb5675ec6c1a4c70e7a2a322552f547b6eeed649d6dfcd9e02a543b24691",
    "index.js": "4010f23e481d519b0054fdab6f9ada0d2d1380be232a8b1ececd10b868d0f104"
};

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const exists = (path: string) => access(path).then(() => true, () => false);

async function findVoiceFolder() {
    const modules = join(process.resourcesPath, "..", "modules");
    const folders = (await readdir(modules))
        .filter(name => /^discord_voice-\d+$/.test(name))
        .sort((a, b) => parseInt(b.split("-")[1]) - parseInt(a.split("-")[1]));

    for (const folder of folders) {
        const voice = join(modules, folder, "discord_voice");
        if (await exists(join(voice, "discord_voice.node"))) return voice;
    }

    throw new Error("Could not find the discord_voice folder.");
}

// A loaded file can't be overwritten on Windows, but it can be renamed out of the way.
async function moveAside(path: string, suffix: string) {
    if (await exists(path)) await rename(path, `${path}.${suffix}`);
}

export async function changeModules(_: IpcMainInvokeEvent) {
    try {
        const voice = await findVoiceFolder();
        const downloads: [string, Buffer][] = [];

        for (const [name, hash] of Object.entries(FILES)) {
            const data = await fetchBuffer(`https://github.com/${gitRemote}/releases/download/latest/${name}`);
            if (sha256(data) !== hash) return { success: false, error: `${name} did not match the expected file.` };
            downloads.push([name, data]);
        }

        for (const [name, data] of downloads) {
            const target = join(voice, name);
            if (await exists(target) && sha256(await readFile(target)) === FILES[name]) continue;

            if (await exists(`${target}.original`)) await moveAside(target, `${Date.now()}.old`);
            else await moveAside(target, "original");
            await writeFile(target, data);
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message.replaceAll(process.resourcesPath, "") : "Something went wrong." };
    }
}

export async function restoreModules(_: IpcMainInvokeEvent) {
    try {
        const voice = await findVoiceFolder();
        let restored = 0;

        for (const name of Object.keys(FILES)) {
            const target = join(voice, name);
            if (!await exists(`${target}.original`)) continue;

            await moveAside(target, `${Date.now()}.old`);
            await rename(`${target}.original`, target);
            restored++;
        }

        return restored ? { success: true } : { success: false, error: "There are no original files to restore." };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message.replaceAll(process.resourcesPath, "") : "Something went wrong." };
    }
}
