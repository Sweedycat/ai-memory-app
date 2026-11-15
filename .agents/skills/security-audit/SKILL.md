---
name: security-audit
description: "Perform a read-only AI Memory security or independent critical-diff review covering authentication, cryptography, transfers and recovery. Remediation requires separate write scope."
---

# Security audit

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Bound the reviewed assets and threat model; record full commit and frozen diff/file hashes, including untracked files. Read `docs/backup-security.md` for backup/restore work and current source rather than treating historical status as proof.
2. An authorized read-only `security_engineer` examines trust boundaries, consent, App Lock, notification privacy, key/token handling, encrypted envelopes, endpoint validation and recovery. `independent_reviewer` may supply qualified independent review only when not an implementation author; disclose conflicts.
3. Check AGENTS Rules 04-06 invariants: external AES-256-GCM encryption, separate portable key recovery, bounded authenticated validation, snapshots and durable rollback. Preserve the owner's MVP local-encryption exception. No secrets, live accounts, penetration activity or actual memory transfers are needed for source review.
4. Trace failure/denial paths and compare tests with claimed guarantees. Report severity, precise file reference, impact, evidence and recommended correction; do not edit fixes or activate capabilities.

## Verification and completion

Use only authorized read-only checks; request artifact-producing tests from the writer. Record wrong-key/tampering, malformed input and recovery gaps as applicable. Finish with reviewed identity, findings or bounded no-findings result, evidence limitations and outstanding Rule 11 gates. Review does not authorize release or substitute for owner/device approval.
