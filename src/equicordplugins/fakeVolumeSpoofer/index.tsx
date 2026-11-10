/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { openModal, ModalRoot, ModalHeader, ModalContent, ModalFooter, ModalSize } from "@utils/modal";
import definePlugin, { makeRange } from "@utils/types";
import { Text } from "@components/index";
import { ContextMenuApi, MediaEngineStore, Menu, React, Slider } from "@webpack/common";

const fakeVolumes = new Map<string, number>();
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
    ContextMenuApi.closeContextMenu();
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

    // Replace original slider with fake one + hidden trigger item above it
    target.splice(sliderIdx, 1,
        // Clicking "User Volume" opens the real volume modal
        <Menu.MenuItem
            key="fvs-trigger"
            id="fvs-trigger"
            label="User Volume"
            action={() => openRealVolumeModal(userId)}
        />,
        // Fake movable slider — display only, no effect on audio
        <Menu.MenuControlItem
            key="fvs-slider"
            id="user-volume"
            label=""
            control={(controlProps: any, ref: any) => (
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
            )}
        />
    );
}

export default definePlugin({
    name: "FakeVolumeSpoofer",
    description: "Spoofs the User Volume slider so observers see a fake value. Click the User Volume label to set the real hidden audio level.",
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
