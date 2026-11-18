# Tone

Sound like a native: real videos in, real conversations out. A laptop-first web app for an
advanced English speaker who wants the short, natural phrases Americans actually use.

Spec: see the "Tone — Product & Design Spec" doc. This is v1.

## Run it on your Mac

You need [Node.js](https://nodejs.org) 20 or newer and Chrome.

```bash
npm install
cp .env.example .env.local   # then paste your Gemini API key into .env.local
npm run dev
```

Open http://localhost:3000 in **Chrome** (voice input uses Chrome's speech recognition).

## What's in v1

| Area | What it does |
| --- | --- |
| Today | One suggested session, continue watching, phrase of the day, this week's balance across the four dimensions |
| Talk | 6 everyday Scenes (coffee shop, restaurant, bar, rideshare, gym, small talk) with twist libraries and coverage, plus free topics. Hold Space to talk; the partner answers out loud. "Say it more natively" (or N) on any of your turns, Hint, ⌘K, and a recap at the end |
| Find the phrase (⌘K) | Describe it long, get 2–3 native ways to say it, shortest first |
| Watch | Paste a YouTube link → captions as an interactive transcript. Loop, 0.5–1.0× speed, select words to look up and save. Shadow mode: listen, record, compare. If YouTube won't give captions, paste the transcript from YouTube's "Show transcript" panel |
| Notebook | Collections by type, source, dimension and your own lists; full phrase cards; "I used this in real life" |
| Review | Spaced repetition (FSRS) with Echo, Recall, Pick and Shorten cards |
| Settings | AI voice and speed, review size, video speed, recordings (ask / always discard), light / dusk / auto, export / import |

## Where things live

- Your data stays in the browser (IndexedDB). Export a backup from Settings now and then.
- AI calls go through `src/app/api/ai` → `src/lib/server/llm.ts` (switch providers with `.env.local`).
- Prompts: `src/lib/server/tasks.ts`. Scenes and twists: `src/lib/scenes.ts`.
- Voices: the browser's built-in American voices (pick one in Settings; on macOS, "Samantha" or a
  downloaded Siri/enhanced voice sounds best — System Settings → Accessibility → Spoken Content → Manage Voices).
