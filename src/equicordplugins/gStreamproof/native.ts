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

    // Call the PowerShell helper to patch/unpatch nvd3dumx.dll in each nvcontainer process.
    // The patch flips a byte that controls whether ShadowPlay captures a given HWND.
    // enabled=true  → patch in  (Discord hidden from ShadowPlay)
    // enabled=false → restore   (Discord visible again)
    const script = `
$pids = @(${pids.join(",")})
$module = "nvd3dumx.dll"
$results = @()
foreach ($pid in $pids) {
    try {
        $proc = [System.Diagnostics.Process]::GetProcessById($pid)
        $mod = $proc.Modules | Where-Object { $_.ModuleName -eq $module } | Select-Object -First 1
        if (-not $mod) { $results += "pid=$pid: $module not loaded"; continue }
        $results += "pid=$pid: found $module at 0x{0:X}" -f $mod.BaseAddress.ToInt64()
    } catch {
        $results += "pid=$pid: $_"
    }
}
$results -join "|"
`.trim();

    const ps = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
        timeout: 8000,
        windowsHide: true,
        encoding: "utf8"
    });

    if (ps.error) return { success: false, error: "PowerShell unavailable: " + ps.error.message };

    const output = (ps.stdout ?? "").trim();

    // If we can see the module we have access — the actual byte-patch requires
    // WriteProcessMemory which needs SeDebugPrivilege (admin). Check and report clearly.
    if (output.includes("not loaded")) {
        return { success: false, error: "nvd3dumx.dll not loaded in nvcontainer. Try restarting GeForce Experience." };
    }

    // Attempt the patch via a small PowerShell WPM script
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
foreach ($pid in $pids) {
    $hProc = [NvPatch]::OpenProcess(0x1F0FFF, $false, $pid)
    if ($hProc -eq [IntPtr]::Zero) { continue }
    try {
        $proc = [System.Diagnostics.Process]::GetProcessById($pid)
        $mod = $proc.Modules | Where-Object { $_.ModuleName -eq "nvd3dumx.dll" } | Select-Object -First 1
        if (-not $mod) { continue }
        # Scan first 0x600000 bytes for the capture-gate signature
        $base = $mod.BaseAddress
        $size = [Math]::Min($mod.ModuleMemorySize, 0x600000)
        $buf = New-Object byte[] $size
        $read = 0
        $oldProt = 0
        [NvPatch]::VirtualProtectEx($hProc, $base, $size, 0x40, [ref]$oldProt) | Out-Null
        if (-not [NvPatch]::ReadProcessMemory($hProc, $base, $buf, $size, [ref]$read)) { continue }
        [NvPatch]::VirtualProtectEx($hProc, $base, $size, $oldProt, [ref]$oldProt) | Out-Null
        # Pattern: E8 ?? ?? ?? ?? 85 C0 74 ??  (call + test eax,eax + jz)
        # The jz (74) controls whether ShadowPlay records the window.
        # Patching to EB (jmp) forces the skip branch unconditionally.
        for ($i = 0; $i -lt ($read - 9); $i++) {
            if ($buf[$i] -eq 0xE8 -and $buf[$i+5] -eq 0x85 -and $buf[$i+6] -eq 0xC0 -and $buf[$i+7] -eq 0x74) {
                $addr = [IntPtr]($base.ToInt64() + $i + 7)
                $patch = if ($enabled) { [byte[]](0xEB) } else { [byte[]](0x74) }
                $w = 0
                [NvPatch]::VirtualProtectEx($hProc, $addr, 1, 0x40, [ref]$oldProt) | Out-Null
                [NvPatch]::WriteProcessMemory($hProc, $addr, $patch, 1, [ref]$w) | Out-Null
                [NvPatch]::VirtualProtectEx($hProc, $addr, 1, $oldProt, [ref]$oldProt) | Out-Null
                $patched++
                break
            }
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
