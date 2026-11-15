---
name: github-ci
description: "Inspect or repair AI Memory GitHub Actions checks, reproducibility and workflow triggers. CI work does not authorize remote runs or EAS builds."
---

# GitHub CI

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Inspect `.github/workflows/`, `.eas/workflows/`, manifests and the exact failing command/ref before changing anything. `devops_engineer` owns assigned workflow edits; read-only `qa_engineer` evaluates coverage when authorized and needed.
2. Separate GitHub Node checks from EAS build workflows. Currently CI targets `main`/`preview`, main pushes can trigger EAS development builds and Preview builds use manual dispatch; reverify triggers before any remote action.
3. Compare local runtime/dependencies with CI's Node 22, Expo Doctor, typecheck and unit commands. `npm ci` installs packages; `npm run doctor` uses `npx expo-doctor@latest` and can fetch/install. Do not bootstrap these during an inspection without authorization.
4. Make narrow reproducibility fixes; preserve checks, permissions and failure reporting. Audit inventory is informational, not proof of resolved advisories. Do not expose secrets, raw payloads or owner records in logs/artifacts. No workflow dispatch, push, account access or permission expansion by implication.

## Verification and completion

Review YAML structure/triggers and diff locally with available tools; run applicable authorized checks. Remote evidence, if authorized, must identify repository, workflow, run, full commit and result. Finish with exact local/remote evidence, remaining failures and indirect-build risks. Passing local checks is not a successful remote run or release approval.
