/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";
import { openModal, ModalRoot, ModalHeader, ModalContent, ModalFooter, ModalSize } from "@utils/modal";
import definePlugin, { makeRange } from "@utils/types";
import { MediaEngineStore, Menu, React, Slider, Text } from "@webpack/common";

// Fake displayed volumes per user (what Discord/observers see)
const fakeVolumes = new Map<string, number>();
// Real audio volumes per user (what actually plays)
const realVolumes = new Map<string, number>();

function getFakeVolume(userId: string): number {
    return fakeVolumes.get(userId) ?? 0;
}

function getRealVolume(userId: string): number {
    if (realVolumes.has(userId)) return realVolumes.get(userId)!;
    return MediaEngineStore.getLocalVolume(userId) ?? 100;
}

function setRealVolume(userId: string, volume: number) {
    realVolumes.set(userId, volume);
    MediaEngineStore.setLocalVolume(userId, volume);
}

function openRealVolumeModal(userId: string) {
    openModal(props => {
        const [vol, setVol] = React.useState(getRealVolume(userId));

        return (
            <ModalRoot {...props} size={ModalSize.SMALL}>
                <ModalHeader>
                    <Text variant="heading-lg/semibold">Real Volume</Text>
                </ModalHeader>
                <ModalContent style={{ padding: "16px 20px" }}>
                    <Text variant="text-md/normal" style={{ marginBottom: 12 }}>
                        Fake volume shown to observers: {getFakeVolume(userId)}%
                    </Text>
                    <Text variant="eyebrow" style={{ marginBottom: 8 }}>
                        Real Volume: {Math.round(vol)}%
                    </Text>
                    <Slider
                        initialValue={vol}
                        minValue={0}
                        maxValue={200}
                        markers={makeRange(0, 200, 25)}
                        stickToMarkers={false}
                        onValueChange={(v: number) => {
                            setVol(v);
                            setRealVolume(userId, v);
                        }}
                    />
                </ModalContent>
                <ModalFooter>
                    <Text variant="text-sm/normal" style={{ opacity: 0.6 }}>
                        Discord shows {getFakeVolume(userId)}% to screen captures. Audio plays at {Math.round(vol)}%.
                    </Text>
                </ModalFooter>
            </ModalRoot>
        );
    });
}

function patchVolumeMenu(children: any[], props: { user?: { id: string; }; }) {
    const userId = props.user?.id;
    if (!userId) return;

    const volumeGroup = findGroupChildrenByChildId("user-volume", children);
    const target = volumeGroup ?? children;

    const sliderIdx = target.findIndex(
        (c: any) => c?.props?.id === "user-volume"
    );

    if (sliderIdx === -1) return;

    const fakeVol = getFakeVolume(userId);

    // Replace the slider with a fake movable one that doesn't affect real audio
    target[sliderIdx] = (
        <Menu.MenuControlItem
            key="fake-volume"
            id="user-volume"
            label={`User Volume: ${fakeVol}`}
            control={(controlProps: any, ref: any) => (
                <Slider
                    {...controlProps}
                    ref={ref}
                    initialValue={fakeVol}
                    minValue={0}
                    maxValue={200}
                    onValueChange={(v: number) => {
                        fakeVolumes.set(userId, Math.round(v));
                        // Real audio is NOT changed — only the display updates
                    }}
                />
            )}
        />
    );

    // Add "Real Volume" item right after fake slider
    target.splice(sliderIdx + 1, 0, (
        <Menu.MenuItem
            key="real-volume"
            id="real-volume-spoof"
            label={`🔊 Real Volume: ${Math.round(getRealVolume(userId))}%`}
            action={() => openRealVolumeModal(userId)}
        />
    ));
}

export default definePlugin({
    name: "FakeVolumeSpoofer",
    description: "Spoofs the User Volume slider so observers see a fake value. Click the Real Volume item to set actual audio level hidden from screen captures.",
    authors: [EquicordDevs.nobody],
    dependencies: ["ContextMenuAPI"],

    contextMenus: {
        "user-context": patchVolumeMenu,
        "gdm-context": patchVolumeMenu,
        "group-dm-context": patchVolumeMenu,
    },

    stop() {
        fakeVolumes.clear();
        realVolumes.clear();
    }
});
