# Engineering decision log

This is an index of approved decisions, not new financial/legal approval.
Existing policies remain intact. Snapshot: 2026-11-18 UTC.

| ID | Decision | Authoritative source / boundary |
| --- | --- | --- |
| D01 | Local-first, standalone product value; preserve existing data and functionality | [AGENTS 01-04](../../AGENTS.md); no fabricated memories or silent reset |
| D02 | Dedicated current development branch; no main/preview promotion from this task | Owner's current synchronization scope and [AGENTS 17](../../AGENTS.md) |
| D03 | GitHub is the versioned engineering knowledge center; public-safe documentation only | Owner's synchronization directive; [INDEX update/publication policy](INDEX.md) |
| D04 | Financial and multi-platform payment policies are preserved; live paid integrations remain off | [Financial policy](../financial-policy.md), [payment strategy](../payment-strategy.md); do not duplicate confidential business planning here |
| D05 | Existing people AsyncStorage is not app-encrypted; preserve the owner's MVP exception | [AGENTS 04](../../AGENTS.md); Notebook's separate encrypted design is not a blanket people migration |
| D06 | Off-device backups require encryption, explicit consent and separate recoverable keys | [Backup security](../backup-security.md), [AGENTS 05-06](../../AGENTS.md); real backup/restore remains unactivated |
| D07 | Notebook source work stays behind a false production gate until acceptance/approval | [Foundation](../notebook-production-foundation-validation.md), [editor](../notebook-editor-recovery-validation.md), [navigation](../notebook-navigation-validation.md), [Android plan](../android-notebook-acceptance-plan.md) |
| D08 | Critical changes require independent qualified review; tests/CI are not physical acceptance | [AGENTS 09-11](../../AGENTS.md) |
| D09 | One writer per file, smallest authorized team, at most two concurrent specialists | [AGENTS 12-13](../../AGENTS.md), [.codex configuration](../../.codex/config.toml); no recursive delegation |
| D10 | No arbitrary remote command bridge, service purchase, build or release in this task | Owner's current scope; [REMOTE-CONTROL](REMOTE-CONTROL.md) distinguishes proposals from capabilities |
| D11 | Phase 1 reuses authenticated native Remote/App tools plus a separate on-demand read-only projection helper | Owner's Phase 1 scope; [CONTROL-CENTER](CONTROL-CENTER.md). No new listener, credentials, daemon configuration, account-data publication or automatic resume |
| D12 | Phase 2 prepares independent environments with GitHub checkpoints, one writer/file and advisory conflict checks | [Unified workspace](UNIFIED-WORKSPACE.md); preserve at least 10% weekly reserve, prepare at 15%. No automatic sync/lock/Cloud activation, configuration weakening or device/install operations |

## Unresolved, not decided here

The third visible-version position and Android versionCode wording differ across
existing policy sections. Preserve both statements; do not infer a resolution
from code or document order. Current source labels are not approval to build an
update. Provider terms, commercial prices and future entitlements also require
their existing separate evidence/owner gates. No new provider choice is made.

Future entries should record date, decision owner/source, scope, affected evidence
and supersession explicitly. Never append private conversations or raw prompts.
