/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { debounce } from "@shared/debounce";
import { identity } from "@utils/misc";
import { Margins } from "@utils/margins";
import { RenderModalProps } from "@vencord/discord-types";
import { Checkbox, Modal, Select, TextInput, UserStore } from "@webpack/common";

import { BADGE_CATALOG, BadgeDef, GIFT_TIERS, NITRO_TIERS } from "./badges";
import { publishProfile } from "./directory";
import { settings } from "./settings";

const FIELDS = ["username", "displayName", "avatarUrl", "bannerUrl", "simulateNitro", "badges", "nitroTier", "giftTier"] as const;

// Publishes the current fields so other $G/Private clients can see them too.
// Debounced so typing in a text field doesn't fire a request per keystroke.
const schedulePublish = debounce(() => {
    const id = UserStore.getCurrentUser()?.id;
    if (!id) return;
    publishProfile(id, {
        username: settings.store.username,
        displayName: settings.store.displayName,
        avatarUrl: settings.store.avatarUrl,
        bannerUrl: settings.store.bannerUrl,
        simulateNitro: settings.store.simulateNitro,
        badges: settings.store.badges,
        nitroTier: settings.store.nitroTier,
        giftTier: settings.store.giftTier
    });
}, 1200);

function TierSelect({ label, tiers, value, onChange }: { label: string; tiers: BadgeDef[]; value: string; onChange(v: string): void; }) {
    return (
        <div className={Margins.bottom16}>
            <Heading tag="h5" className={Margins.bottom8}>{label}</Heading>
            <Select
                options={[{ value: "", label: "None" }, ...tiers.map(t => ({ value: t.id, label: t.name }))]}
                serialize={identity}
                isSelected={v => v === value}
                select={onChange}
            />
        </div>
    );
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange(v: string): void; }) {
    return (
        <div className={Margins.bottom16}>
            <Heading tag="h5" className={Margins.bottom8}>{label}</Heading>
            <TextInput value={value} onChange={onChange} placeholder={placeholder} />
        </div>
    );
}

export function CustomProfileModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const { username, displayName, avatarUrl, bannerUrl, simulateNitro, badges, nitroTier, giftTier } = settings.use(FIELDS);

    const toggleBadge = (id: string) => {
        settings.store.badges = badges.includes(id) ? badges.filter(b => b !== id) : [...badges, id];
        schedulePublish();
    };

    return (
        <Modal
            {...modalProps}
            size="md"
            title="Custom Profile"
            subtitle="Visible to everyone on $G and Private, not just you."
            actions={[
                {
                    text: "Reset",
                    variant: "dangerPrimary",
                    onClick: () => {
                        settings.store.username = "";
                        settings.store.displayName = "";
                        settings.store.avatarUrl = "";
                        settings.store.bannerUrl = "";
                        settings.store.simulateNitro = false;
                        settings.store.badges = [];
                        settings.store.nitroTier = "";
                        settings.store.giftTier = "";
                        schedulePublish();
                    }
                },
                {
                    text: "Done",
                    variant: "primary",
                    onClick: modalProps.onClose
                }
            ]}
        >
            <Field label="Username" placeholder="Leave blank to use your real username" value={username} onChange={v => { settings.store.username = v; schedulePublish(); }} />
            <Field label="Display name" placeholder="Leave blank to use your real display name" value={displayName} onChange={v => { settings.store.displayName = v; schedulePublish(); }} />
            <Field label="Avatar URL" placeholder="Leave blank to use your real avatar" value={avatarUrl} onChange={v => { settings.store.avatarUrl = v; schedulePublish(); }} />
            <Field label="Banner URL" placeholder="Leave blank to use your real banner" value={bannerUrl} onChange={v => { settings.store.bannerUrl = v; schedulePublish(); }} />

            <Checkbox
                value={simulateNitro}
                onChange={(_event, checked) => { settings.store.simulateNitro = checked; schedulePublish(); }}
                type="row"
                className={Margins.bottom16}
            >
                Simulate Nitro (gradient glow on your name)
            </Checkbox>

            <Heading tag="h5" className={Margins.bottom8}>Badges</Heading>
            <Flex flexDirection="column" gap={4}>
                {BADGE_CATALOG.map(b => (
                    <Checkbox
                        key={b.id}
                        value={badges.includes(b.id)}
                        onChange={() => toggleBadge(b.id)}
                        type="row"
                    >
                        {b.name}
                    </Checkbox>
                ))}
            </Flex>

            <TierSelect label="Nitro badge" tiers={NITRO_TIERS} value={nitroTier} onChange={v => { settings.store.nitroTier = v; schedulePublish(); }} />
            <TierSelect label="Gifting badge" tiers={GIFT_TIERS} value={giftTier} onChange={v => { settings.store.giftTier = v; schedulePublish(); }} />
        </Modal>
    );
}
