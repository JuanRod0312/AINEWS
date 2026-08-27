# AI Engineering Briefing

A provider-agnostic CLI pipeline that turns curated AI news into a source-grounded, two-host podcast script for undergraduate and graduate engineering students.

## MVP workflow

1. Ingest RSS/Atom feeds or a local fixture, retaining richer publisher-provided content when available.
2. Cluster related coverage and rank developments using learning value and source diversity.
3. Manually approve or reject story clusters.
4. Generate a script between five and ten minutes plus show notes and source metadata.

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

## Gemini editorial workflow

`config/editorial.json` inherits the default feeds and episode settings, uses a separate `data/editorial.db`, and selects Gemini 2.5 Flash. Ingest and review without needing an API key:

```bash
npm run dev -- ingest --config config/editorial.json
npm run dev -- review --config config/editorial.json
npm run dev -- approve --ids 1,2 --config config/editorial.json
npm run dev -- generate --draft --config config/editorial.json
```

The draft command prints the exact provider, model, period, word limit, and selected clusters without calling Gemini. When ready for a live request, copy `.env.example` to `.env`, set `GEMINI_API_KEY`, and run:

```bash
npm run dev -- generate --config config/editorial.json
```

The CLI asks for confirmation before sending source material to Gemini. Pass `--yes` only in an intentional non-interactive run.

## Live feeds

The default configuration includes verified public feeds for Simon Willison, Last Week in AI, Latent Space, Import AI, AlphaSignal, Practical AI, TWIML AI, Ben's Bites, AI Explained, and Product Hunt. View their status with:

```bash
npm run dev -- sources
```

Running `ingest` without `--fixture` fetches entries from enabled feeds inside the configured weekly or biweekly lookback window:

```bash
npm run dev -- ingest
```

Re-ingestion refreshes existing URLs with current titles, summaries, publisher-provided content, categories, and scores. It does not create duplicate stories.

TLDR AI is not configured because its current public website does not expose an accessible RSS/Atom endpoint. It will require a dedicated archive or email connector. Product Hunt is configured but disabled because its official feed covers all products rather than only its AI topic. It will be enabled after an AI-topic filter is added.

Entries from disabled configured sources remain in SQLite for provenance but are hidden from review and generation.

To add another source, copy an entry from `config/sources.example.json`, verify the publisher's current feed URL and usage terms, and set `enabled` to `true`.

## Configuration

`config/default.json` controls cadence, episode length, audience, storage, sources, and the selected model provider. Set `cadence` to `weekly` or `biweekly`. Scripts must contain at least five minutes of spoken dialogue and are capped at ten minutes.

## Current boundaries

- RSS and Atom summaries and publisher-provided content; podcast transcription and YouTube captions come later.
- Manual selection is required before generation.
- Clustering is deterministic title similarity; semantic model-assisted clustering can be added later.
- The Gemini provider uses structured output and validates cluster coverage, source IDs, both-host participation, and spoken word count before writing files.
