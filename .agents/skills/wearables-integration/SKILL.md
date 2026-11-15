---
name: wearables-integration
description: "Design or review explicitly scoped future AI Memory glasses/wearable interfaces and synthetic contracts. Does not activate hardware, capture or external processing."
---

# Wearables integration

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Identify the requested device/interface, phone boundary, data flow and success/failure criteria. Treat wearables as future product direction; inspect current implementation before making delivery claims.
2. Authorized `wearables_engineer` owns contracts, lifecycle, latency/battery budgets and disconnect behavior. `android_engineer` reviews phone/native boundaries, `ui_ux_engineer` visible controls and read-only `security_engineer` consent/transfer risks only when needed.
3. Default to fabricated contracts and bounded simulation. Keep camera, microphone, identity, glasses and location behind separate justified opt-ins, visible activity controls and safe denial/revocation. Preserve phone-first local functionality when hardware disconnects or permission changes.
4. Do not pair devices, install SDKs, capture media, link accounts, identify people or transfer memories without task-specific authorization and user consent. Avoid speculative dependencies. Keep critical boundaries disabled until independent Rule 11 review, tests and owner approval.

## Verification and completion

Exercise fabricated connect/disconnect, denial/revocation, interruption, stale-input and bounded-resource cases at the contract level. Report simulated evidence separately from authorized physical hardware tests. Finish with scoped architecture/contracts, compatibility assumptions, risks and hardware/security gates; never label a design or mock a delivered integration.
