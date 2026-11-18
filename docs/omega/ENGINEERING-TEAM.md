# Engineering team and skills

Principal Architect owns scope, architecture, integration, evidence, risks and
handoff. Existing definitions are in [.codex/agents](../../.codex/agents) and
[team configuration](../../.codex/README.md); this index changes none of them.

| Registered role | Bounded responsibility |
| --- | --- |
| `software_engineer` | Assigned app logic and integration |
| `data_engineer` | Persistence, schemas, compatibility and recovery |
| `android_engineer` | Expo/native lifecycle, permissions and upgrade safety |
| `ui_ux_engineer` | Phone interaction, accessibility and consent UX |
| `ai_engineer` | Grounded local briefing/search and authorized future AI design |
| `performance_engineer` | Measured latency, memory and bounded work |
| `devops_engineer` | CI/workflow and release-gate preparation |
| `wearables_engineer` | Explicitly scoped, opt-in future wearable interfaces |
| `security_engineer` | Read-only privacy/crypto/key/authentication review |
| `qa_engineer` | Read-only regression/test-evidence review |
| `independent_reviewer` | Read-only frozen-diff review, independent of implementation |

Use the smallest useful team when delegation is authorized; maximum two concurrent
specialists, no recursive delegation. One writer per file. Reviewers may not
write test artifacts. Inherited sandbox/permissions do not create a separately
enforced read-only environment. Role files and past discovery results do not
prove availability in every remote session. Do not reinstall or rerun completed
Omega infrastructure setup merely to resume.

## Existing repository skills

Read each selected skill before use; skills provide workflows, not authorization.

- Coordination and continuity: [omega-orchestrator](../../.agents/skills/omega-orchestrator/SKILL.md), [memory-continuity](../../.agents/skills/memory-continuity/SKILL.md).
- Application and diagnosis: [feature-development](../../.agents/skills/feature-development/SKILL.md), [bug-investigation](../../.agents/skills/bug-investigation/SKILL.md), [performance-audit](../../.agents/skills/performance-audit/SKILL.md).
- Evidence and safety: [automated-testing](../../.agents/skills/automated-testing/SKILL.md), [security-audit](../../.agents/skills/security-audit/SKILL.md), [privacy-compliance](../../.agents/skills/privacy-compliance/SKILL.md).
- Delivery gates: [github-ci](../../.agents/skills/github-ci/SKILL.md), [android-expo-build](../../.agents/skills/android-expo-build/SKILL.md), [release-management](../../.agents/skills/release-management/SKILL.md).
- Future scope only: [wearables-integration](../../.agents/skills/wearables-integration/SKILL.md).

AGENTS Rule 11 requires a separate qualified reviewer for critical changes;
review never replaces owner approval or native acceptance. No specialist was
needed for this documentation-only indexing task; Principal owns file-by-file
publication review. No new security implementation approval is claimed.

Subsequent Remote Control Phase 1 reused one Independent Reviewer for the frozen
management helper/tests/runbook/plan. See [TEST-STATUS](TEST-STATUS.md) for digest,
scope and evidence; no agent, skill, hook or permission configuration changed.
