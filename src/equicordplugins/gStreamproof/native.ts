/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "original-fs";
import { join } from "path";
import { tmpdir } from "os";

export function toggle(_event: IpcMainInvokeEvent, enabled: unknown) {
    if (typeof enabled !== "boolean") return { success: false, error: "Invalid value." };

    const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === "Discord") ?? BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: "Discord window not found." };

    win.setContentProtection(enabled);
    return { success: true };
}

export function toggleNvidiaProof(_event: IpcMainInvokeEvent, enabled: unknown) {
    if (typeof enabled !== "boolean") return { success: false, error: "Invalid value." };

    // Find nvcontainer.exe PIDs (ShadowPlay lives here)
    let pids: number[] = [];
    try {
        const ps = spawnSync(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-Command",
                "(Get-Process -Name nvcontainer -ErrorAction SilentlyContinue).Id -join ','"],
            { timeout: 5000, windowsHide: true, encoding: "utf8" }
        );
        const out = (ps.stdout ?? "").trim();
        if (out) pids = out.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    } catch {
        return { success: false, error: "Could not enumerate nvcontainer.exe. Is NVIDIA installed?" };
    }

    if (pids.length === 0) return { success: false, error: "nvcontainer.exe not found. Make sure GeForce Experience is running." };

    // nvcontainer.exe runs at High integrity level; Discord runs at Medium.
    // We must elevate to get PROCESS_VM_WRITE access.
    // Strategy: write the patch script to a temp .ps1, launch it elevated
    // via Start-Process -Verb RunAs -Wait, write result to a temp output file,
    // then read that file back.
    const patchBody = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class NvPatch {
    [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint a, bool b, uint c);
    [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] buf, int n, out int r);
    [DllImport("kernel32.dll")] public static extern bool WriteProcessMemory(IntPtr h, IntPtr a, byte[] buf, int n, out int w);
    [DllImport("kernel32.dll")] public static extern bool VirtualProtectEx(IntPtr h, IntPtr a, uint n, uint np, out uint op);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
    [DllImport("psapi.dll")] public static extern bool EnumProcessModulesEx(IntPtr h, IntPtr[] mods, uint cb, out uint needed, uint filter);
    [DllImport("psapi.dll")] public static extern uint GetModuleFileNameExW(IntPtr h, IntPtr mod, StringBuilder name, uint size);
    [DllImport("psapi.dll")] public static extern bool GetModuleInformation(IntPtr h, IntPtr mod, out MODULEINFO info, uint cb);
    [StructLayout(LayoutKind.Sequential)] public struct MODULEINFO { public IntPtr BaseOfDll; public uint SizeOfImage; public IntPtr EntryPoint; }
    public static int PatchProcess(int pid, bool enable) {
        IntPtr hProc = OpenProcess(0x1F0FFF, false, (uint)pid);
        if (hProc == IntPtr.Zero) return -(int)Marshal.GetLastWin32Error();
        try {
            IntPtr modBase = IntPtr.Zero; uint modSize = 0;
            IntPtr[] mods = new IntPtr[1024]; uint needed = 0;
            if (!EnumProcessModulesEx(hProc, mods, (uint)(mods.Length * IntPtr.Size), out needed, 0x03)) return -2;
            int count = (int)(needed / IntPtr.Size);
            for (int k = 0; k < count; k++) {
                StringBuilder name = new StringBuilder(260);
                GetModuleFileNameExW(hProc, mods[k], name, 260);
                string fname = name.ToString();
                if (fname.EndsWith("nvd3dumx.dll", StringComparison.OrdinalIgnoreCase)) {
                    MODULEINFO info;
                    GetModuleInformation(hProc, mods[k], out info, (uint)Marshal.SizeOf(typeof(MODULEINFO)));
                    modBase = info.BaseOfDll; modSize = info.SizeOfImage; break;
                }
            }
            if (modBase == IntPtr.Zero) return -2;
            int size = (int)modSize;
            byte[] buf = new byte[size];
            int read = 0; uint oldProt = 0;
            VirtualProtectEx(hProc, modBase, modSize, 0x20, out oldProt);
            if (!ReadProcessMemory(hProc, modBase, buf, size, out read)) return -3;
            VirtualProtectEx(hProc, modBase, modSize, oldProt, out oldProt);
            byte[] anchor = new byte[] { 0x48,0x8D,0x54,0x24,0x24,0x48,0x8B,0xCD,0xFF,0x15 };
            for (int i = 0; i < read - 18; i++) {
                bool match = true;
                for (int j = 0; j < anchor.Length; j++) if (buf[i+j] != anchor[j]) { match = false; break; }
                if (!match) continue;
                if (buf[i+14] != 0x85 || buf[i+15] != 0xC0 || buf[i+16] != 0x74) continue;
                IntPtr addr = new IntPtr(modBase.ToInt64() + i + 16);
                byte[] patch = enable ? new byte[]{ 0xEB } : new byte[]{ 0x74 };
                int w = 0;
                VirtualProtectEx(hProc, addr, 1, 0x40, out oldProt);
                WriteProcessMemory(hProc, addr, patch, 1, out w);
                VirtualProtectEx(hProc, addr, 1, oldProt, out oldProt);
                return 1;
            }
            return 0;
        } finally { CloseHandle(hProc); }
    }
}
"@
$nvpids = @(PIDS_PLACEHOLDER)
$en = ENABLED_PLACEHOLDER
$patched = 0; $errors = @()
foreach ($nvpid in $nvpids) {
    $r = [NvPatch]::PatchProcess($nvpid, $en)
    if ($r -eq 1) { $patched++ } elseif ($r -lt 0) { $errors += "pid=$nvpid code=$r" }
}
Set-Content -Path "OUT_PLACEHOLDER" -Value "patched=$patched errors=$($errors -join ',')"
`.trim();

    let tmpDir: string;
    let ps1Path: string;
    let outPath: string;
    try {
        tmpDir = mkdtempSync(join(tmpdir(), "nvpatch-"));
        ps1Path = join(tmpDir, "patch.ps1");
        outPath = join(tmpDir, "result.txt");
    } catch (e: any) {
        return { success: false, error: "Could not create temp directory: " + e.message };
    }

    const script = patchBody
        .replace("PIDS_PLACEHOLDER", pids.join(","))
        .replace("ENABLED_PLACEHOLDER", enabled ? "$true" : "$false")
        .replace("OUT_PLACEHOLDER", outPath.replace(/\\/g, "\\\\"));

    try {
        writeFileSync(ps1Path, script, "utf8");
    } catch (e: any) {
        return { success: false, error: "Could not write patch script: " + e.message };
    }

    // Launch elevated — PowerShell Start-Process -Verb RunAs triggers UAC
    const launcher = spawnSync("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-Command",
        `$p = Start-Process powershell.exe -ArgumentList '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1Path}"' -Verb RunAs -PassThru; $p.WaitForExit(20000)`
    ], { timeout: 30000, windowsHide: true, encoding: "utf8" });

    let resultText = "";
    try { resultText = require("original-fs").readFileSync(outPath, "utf8").trim(); } catch {}
    try { unlinkSync(ps1Path); } catch {}
    try { unlinkSync(outPath); } catch {}
    try { require("original-fs").rmdirSync(tmpDir); } catch {}

    if (launcher.error) return { success: false, error: "Elevation failed: " + launcher.error.message };

    const matchResult = resultText.match(/patched=(\d+)/);
    const count = matchResult ? parseInt(matchResult[1], 10) : 0;

    if (count === 0) {
        const detail = [resultText, (launcher.stderr ?? "").trim()].filter(Boolean).join(" | ").slice(0, 300);
        return { success: false, error: `Nvidia Proof failed. ${detail || "UAC cancelled or no output."}` };
    }

    return { success: true };
}
