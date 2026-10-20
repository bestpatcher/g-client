/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { copyWithToast, fetchUserProfile } from "@utils/discord";
import { saveFile } from "@utils/web";
import definePlugin from "@utils/types";
import type { User } from "@vencord/discord-types";
import { IconUtils, Menu, showToast, UserProfileStore } from "@webpack/common";

async function save(url: string, name: string) {
    const blob = await fetch(url).then(res => res.blob());
    saveFile(new File([blob], `${name}.${blob.type.split("/")[1]}`, { type: blob.type }));
}

async function getBannerUrl(user: User) {
    const profile = UserProfileStore.getUserProfile(user.id) ?? await fetchUserProfile(user.id);
    if (profile?.banner) return IconUtils.getUserBannerURL({ id: user.id, banner: profile.banner, canAnimate: true, size: 4096 });
    showToast({ text: `${user.username} has no banner.`, variant: "critical", position: "bottom" });
}

export default definePlugin({
    name: "ProfileSaver",
    description: "Adds options to right click a user to save or copy their avatar and banner.",
    authors: [EquicordDevs.nobody],
    required: true,

    contextMenus: {
        "user-context"(children, { user }: { user?: User; }) {
            if (!user) return;

            const avatar = () => IconUtils.getUserAvatarURL(user, true, 4096);

            children.splice(-1, 0, (
                <Menu.MenuGroup>
                    <Menu.MenuItem id="vc-save-avatar" label="Save Avatar" action={() => save(avatar(), `${user.username}-avatar`)} />
                    <Menu.MenuItem id="vc-copy-avatar" label="Copy Avatar Link" action={() => copyWithToast(avatar(), "Avatar link copied.")} />
                    <Menu.MenuItem id="vc-save-banner" label="Save Banner" action={async () => {
                        const url = await getBannerUrl(user);
                        if (url) save(url, `${user.username}-banner`);
                    }} />
                    <Menu.MenuItem id="vc-copy-banner" label="Copy Banner Link" action={async () => {
                        const url = await getBannerUrl(user);
                        if (url) copyWithToast(url, "Banner link copied.");
                    }} />
                </Menu.MenuGroup>
            ));
        }
    }
});
