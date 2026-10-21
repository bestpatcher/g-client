/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Alerts } from "@webpack/common";

let shown = false;

export default definePlugin({
    name: "GWelcome",
    description: "Shows a popup message with @du9 on discord every time Discord opens.",
    authors: [EquicordDevs.nobody],
    required: true,
    hidden: true,

    flux: {
        CONNECTION_OPEN() {
            if (shown) return;
            shown = true;
            Alerts.show({ title: "$G", body: "@du9 on discord", confirmText: "OK" });
        }
    }
});
