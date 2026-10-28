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
    const patchScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class NvPatch {
    [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint a, bool b, uint c);
    [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] buf, int n, out int r);
    [DllImport("kernel32.dll")] public static extern bool WriteProcessMemory(IntPtr h, IntPtr a, byte[] buf, int n, out int w);
    [DllImport("kernel32.dll")] public static extern bool VirtualProtectEx(IntPtr h, IntPtr a, uint n, uint np, out uint op);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
}
"@
$pids = @(${pids.join(",")})
$enabled = $${enabled ? "true" : "false"}
$patched = 0
# Unique anchor: 48 8D 54 24 24 48 8B CD FF 15 (then 4-byte rel32) 85 C0 74
$anchor = [byte[]](0x48,0x8D,0x54,0x24,0x24,0x48,0x8B,0xCD,0xFF,0x15)
foreach ($pid in $pids) {
    $hProc = [NvPatch]::OpenProcess(0x1F0FFF, $false, $pid)
    if ($hProc -eq [IntPtr]::Zero) { continue }
    try {
        $proc = [System.Diagnostics.Process]::GetProcessById($pid)
        $mod = $proc.Modules | Where-Object { $_.ModuleName -eq "nvd3dumx.dll" } | Select-Object -First 1
        if (-not $mod) { continue }
        $base = $mod.BaseAddress
        $size = $mod.ModuleMemorySize
        $buf = New-Object byte[] $size
        $read = 0
        $oldProt = 0
        [NvPatch]::VirtualProtectEx($hProc, $base, $size, 0x20, [ref]$oldProt) | Out-Null
        if (-not [NvPatch]::ReadProcessMemory($hProc, $base, $buf, $size, [ref]$read)) { continue }
        [NvPatch]::VirtualProtectEx($hProc, $base, $size, $oldProt, [ref]$oldProt) | Out-Null
        for ($i = 0; $i -lt ($read - 18); $i++) {
            $match = $true
            for ($j = 0; $j -lt $anchor.Length; $j++) {
                if ($buf[$i+$j] -ne $anchor[$j]) { $match = $false; break }
            }
            if (-not $match) { continue }
            # anchor[10..13] = rel32 (wildcard), anchor+14 = 85, anchor+15 = C0, anchor+16 = 74
            if ($buf[$i+14] -ne 0x85 -or $buf[$i+15] -ne 0xC0 -or $buf[$i+16] -ne 0x74) { continue }
            $addr = [IntPtr]($base.ToInt64() + $i + 16)
            $patch = if ($enabled) { [byte[]](0xEB) } else { [byte[]](0x74) }
            $w = 0
            [NvPatch]::VirtualProtectEx($hProc, $addr, 1, 0x40, [ref]$oldProt) | Out-Null
            [NvPatch]::WriteProcessMemory($hProc, $addr, $patch, 1, [ref]$w) | Out-Null
            [NvPatch]::VirtualProtectEx($hProc, $addr, 1, $oldProt, [ref]$oldProt) | Out-Null
            $patched++
            break
        }
    } finally {
        [NvPatch]::CloseHandle($hProc) | Out-Null
    }
}
Write-Output "patched=$patched"
`.trim();

    const patch = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", patchScript], {
        timeout: 15000,
        windowsHide: true,
        encoding: "utf8"
    });

    if (patch.error) return { success: false, error: "Patch failed: " + patch.error.message };

    const patchOut = (patch.stdout ?? "").trim();
    const match = patchOut.match(/patched=(\d+)/);
    const count = match ? parseInt(match[1], 10) : 0;

    if (count === 0) {
        // Could be a permissions issue or driver version mismatch
        const stderr = (patch.stderr ?? "").trim();
        if (stderr.includes("Access") || stderr.includes("denied")) {
            return { success: false, error: "Access denied. Try running Discord as administrator for Nvidia Proof." };
        }
        return { success: false, error: "Could not find the patch location in nvd3dumx.dll. Your NVIDIA driver version may not be supported." };
    }

    return { success: true };
}
