/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { identity } from "@utils/misc";
import { Margins } from "@utils/margins";
import { RenderModalProps } from "@vencord/discord-types";
import { Checkbox, Modal, Select, TextInput } from "@webpack/common";

import { BADGE_CATALOG, BadgeDef, GIFT_TIERS, NITRO_TIERS } from "./badges";
import { settings } from "./settings";

const FIELDS = ["username", "displayName", "avatarUrl", "bannerUrl", "simulateNitro", "badges", "nitroTier", "giftTier"] as const;

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
    };

    return (
        <Modal
            {...modalProps}
            size="md"
            title="Custom Profile"
            subtitle="Local to this client only, nobody else sees your real profile change."
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
                    }
                },
                {
                    text: "Done",
                    variant: "primary",
                    onClick: modalProps.onClose
                }
            ]}
        >
            <Field label="Username" placeholder="Leave blank to use your real username" value={username} onChange={v => { settings.store.username = v; }} />
            <Field label="Display name" placeholder="Leave blank to use your real display name" value={displayName} onChange={v => { settings.store.displayName = v; }} />
            <Field label="Avatar URL" placeholder="Leave blank to use your real avatar" value={avatarUrl} onChange={v => { settings.store.avatarUrl = v; }} />
            <Field label="Banner URL" placeholder="Leave blank to use your real banner" value={bannerUrl} onChange={v => { settings.store.bannerUrl = v; }} />

            <Checkbox
                value={simulateNitro}
                onChange={(_event, checked) => { settings.store.simulateNitro = checked; }}
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

            <TierSelect label="Evolving Nitro badge" tiers={NITRO_TIERS} value={nitroTier} onChange={v => { settings.store.nitroTier = v; }} />
            <TierSelect label="Gifting badge" tiers={GIFT_TIERS} value={giftTier} onChange={v => { settings.store.giftTier = v; }} />
        </Modal>
    );
}
