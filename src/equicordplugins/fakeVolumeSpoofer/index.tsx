/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { openModal, ModalRoot, ModalHeader, ModalContent, ModalFooter, ModalSize } from "@utils/modal";
import definePlugin, { makeRange } from "@utils/types";
import { Text } from "@components/index";
import { MediaEngineStore, Menu, React, Slider } from "@webpack/common";

// Fake displayed volumes per user (what Discord/observers see)
const fakeVolumes = new Map<string, number>();
// Real audio volumes per user (what actually plays)
const realVolumes = new Map<string, number>();

function getFakeVolume(userId: string): number {
    return fakeVolumes.get(userId) ?? 100;
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
                    <Text variant="eyebrow" style={{ marginBottom: 8 }}>
                        Volume: {Math.round(vol)}%
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
                        Fake slider shows {getFakeVolume(userId)}% — real audio plays at {Math.round(vol)}%.
                    </Text>
                </ModalFooter>
            </ModalRoot>
        );
    });
}

function findSliderIdx(arr: any[]): number {
    return arr.findIndex((c: any) => {
        if (!c?.props) return false;
        if (c.props.id === "user-volume") return true;
        if (typeof c.props.label === "string" && c.props.label.includes("Volume") && c.props.control) return true;
        return false;
    });
}

function patchVolumeMenu(children: any[], props: { user?: { id: string; }; }) {
    const userId = props.user?.id;
    if (!userId) return;

    let target: any[] = children;
    let sliderIdx = findSliderIdx(children);

    if (sliderIdx === -1) {
        for (const child of children) {
            const groupChildren = child?.props?.children;
            if (Array.isArray(groupChildren)) {
                const idx = findSliderIdx(groupChildren);
                if (idx !== -1) {
                    target = groupChildren;
                    sliderIdx = idx;
                    break;
                }
            }
        }
    }

    if (sliderIdx === -1) return;

    const fakeVol = getFakeVolume(userId);

    // Replace with a fake slider. Right-click the slider OR click the "User Volume"
    // label to open the hidden real volume modal. No visible extra menu item.
    target[sliderIdx] = (
        <Menu.MenuControlItem
            key="fake-volume"
            id="user-volume"
            label="User Volume"
            action={() => openRealVolumeModal(userId)}
            control={(controlProps: any, ref: any) => (
                <div
                    onContextMenu={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openRealVolumeModal(userId);
                    }}
                >
                    <Slider
                        {...controlProps}
                        ref={ref}
                        initialValue={fakeVol}
                        minValue={0}
                        maxValue={200}
                        onValueChange={(v: number) => {
                            fakeVolumes.set(userId, Math.round(v));
                        }}
                    />
                </div>
            )}
        />
    );
}

export default definePlugin({
    name: "FakeVolumeSpoofer",
    description: "Spoofs the User Volume slider so observers see a fake value. Click the label or right-click the slider to set the real hidden audio level.",
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
