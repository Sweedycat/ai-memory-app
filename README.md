# AI Memory App

A phone-first personal and social memory assistant, designed to help people remember who they met, what they discussed, what matters about that person, and what should happen next.

## Current MVP

The repository now contains a working Expo / React Native prototype.

### What already works

- Search saved people by name, company, notes, relationship, or conversation text
- Add a new person
- Save role, company, relationship context, first memory, and follow-up
- Open a person profile
- Add new interaction notes to that person
- View interaction history
- Generate a local memory briefing such as “Who was this person?”
- Save people and interactions locally on the phone using AsyncStorage
- Automatic TypeScript checks through GitHub Actions

> The current “memory briefing” is a local prototype generated from saved information. A real AI model is not connected yet.

## Product direction

1. Phone MVP and reliable local memory capture
2. Cloud account + encrypted/safe sync
3. Real AI summaries and natural-language memory search
4. Voice capture and camera-assisted input with explicit user consent
5. Optional smart-glasses integration
6. B2B / CRM memory layer later

## Run it on Android with Expo Go

On the computer:

```bash
git clone https://github.com/Sweedycat/ai-memory-app.git
cd ai-memory-app
npm install
npx expo start --tunnel
```

Then open Expo Go on the Android phone and use the QR code or the Expo link shown in the terminal.

## Next development milestone

The next major layer is cloud sync and authentication. After that, the local briefing generator will be replaced with a real AI service that can answer natural-language questions using the user's stored memories.

## Privacy principle

The product should be user-controlled by default. Camera, voice, identity, and smart-glasses features should only operate with clear consent, visible controls, and appropriate privacy protections.

## Proposed Longplay boundary for cloud AI

This is an integration proposal for [the monetization direction in #7](https://github.com/Sweedycat/ai-memory-app/issues/7), not an implemented account, AI or purchase service. The current app remains local: `src/utils/buildMemoryBriefing.ts` derives a briefing on-device, `usePersistentPeople` owns local memories, and the owner profile is not a verified cloud identity. None of those paths should call billing or become purchase-gated.

| Existing or future boundary | Proposed responsibility |
| --- | --- |
| Local memories, search, briefing and reminders | Remain available offline, including after subscription expiry or a billing outage. |
| `PrivacyGate` and device owner profile | Device privacy only; never proof of a paid account or organization membership. |
| Future authenticated cloud API | Verify its own account session, resolve the stable account/workspace ID, and enforce authorization before calling a model. Keep provider/server keys here. |
| Longplay Customer binding | Resolve a namespaced account identity on the server. The phone must not choose an arbitrary billing Customer ID or grant itself a plan. |
| Online access observation | The scoped Customer/server SDK can check a configured access Feature. This does not establish monthly remaining allowance, renewals, a spend reservation or purchase completion. |
| Metered cloud work | Select and prove a supported atomic admission/settlement path before selling included allowances or top-ups. A read-only entitlement check cannot prevent concurrent overspending. |
| Purchase or restore | Use the applicable verified store flow and server reconciliation. Never grant access from a client flag or checkout return. Store product mapping remains a decision. |

Only opaque account/workspace references, Features and approved usage units belong in billing. People, relationship notes, memory text, audio, photos, device-unlock credentials and model keys do not. Stop only new cloud operations when access/allowance cannot be verified; existing local data and privacy controls remain usable.

Before enabling a cloud pilot, reconcile the Free/Plus/Pro/Premium/Business names and actual included allowances from #7, provide trusted cloud authentication, choose the verified purchase-to-entitlement mechanism, and establish explicit top-up consent and spending limits. Business seat assignment requires verified organization administrators; the local owner profile cannot act as one. No prices or unlimited-AI promise follow from this proposal.

The public Longplay npm SDK version evaluated for the proposal is 0.10.15. Its metadata declares `UNLICENSED`; public usage/distribution terms and maintainer adoption approval remain pending. No SDK dependency, backend, payment button or network call is added by this proposal.
