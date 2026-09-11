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
