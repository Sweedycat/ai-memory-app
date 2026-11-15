---
name: privacy-compliance
description: "Review AI Memory data minimization, purpose-specific consent, denial/revocation and privacy claims against project rules. This is an engineering review, not legal certification."
---

# Privacy compliance

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Map each relevant input, purpose, storage location, recipient, retention/deletion behavior and visible control from current source. Distinguish delivered local behavior from future AI, cloud, capture and wearable proposals.
2. An authorized read-only `security_engineer` reviews boundaries. `ui_ux_engineer` supplies consent/accessibility design evidence; `data_engineer` explains persistence/recovery where needed. Do not delegate broadly or edit flows during an audit.
3. Check separate opt-ins for camera, microphone, identity, glasses, location, contacts, files and external processing. OS permission alone is insufficient. Verify denial/revocation and App Lock failure paths without accessing real data; app phone fields must not write device Contacts or request its permission.
4. Check notification disclosure, diagnostics and exported information. Preserve local-first defaults, the MVP local-encryption exception and encrypted off-device backup requirements. Do not claim existing notifications are sanitized or AsyncStorage encrypted.

## Verification and completion

Produce a compact purpose/control/evidence/gap mapping. Inspect relevant synthetic tests and mark physical permission, lock and notification checks unverified unless observed. Finish with actionable project-policy findings, frozen reviewed identity where applicable, and independent Rule 11/owner gates for boundary changes. Legal questions require explicitly scoped authoritative research; do not invent jurisdictional compliance claims.
