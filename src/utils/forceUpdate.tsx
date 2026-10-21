/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Modal, openModal } from "@webpack/common";

import { relaunch } from "./native";

export function showForcedUpdate() {
    openModal(props => (
        <Modal {...props} onClose={() => { }} size="sm" title="Update" actions={[{ text: "Update", variant: "primary", onClick: relaunch }]}>
            <div style={{ padding: 16 }}>A new update is ready. Press Update to restart and install it.</div>
        </Modal>
    ), { onCloseRequest() { } });
}
