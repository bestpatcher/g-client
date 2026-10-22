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
    const filter = dev ? "hue-rotate(30deg) drop-shadow(0 0 6px #ff9500) drop-shadow(0 0 14px rgba(255, 149, 0, 0.75))" : "none";

    return `(() => {
        const text = ${JSON.stringify(text)};
        const style = document.createElement("style");
        style.textContent = "@keyframes gspin{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}#g-splash-logo{width:96px;height:96px;object-fit:contain;display:block;margin:0 auto;animation:gspin 2.4s linear infinite;filter:" + ${JSON.stringify(filter)} + "}";
        document.head.appendChild(style);

        const logo = document.createElement("img");
        logo.id = "g-splash-logo";
        logo.src = ${JSON.stringify(dev ? SHIELD : LOGO)};

        const apply = () => {
            const media = [...document.querySelectorAll("img, svg, video, canvas")].filter(e => e !== logo);
            media.forEach(e => { if (e.style.display !== "none") e.style.display = "none"; });

            if (!logo.isConnected) {
                const anchor = media[0] ?? document.body.firstElementChild;
                (anchor ? anchor.parentElement : document.body).insertBefore(logo, anchor);
            }

            const leaf = [...document.body.querySelectorAll("*")].find(e => !e.children.length && e.textContent.trim() && !["SCRIPT", "STYLE"].includes(e.tagName));
            if (leaf && leaf.textContent !== text) leaf.textContent = text;
        };

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
