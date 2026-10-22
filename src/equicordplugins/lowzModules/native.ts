/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR } from "@main/utils/constants";
import { fetchBuffer } from "@main/utils/http";
import { spawn } from "child_process";
import { createHash } from "crypto";
import { type IpcMainInvokeEvent } from "electron";
import { access, mkdir, readdir, readFile, rename, writeFile } from "fs/promises";
import { join } from "path";

import gitRemote from "~git-remote";

const PATCHER_HASH = "21b3c53dbf2b33468dfd4712702900cc11871aa9421c674b03db3e3434b91b5a";
const PATCHER_DIR = join(DATA_DIR, "GMTPatcher");
const PATCHER_PATH = join(PATCHER_DIR, "GMTPatcher.exe");

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

let cached: Promise<void> | null = null;

async function ensurePatcher() {
    if ((await exists(PATCHER_PATH)) && sha256(await readFile(PATCHER_PATH)) === PATCHER_HASH) return;

    const data = await fetchBuffer(`https://github.com/${gitRemote}/releases/download/v2/GMTPatcher.exe`);
    if (sha256(data) !== PATCHER_HASH) throw new Error("GMTPatcher.exe did not match the expected file.");

    await mkdir(PATCHER_DIR, { recursive: true });
    await writeFile(PATCHER_PATH, data);
}

export function prefetchPatcher() {
    cached ??= ensurePatcher().catch(() => { cached = null; });
}

export async function injectWithKey(_: IpcMainInvokeEvent, key: unknown, mode: unknown = "on") {
    if (typeof key !== "string" || !key.trim() || key.length > 200) return { success: false, error: "Enter a license key." };
    if (mode !== "on" && mode !== "off") return { success: false, error: "Invalid mode." };

    try {
        prefetchPatcher();
        await cached;

        const proc = spawn(PATCHER_PATH, [], { cwd: PATCHER_DIR, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
        proc.stdin.write(`${key.trim()}\r\n`);

        let output = "";
        let settled = false;
        let choseMode = false;

        return await new Promise<{ success: boolean; error?: string; }>(resolve => {
            const finish = (result: { success: boolean; error?: string; }) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(result);
            };

            const timer = setTimeout(() => {
                proc.kill();
                finish({ success: false, error: output.trim() ? `Timed out. Last output: ${output.trim().split("\n").pop()}` : "Timed out. The patcher never printed anything, it may not have started." });
            }, 5000);

            const onData = (chunk: Buffer) => {
                output += chunk.toString();

                if (!choseMode && /Choose 1 or 2/i.test(output)) {
                    choseMode = true;
                    proc.stdin.write(mode === "off" ? "2\r\n" : "1\r\n");
                }

                if (!/Press Enter to exit/i.test(output)) return;

                proc.stdin.write("\r\n");

                if (/License accepted/i.test(output) && !/was not valid/i.test(output)) {
                    finish({ success: true });
                } else {
                    const line = output.split("\n").map(l => l.trim()).reverse().find(l => l && !/Press Enter to exit/i.test(l));
                    finish({ success: false, error: line ?? "The patcher did not accept that key." });
                }
            };

            proc.stdout.on("data", onData);
            proc.stderr.on("data", onData);
            proc.on("error", e => finish({ success: false, error: e.message }));
            proc.on("exit", () => finish({ success: false, error: "The patcher closed unexpectedly." }));
        });
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message.replaceAll(process.resourcesPath, "") : "Something went wrong." };
    }
}
