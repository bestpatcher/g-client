/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { Menu, showToast, SpotifyStore } from "@webpack/common";

function share(channelId: string) {
    const track = SpotifyStore.getTrack();
    if (track?.id == null) {
        return showToast({ text: "You're not listening to any music.", variant: "critical", position: "bottom" });
    }

    sendMessage(channelId, { content: `https://open.spotify.com/track/${track.id}` });
}

export default definePlugin({
    name: "SpotifyShare",
    description: "Adds a Share Spotify Song option to the plus menu next to the message box.",
    authors: [EquicordDevs.nobody],
    required: true,

    contextMenus: {
        "channel-attach"(children, { channel }: { channel: Channel; }) {
            children.push(<Menu.MenuItem id="vc-share-spotify" label="Share Spotify Song" action={() => share(channel.id)} />);
        }
    }
});
