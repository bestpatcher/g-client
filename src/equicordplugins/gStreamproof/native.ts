/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { spawnSync } from "child_process";

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

    // Patch nvd3dumx.dll in each nvcontainer process.
    // Unique anchor (verified against nvd3dumx.dll from NVIDIA App 11.0.9.565):
    //   48 8D 54 24 24 48 8B CD FF 15 ?? ?? ?? ?? 85 C0 74 ??
    // The 74 at anchor+16 is the JZ that gates ShadowPlay capture.
    // Patching 74→EB (JZ→JMP) forces the skip branch unconditionally.
    // Scan is done in C# (via Add-Type) so it's fast even on a 44MB DLL.
    const patchScript = `
if (-not ([System.Management.Automation.PSTypeName]'NvPatch').Type) {
Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class NvPatch {
    [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint a, bool b, uint c);
    [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] buf, int n, out int r);
    [DllImport("kernel32.dll")] public static extern bool WriteProcessMemory(IntPtr h, IntPtr a, byte[] buf, int n, out int w);
    [DllImport("kernel32.dll")] public static extern bool VirtualProtectEx(IntPtr h, IntPtr a, uint n, uint np, out uint op);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
    public static int PatchProcess(int pid, bool enable) {
        IntPtr hProc = OpenProcess(0x1F0FFF, false, (uint)pid);
        if (hProc == IntPtr.Zero) return -1;
        try {
            Process proc = Process.GetProcessById(pid);
            ProcessModule mod = null;
            foreach (ProcessModule m in proc.Modules) {
                if (m.ModuleName.Equals("nvd3dumx.dll", StringComparison.OrdinalIgnoreCase)) { mod = m; break; }
            }
            if (mod == null) return -2;
            int size = mod.ModuleMemorySize;
            byte[] buf = new byte[size];
            int read = 0;
            uint oldProt = 0;
            VirtualProtectEx(hProc, mod.BaseAddress, (uint)size, 0x20, out oldProt);
            if (!ReadProcessMemory(hProc, mod.BaseAddress, buf, size, out read)) return -3;
            VirtualProtectEx(hProc, mod.BaseAddress, (uint)size, oldProt, out oldProt);
            // Anchor: 48 8D 54 24 24 48 8B CD FF 15 [4 bytes] 85 C0 74
            byte[] anchor = new byte[] { 0x48,0x8D,0x54,0x24,0x24,0x48,0x8B,0xCD,0xFF,0x15 };
            for (int i = 0; i < read - 18; i++) {
                bool match = true;
                for (int j = 0; j < anchor.Length; j++) if (buf[i+j] != anchor[j]) { match = false; break; }
                if (!match) continue;
                if (buf[i+14] != 0x85 || buf[i+15] != 0xC0 || buf[i+16] != 0x74) continue;
                IntPtr addr = new IntPtr(mod.BaseAddress.ToInt64() + i + 16);
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
}
$nvpids = @(${pids.join(",")})
$enabled = $${enabled ? "true" : "false"}
$patched = 0
$errors = @()
foreach ($nvpid in $nvpids) {
    $r = [NvPatch]::PatchProcess($nvpid, $enabled)
    if ($r -eq 1) { $patched++ }
    elseif ($r -lt 0) { $errors += "pid=$nvpid code=$r" }
}
Write-Output "patched=$patched errors=$($errors -join ',')"
`.trim();

    const patch = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", patchScript], {
        timeout: 30000,
        windowsHide: true,
        encoding: "utf8"
    });

    if (patch.error) return { success: false, error: "Patch failed: " + patch.error.message };

    const patchOut = (patch.stdout ?? "").trim();
    const matchResult = patchOut.match(/patched=(\d+)/);
    const count = matchResult ? parseInt(matchResult[1], 10) : 0;

    if (count === 0) {
        const stderr = (patch.stderr ?? "").trim();
        const detail = [patchOut, stderr].filter(Boolean).join(" | ").slice(0, 300);
        return { success: false, error: `Nvidia Proof failed. ${detail || "No output."}` };
    }

    return { success: true };
}
