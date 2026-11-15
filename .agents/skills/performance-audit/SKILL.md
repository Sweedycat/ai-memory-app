---
name: performance-audit
description: "Measure AI Memory rendering, search, serialization or resource bottlenecks using bounded synthetic workloads. Optimization edits require assigned implementation scope."
---

# Performance audit

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Define the user-visible symptom, metric, environment, dataset size and bounded resource budget. Inspect the relevant rendering/search/persistence path before choosing a measurement; no external profiling uploads or real records.
2. Authorized `performance_engineer` owns baseline, repeated measurements and attribution; `software_engineer` or `data_engineer` owns assigned corrections only when implementation is authorized. Avoid competing writers and speculative rewrites.
3. Record baseline conditions and variability, isolate one plausible bottleneck and compare equivalent before/after workloads. Preserve validation, ordering, features, intentionally empty data and failure-safe persistence. Prefer evidence-supported changes over unmeasured complexity.
4. For backup sizing, consult `docs/backup-security.md`: logical 3 GiB protocol simulations do not allocate or validate real large archives. Never raise in-memory limits to gigabytes; encrypted streaming/bounded staging and recovery require separately scoped implementation and review.

## Verification and completion

Report reproducible command/method, runtime/device, workload, samples, units and tradeoffs. Rerun functional checks for authorized changes. Distinguish host measurements from Android results; leave documented large-archive size/failure gates unverified without physical evidence. Finish with measured findings, confidence limits and an actionable narrow recommendation or verified improvement.
