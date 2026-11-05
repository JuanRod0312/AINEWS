# AI Engineering Briefing

A source-grounded CLI that turns curated AI publications into a manually reviewed, two-host podcast script for undergraduate and graduate engineering students.

The MVP collects recent feeds, refreshes publisher content, clusters related coverage, ranks developments, pauses for human approval, and generates a validated 5–10 minute script through a replaceable model provider. It ships with Gemini and offline template adapters.

## Why this exists

AI news is abundant but uneven. Research, product announcements, podcasts, policy analysis, and developer commentary frequently repeat one another or make claims with different levels of evidence. This project uses a small editorial pipeline instead of asking a model to summarize an unfiltered pile of links.

Core principles:

- A human chooses what enters an episode.
- Every story retains its source URLs.
- Educational value matters more than hype or volume.
- Provider-specific code remains isolated.
- Scripts outside 5–10 minutes are rejected.
- Missing clusters, unknown source IDs, and one-sided host dialogue are rejected.

## Pipeline

```text
RSS / Atom → SQLite → Cluster and rank → Human approval
           → Provider preview → Generate and validate
           → script.md + show-notes.md + sources.json
           → ElevenLabs preview → episode.mp3
```

## MVP capabilities

- Weekly and biweekly lookback windows
- RSS and Atom parsing with publisher-provided content
- SQLite persistence, URL deduplication, and content refresh
- Deterministic title-based clustering
- Learning-oriented and source-diversity ranking
- Manual cluster approval and rejection
- Provider-neutral generation with Gemini structured output
- Host A and Host B dialogue
- Hard 650–1,300 spoken-word range at 130 words per minute
- Source, cluster, host-participation, and word-count validation
- Native Node and Docker workflows

## Sources

The default configuration enables Simon Willison's Weblog, Last Week in AI, Latent Space, Import AI, AlphaSignal, Practical AI, The TWIML AI Podcast, Ben's Bites, and AI Explained.

Product Hunt is configured but disabled because its feed is not AI-specific. TLDR AI needs a dedicated archive or email connector because its public site does not expose an accessible feed. See [source coverage](docs/source-coverage.md).

## Docker quick start

Requirements:

- Docker Desktop or Docker Engine with Compose v2
- A Gemini API key for Gemini generation
- An ElevenLabs API key for MP3 synthesis

Build and smoke-test the production image:

```bash
docker compose build ainews
npm run docker:smoke
```

The smoke check lists configured sources. It does not fetch feeds or call Gemini.

### Editorial workflow

```bash
# Fetch or refresh recent stories
docker compose run --rm ainews ingest --config config/editorial.json

# Review pending clusters
docker compose run --rm ainews review --config config/editorial.json

# Approve and reject cluster IDs
docker compose run --rm ainews approve --ids 11,12,1,10 --config config/editorial.json
docker compose run --rm ainews reject --ids 3,4 --config config/editorial.json

# Preview without an API request
docker compose run --rm ainews generate --draft --config config/editorial.json

# Generate intentionally in a one-shot container
docker compose run --rm ainews generate --yes --config config/editorial.json

# Preview audio cost inputs, then synthesize the reviewed script
docker compose run --rm ainews synthesize --draft --config config/editorial.json
docker compose run --rm ainews synthesize --yes --config config/editorial.json
```

Omit `--yes` in an interactive terminal when you want the confirmation prompt.

### Persistence and security

| Host path | Container path | Purpose |
| --- | --- | --- |
| `config/` | `/app/config` | Read-only configuration |
| `fixtures/` | `/app/fixtures` | Read-only samples |
| `data/` | `/app/data` | Persistent SQLite databases |
| `output/` | `/app/output` | Persistent generated episodes |

The runtime container runs as the unprivileged `node` user, has a read-only root filesystem, drops all Linux capabilities, prevents privilege escalation, and exposes no ports. Secrets, databases, and generated output are excluded from the image.

## Gemini credentials

Never put an API key in source code or JSON configuration. Create the ignored environment file:

```bash
cp .env.example .env
```

Edit `.env` with no spaces around `=`:

```dotenv
GEMINI_API_KEY=your_actual_key_here
ELEVENLABS_API_KEY=your_actual_key_here
```

Compose reads the root `.env` file and passes only the two API keys into the container. `.env` is ignored by Git and the Docker build context.

## ElevenLabs voices and audio

Keep the ElevenLabs key only in the ignored root `.env` file. To see the voices available to your account and their IDs:

```bash
npm run dev -- voices --config config/editorial.json
```

Choose two distinct voices, then set them in `config/editorial.json`:

```json
"audio": {
  "hostAVoiceId": "your_host_a_voice_id",
  "hostBVoiceId": "your_host_b_voice_id"
}
```

Preview the number of dialogue turns and billable characters before making a request, then create the MP3:

```bash
npm run dev -- synthesize --draft --config config/editorial.json
npm run dev -- synthesize --config config/editorial.json
```

Use `--episode output/YYYY-MM-DD-weekly` to synthesize a directory other than today's episode. The ElevenLabs model and MP3 format are inherited from `config/default.json` and can be overridden in the editorial config.

The editorial config selects stable `gemini-2.5-flash`, used as a reliable fallback after newer Flash endpoints returned temporary high-demand errors. Change `model.model` in `config/editorial.json` to test another compatible Gemini model.

## Native Node setup

Requires Node.js 22.5+ and npm 10+.

```bash
npm install
npm run typecheck
npm test
npm run build
```

Run natively:

```bash
npm run dev -- ingest --config config/editorial.json
npm run dev -- review --config config/editorial.json
npm run dev -- approve --ids 11,12 --config config/editorial.json
npm run dev -- generate --draft --config config/editorial.json
npm run dev -- generate --config config/editorial.json
```

The last command asks for confirmation before contacting Gemini.

## CLI reference

```text
sources
    List configured sources and their enabled state.

ingest [--fixture path]
    Fetch enabled feeds for the lookback period, or ingest a fixture.

review [--status pending|approved|rejected]
    Display ranked clusters and all underlying source URLs.

approve --ids 1,2
reject --ids 3,4
    Apply a manual decision to clusters and their supporting stories.

generate [--date YYYY-MM-DD] [--draft] [--yes]
    Preview or generate from approved clusters.

    Use `--date` when regenerating an earlier edition so its coverage period and output directory remain stable.

voices
    List the ElevenLabs voices and IDs available to the configured account.

synthesize [--episode directory] [--draft] [--yes]
    Preview or synthesize a generated two-host script as episode.mp3.

--config path
    Select configuration; defaults to config/default.json.
```

## Configuration

`config/default.json` defines sources, cadence, duration, audience, storage, and the offline provider. `config/editorial.json` inherits it, selects a separate database, and switches to Gemini.

```json
{
  "episode": {
    "cadence": "weekly",
    "minimumMinutes": 5,
    "maximumMinutes": 10,
    "maximumMainStories": 4,
    "wordsPerMinute": 130
  }
}
```

Use `biweekly` for a fourteen-day lookback; `weekly` uses seven days.

## Editorial behavior

Scoring considers technical categories, descriptive detail, research/release signals, and source diversity. Independent corroboration increases a cluster score; repeated posts from one publisher do not. Clustering is deterministic and title-based so review does not depend on a model. See [clustering details](docs/clustering.md).

The generation prompt requests educational depth through definitions, engineering mechanisms, cause and effect, supported comparisons, and limitations. It prohibits padding, invented experiences, unsupported facts, and acronym expansions absent from source material.

## Generated artifacts

```text
output/YYYY-MM-DD-weekly/
├── script.md
├── show-notes.md
├── sources.json
└── episode.mp3
```

- `script.md`: recording-ready dialogue
- `show-notes.md`: sources grouped by development
- `sources.json`: selected clusters and story metadata
- `episode.mp3`: two-host ElevenLabs audio (after synthesis)

`output/` and `data/` are intentionally ignored by Git.

## Provider architecture

Adapters implement `LanguageModelProvider` in `src/providers/provider.ts`. Ingestion, clustering, review, and rendering do not depend on Gemini.

- `template`: deterministic offline generation for development and tests
- `gemini`: structured model-backed generation

Add a provider by implementing the interface and registering it in `src/providers/index.ts`.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run docker:build
npm run docker:smoke
```

Tests cover clustering, corroboration, database refresh, structured rendering, cluster completeness, source citations, duration enforcement, and two-host generation.

## Troubleshooting

### Missing API key

Confirm `.env` exists at the repository root and contains `GEMINI_API_KEY=your_key`. A key change does not require rebuilding the image.

For voice listing and synthesis, also confirm it contains `ELEVENLABS_API_KEY=your_key`. Never put either key in JSON configuration or source code.

### Gemini HTTP 503 or `UNAVAILABLE`

The selected model is under temporary demand. Wait and retry, or choose another stable structured-output-capable model. Failed generation does not overwrite an episode.

### No approved clusters

Run `review`, then approve pending cluster IDs using the same configuration.

### Docker file ownership

The image uses its `node` user. Linux hosts with strict UID mapping may set Compose `user` to the host UID/GID or adjust ownership of `data/` and `output/`.

### Script below five minutes

The result is rejected before files are written. Refresh feeds for richer content or approve more substantive stories rather than lowering the minimum.

## Current boundaries

The MVP now produces a reviewed script and an optional two-voice MP3. Podcast transcription, YouTube captions, arbitrary page extraction, music, visuals, publishing, a web dashboard, and semantic clustering remain later stages.

## Development guidance

- Keep secrets out of Git and images.
- Preserve manual approval as the editorial gate.
- Prefer primary sources when adding feeds.
- Re-run verification after prompt, schema, clustering, or provider changes.
- Treat model output as an editorial draft even after structural validation.

More detail: [source coverage](docs/source-coverage.md), [clustering](docs/clustering.md), and [Gemini provider](docs/gemini-provider.md).
