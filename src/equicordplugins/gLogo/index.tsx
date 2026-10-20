/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const LOGO = "https://equicord.org/assets/favicon.png";

export default definePlugin({
    name: "GLogo",
    description: "Replaces the Discord logo in the top left with the $G logo.",
    authors: [EquicordDevs.nobody],
    required: true,

    patches: [{
        find: "1.6 5.64-2.87",
        replacement: {
            match: /(?<=function \i\(\i\)\{)(?=.{0,500}?1\.6 5\.64-2\.87)/,
            replace: "return $self.logo(arguments[0]);"
        }
    }],

    logo({ width = 24, height = 24 }: { width?: number; height?: number; }) {
        return <img src={LOGO} width={width} height={height} alt="" />;
    }
});
