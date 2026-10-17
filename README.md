# FoleyForge — The SFX Studio That Learns Your Taste

**SEPHacks 2026 submission** · solo build · $0 spent · 100% client-side

Describe a scene in plain words. FoleyForge synthesizes cinematic sound effects — impacts, risers, whooshes, ambiences, UI, foley, drones — entirely in your browser with procedural Web Audio synthesis. No samples, no API calls, no model weights.

Then rate what you hear. Every rating shifts your **taste vector**, and future generations sample near it. The studio literally evolves toward your sound — continual learning, no cloud required.

## Why it wins

- **Continual learning, for real.** Not a chatbot wrapper: the feedback loop *is* the product. Your ratings re-weight the parameter space, and you can watch the taste bars move.
- **Feasibility: it actually works.** Pure Web Audio — filtered noise, FM synthesis, pitch envelopes. Every variant renders to a real `AudioBuffer`, plays instantly, and downloads as a WAV.
- **Creativity.** A keyword engine interprets prompts ("massive thunder cracking over a neon city") into layered, mixed scenes.

## Run it

```bash
npx serve .
# open http://localhost:3000
```

Or use the deployed build. No build step, no dependencies, no keys.

## Architecture

- `index.html` — UI shell
- `styles.css` — dark studio design
- `app.js` — prompt parser, 7 procedural generators, OfflineAudioContext render pipeline, WAV encoder, taste-profile learner (localStorage)

## The learning loop

1. Parse prompt → base synthesis parameters
2. Generate 3 variants: 60% taste-mean + 40% fresh parse + jitter
3. User rates → exponential moving average updates the taste vector per category
4. Repeat — variants converge on the user's sound

Built within the SEPHacks 2026 timeframe (Oct 16–17, 2026).
