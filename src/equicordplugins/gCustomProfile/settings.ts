/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    username: { type: OptionType.CUSTOM, default: "" },
    displayName: { type: OptionType.CUSTOM, default: "" },
    avatarUrl: { type: OptionType.CUSTOM, default: "" },
    bannerUrl: { type: OptionType.CUSTOM, default: "" },
    simulateNitro: { type: OptionType.CUSTOM, default: false },
    badges: { type: OptionType.CUSTOM, default: [] as string[] },
    nitroTier: { type: OptionType.CUSTOM, default: "" },
    giftTier: { type: OptionType.CUSTOM, default: "" }
});
