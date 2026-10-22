/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import type { BrowserWindow } from "electron";

import { RendererSettings } from "./settings";
import { LOGO, SHIELD } from "./splashAssets";

const logger = new Logger("GSplash");

function buildScript(dev: boolean) {
    const text = dev ? "Developer Mode.." : "Private $G Client..";

    return `(() => {
        const text = ${JSON.stringify(text)};
        const style = document.createElement("style");
        style.textContent = "@keyframes gspin{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}#g-splash-logo{position:fixed;z-index:1;width:88px;height:88px;left:calc(50% - 44px);object-fit:contain;animation:gspin 2.4s linear infinite}";
        document.head.appendChild(style);

        const logo = document.createElement("img");
        logo.id = "g-splash-logo";
        logo.src = ${JSON.stringify(dev ? SHIELD : LOGO)};

        const apply = () => {
            const media = [...document.querySelectorAll("img, svg, video, canvas")].filter(e => e !== logo);
            media.forEach(e => { if (e.style.display !== "none") e.style.display = "none"; });

            if (!logo.isConnected) document.body.appendChild(logo);

            const leaf = [...document.body.querySelectorAll("*")].find(e => e !== logo && !e.children.length && e.textContent.trim() && !["SCRIPT", "STYLE"].includes(e.tagName));
            if (!leaf) return;

            if (leaf.textContent !== text) leaf.textContent = text;
            logo.style.top = (leaf.getBoundingClientRect().top - 128) + "px";
        };

        window.addEventListener("resize", apply);
        new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        apply();
    })()`;
}

export function hookSplash(win: BrowserWindow) {
    win.webContents.on("dom-ready", () => {
        if (!/splash/i.test(win.webContents.getURL())) return;

        const dev = RendererSettings.store.plugins?.GLoading?.isDev === true;
        win.webContents.executeJavaScript(buildScript(dev)).catch(e => logger.error("Failed to restyle the splash window", e));
    });
}
