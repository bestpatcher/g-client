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

    // nvd3dumx.dll loads inside Discord's own process — patch in-process, no elevation needed.
    // Unique anchor (verified against nvd3dumx.dll from NVIDIA App 11.0.9.565):
    //   48 8D 54 24 24 48 8B CD FF 15 ?? ?? ?? ?? 85 C0 74
    // Byte at anchor+16 is the JZ gating ShadowPlay capture; JZ→JMP disables it.
    const patchScript = `
if (-not ([System.Management.Automation.PSTypeName]'NvPatchSelf').Type) {
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class NvPatchSelf {
    [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint a, bool b, uint c);
    [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] buf, int n, out int r);
    [DllImport("kernel32.dll")] public static extern bool WriteProcessMemory(IntPtr h, IntPtr a, byte[] buf, int n, out int w);
    [DllImport("kernel32.dll")] public static extern bool VirtualProtectEx(IntPtr h, IntPtr a, uint n, uint np, out uint op);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
    [DllImport("psapi.dll")] public static extern bool EnumProcessModulesEx(IntPtr h, IntPtr[] m, uint cb, out uint needed, uint filter);
    [DllImport("psapi.dll")] public static extern uint GetModuleFileNameExW(IntPtr h, IntPtr mod, StringBuilder name, uint size);
    [DllImport("psapi.dll")] public static extern bool GetModuleInformation(IntPtr h, IntPtr mod, out MODULEINFO info, uint cb);
    [StructLayout(LayoutKind.Sequential)] public struct MODULEINFO { public IntPtr BaseOfDll; public uint SizeOfImage; public IntPtr EntryPoint; }
    public static int Patch(int pid, bool enable) {
        IntPtr hProc = OpenProcess(0x1F0FFF, false, (uint)pid);
        if (hProc == IntPtr.Zero) return -(int)Marshal.GetLastWin32Error();
        try {
            IntPtr[] mods = new IntPtr[1024]; uint needed = 0;
            if (!EnumProcessModulesEx(hProc, mods, (uint)(mods.Length * IntPtr.Size), out needed, 0x03)) return -2;
            IntPtr modBase = IntPtr.Zero; uint modSize = 0;
            int cnt = (int)(needed / IntPtr.Size);
            for (int k = 0; k < cnt; k++) {
                var sb = new StringBuilder(260);
                GetModuleFileNameExW(hProc, mods[k], sb, 260);
                if (sb.ToString().EndsWith("nvd3dumx.dll", StringComparison.OrdinalIgnoreCase)) {
                    MODULEINFO mi; GetModuleInformation(hProc, mods[k], out mi, (uint)Marshal.SizeOf(typeof(MODULEINFO)));
                    modBase = mi.BaseOfDll; modSize = mi.SizeOfImage; break;
                }
            }
            if (modBase == IntPtr.Zero) return -2;
            byte[] buf = new byte[(int)modSize]; int read = 0; uint op = 0;
            VirtualProtectEx(hProc, modBase, modSize, 0x20, out op);
            if (!ReadProcessMemory(hProc, modBase, buf, (int)modSize, out read)) return -3;
            VirtualProtectEx(hProc, modBase, modSize, op, out op);
            byte[] anc = { 0x48,0x8D,0x54,0x24,0x24,0x48,0x8B,0xCD,0xFF,0x15 };
            for (int i = 0; i < read - 18; i++) {
                bool ok = true; for (int j = 0; j < anc.Length; j++) if (buf[i+j] != anc[j]) { ok=false; break; }
                if (!ok || buf[i+14]!=0x85 || buf[i+15]!=0xC0 || buf[i+16]!=0x74) continue;
                IntPtr addr = new IntPtr(modBase.ToInt64() + i + 16);
                byte[] patch = enable ? new byte[]{0xEB} : new byte[]{0x74};
                int w = 0; VirtualProtectEx(hProc, addr, 1, 0x40, out op);
                WriteProcessMemory(hProc, addr, patch, 1, out w);
                VirtualProtectEx(hProc, addr, 1, op, out op); return 1;
            }
            return 0;
        } finally { CloseHandle(hProc); }
    }
}
"@
}
$r = [NvPatchSelf]::Patch(${process.pid}, $${enabled ? "true" : "false"})
Write-Output "patched=$([int]($r -eq 1)) code=$r"
`.trim();

    const patch = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", patchScript], {
        timeout: 30000, windowsHide: true, encoding: "utf8"
    });

    if (patch.error) return { success: false, error: "Patch failed: " + patch.error.message };

    const out = (patch.stdout ?? "").trim();
    const matchResult = out.match(/patched=(\d+)/);
    const count = matchResult ? parseInt(matchResult[1], 10) : 0;

    if (count === 0) {
        const detail = [out, (patch.stderr ?? "").trim()].filter(Boolean).join(" | ").slice(0, 300);
        return { success: false, error: `Nvidia Proof failed. ${detail || "No output."}` };
    }

    return { success: true };
}
