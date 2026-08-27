# AI Engineering Briefing

A provider-agnostic CLI pipeline that turns curated AI news into a source-grounded, two-host podcast script for undergraduate and graduate engineering students.

## MVP workflow

1. Ingest RSS/Atom feeds or a local fixture.
2. Rank and review candidate stories.
3. Manually approve or reject stories.
4. Generate a script of no more than ten minutes plus show notes and source metadata.

The bundled `template` provider makes the workflow testable without an API key. Future model integrations implement the interface in `src/providers/provider.ts`.

## Setup

Requires Node.js 22.5 or newer.

```bash
npm install
npm run build
```

## Try the complete workflow

```bash
npm run dev -- ingest --fixture fixtures/sample-feed.json
npm run dev -- review
npm run dev -- approve --ids 1,2
npm run dev -- generate
```

Generated files are written to a dated directory under `output/`:

- `script.md`
- `show-notes.md`
- `sources.json`

Use `npm run dev --` without a command to view CLI help.

## Live feeds

The default configuration includes verified public feeds for Simon Willison, Last Week in AI, Latent Space, Import AI, AlphaSignal, Practical AI, TWIML AI, Ben's Bites, AI Explained, and Product Hunt. View their status with:

```bash
npm run dev -- sources
```

Running `ingest` without `--fixture` fetches entries from enabled feeds inside the configured weekly or biweekly lookback window:

```bash
npm run dev -- ingest
```

TLDR AI is not configured because its current public website does not expose an accessible RSS/Atom endpoint. It will require a dedicated archive or email connector. Product Hunt is configured but disabled because its official feed covers all products rather than only its AI topic. It will be enabled after an AI-topic filter is added.

To add another source, copy an entry from `config/sources.example.json`, verify the publisher's current feed URL and usage terms, and set `enabled` to `true`.

## Configuration

`config/default.json` controls cadence, episode length, audience, storage, sources, and the selected model provider. Set `cadence` to `weekly` or `biweekly`. The maximum duration is intentionally capped at ten minutes.

## Current boundaries

- RSS and Atom metadata only; podcast transcription and YouTube captions come later.
- Manual selection is required before generation.
- Ranking is an explainable baseline, not yet cross-source clustering.
- The template provider produces a structural draft. A model-backed provider will provide the polished conversational script.
