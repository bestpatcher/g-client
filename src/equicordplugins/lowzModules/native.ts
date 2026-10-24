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

const SETS = {
    lowz: {
        prefix: "",
        files: {
            "discord_voice.node": "61795e71867da74457d79fce45b6a5bf9477d9dbb28599b14906c6319352c47a",
            "openh264-2.6.0-win64.dll": "2076cb5675ec6c1a4c70e7a2a322552f547b6eeed649d6dfcd9e02a543b24691",
            "index.js": "4010f23e481d519b0054fdab6f9ada0d2d1380be232a8b1ececd10b868d0f104"
        } as Record<string, string>
    },
    stereo: {
        prefix: "stereo-",
        files: {
            "discord_voice.node": "a84e482176c9a39f22c473bd970f5762e492e2427546e0d60426d93749d31720",
            "gpu_encoder_helper.exe": "e631259dea71b6b54e4ee6bcbc687e47ebacc6ff3afbc3e46612e9a1758c2e64",
            "index.js": "ba28cf5fb12be26b99d836b5f28a91cc6879bc0a20d875393ec893fc1879208c",
            "manifest.json": "38eece999abffb6f3a32a0b4dbc4ff4eb428377d68c28ef7124baf79d50d5e4a",
            "mediapipe.dll": "b0eb7c4d2e4a211796ead7c0a78666940d4571c6c78cfa1eb9990a035ec107b3",
            "package.json": "4f35fd6a3f2046e09ecc02576752378eeb7cd7b48db490d3358111c27e808866",
            "selfie_segmentation.tflite": "9ee168ec7c8f2a16c56fe8e1cfbc514974cbbb7e434051b455635f1bd1462f5c",
            "selfie_segmentation_landscape.tflite": "a77d03f4659b9f6b6c1f5106947bf40e99d7655094b6527f214ea7d451106edd"
        } as Record<string, string>
    }
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

async function installSet(set: keyof typeof SETS) {
    const { prefix, files } = SETS[set];

    try {
        const voice = await findVoiceFolder();
        const downloads: [string, Buffer][] = [];

        for (const [name, hash] of Object.entries(files)) {
            const data = await fetchBuffer(`https://github.com/${gitRemote}/releases/download/v2/${prefix}${name}`);
            if (sha256(data) !== hash) return { success: false, error: `${name} did not match the expected file.` };
            downloads.push([name, data]);
        }

        for (const [name, data] of downloads) {
            const target = join(voice, name);
            if (await exists(target) && sha256(await readFile(target)) === files[name]) continue;

            if (await exists(`${target}.original`)) await moveAside(target, `${Date.now()}.old`);
            else await moveAside(target, "original");
            await writeFile(target, data);
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message.replaceAll(process.resourcesPath, "") : "Something went wrong." };
    }
}

export async function changeModules(_: IpcMainInvokeEvent) {
    return installSet("lowz");
}

export async function stereoDefault(_: IpcMainInvokeEvent) {
    return installSet("stereo");
}
