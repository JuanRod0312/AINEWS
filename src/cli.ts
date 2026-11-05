#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ElevenLabsClient, podcastPreview, synthesizePodcast } from "./audio.js";
import { loadConfig } from "./config.js";
import { clusterStories } from "./clustering.js";
import { StoryStore } from "./database.js";
import { buildEpisodeRequest, generateEpisode } from "./generate.js";
import { ingestFixture, ingestSources } from "./ingest.js";
import { createProvider } from "./providers/index.js";
import type { Story, StoryCluster } from "./types.js";

const [command, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: "string", default: "config/default.json" },
      fixture: { type: "string" },
      status: { type: "string" },
      ids: { type: "string" },
      episode: { type: "string" },
      date: { type: "string" },
      draft: { type: "boolean", default: false },
      yes: { type: "boolean", short: "y", default: false }
    },
    strict: true
  });
  const config = await loadConfig(values.config);
  const store = new StoryStore(config.databasePath);
  try {
    switch (command) {
      case "ingest": {
        const stories = values.fixture
          ? await ingestFixture(values.fixture)
          : await ingestSources(config.sources, lookbackDate(config.episode.cadence));
        const result = store.ingest(stories);
        console.log(`Ingested ${result.inserted}; refreshed ${result.updated} existing stor${result.updated === 1 ? "y" : "ies"}.`);
        break;
      }
      case "review": {
        printClusters(clusterStories(visibleStories(store.list(asStatus(values.status) ?? "pending"), config)));
        break;
      }
      case "sources": {
        for (const source of config.sources) {
          console.log(`${source.enabled ? "enabled " : "disabled"}  ${source.name}  ${source.url}`);
        }
        break;
      }
      case "voices": {
        const voices = await new ElevenLabsClient().listVoices();
        if (voices.length === 0) {
          console.log("No ElevenLabs voices are available to this account.");
          break;
        }
        for (const voice of voices) {
          const description = [voice.labels.gender, voice.labels.accent, voice.labels.use_case].filter(Boolean).join(", ");
          console.log(`${voice.voiceId}  ${voice.name}  ${voice.category}${description ? `  ${description}` : ""}`);
        }
        break;
      }
      case "approve":
      case "reject": {
        const ids = parseIds(values.ids);
        const status = command === "approve" ? "approved" : "rejected";
        const pendingClusters = clusterStories(visibleStories(store.list("pending"), config));
        const selected = pendingClusters.filter((cluster) => ids.includes(cluster.id));
        const missing = ids.filter((id) => !selected.some((cluster) => cluster.id === id));
        if (missing.length > 0) throw new Error(`Pending cluster IDs not found: ${missing.join(", ")}`);
        const storyIds = selected.flatMap((cluster) => cluster.stories.map((story) => story.id));
        console.log(`${store.setStatus(storyIds, status)} supporting stories across ${selected.length} cluster(s) marked ${status}.`);
        break;
      }
      case "generate": {
        const approved = clusterStories(visibleStories(store.list("approved"), config));
        const periodEnd = values.date ? parseEpisodeDate(values.date) : new Date();
        const request = buildEpisodeRequest(config, approved, periodEnd);
        printGenerationPreview(config, request);
        if (values.draft) {
          console.log("Draft preview only; no model request was made.");
          break;
        }
        if (!values.yes && config.model.provider !== "template") await confirmPaidRequest("Send this material to the configured model?");
        const directory = await generateEpisode(
          config,
          createProvider(config.model.provider, config.model.model),
          approved,
          periodEnd
        );
        console.log(`Episode written to ${directory}`);
        break;
      }
      case "synthesize": {
        const directory = values.episode ?? currentEpisodeDirectory(config);
        const script = await readFile(join(directory, "script.md"), "utf8");
        const preview = podcastPreview(script);
        console.log("\nAudio preview");
        console.log(`  Episode: ${directory}`);
        console.log(`  Provider: ${config.audio.provider}`);
        console.log(`  Model: ${config.audio.model}`);
        console.log(`  Format: ${config.audio.outputFormat}`);
        console.log(`  Host A voice: ${config.audio.hostAVoiceId || "not selected"}`);
        console.log(`  Host B voice: ${config.audio.hostBVoiceId || "not selected"}`);
        console.log(`  Dialogue: ${preview.turns} turns, ${preview.characters} billable characters\n`);
        if (values.draft) {
          console.log("Draft preview only; no ElevenLabs request was made.");
          break;
        }
        if (!values.yes) await confirmPaidRequest("Synthesize this episode with ElevenLabs?");
        console.log(`Podcast written to ${await synthesizePodcast(config, directory)}`);
        break;
      }
      default:
        printHelp();
        process.exitCode = command ? 1 : 0;
    }
  } finally {
    store.close();
  }
}

function parseIds(value: string | undefined): number[] {
  if (!value) throw new Error("Pass story IDs with --ids, for example --ids 1,2.");
  const ids = value.split(",").map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("Story IDs must be positive integers.");
  return ids;
}

function asStatus(value: string | undefined): Story["status"] | undefined {
  if (!value) return undefined;
  if (["pending", "approved", "rejected"].includes(value)) return value as Story["status"];
  throw new Error(`Invalid status "${value}".`);
}

function printClusters(clusters: StoryCluster[]): void {
  if (clusters.length === 0) {
    console.log("No story clusters found.");
    return;
  }
  for (const cluster of clusters) {
    const sources = [...new Set(cluster.stories.map((story) => story.source))];
    console.log(`\n[${cluster.id}] ${cluster.title}`);
    console.log(`    Score: ${cluster.score} | Status: ${cluster.status} | Sources: ${sources.length} | Articles: ${cluster.stories.length}`);
    console.log(`    Categories: ${cluster.categories.join(", ")}`);
    console.log(`    ${cluster.summary}`);
    for (const story of cluster.stories) console.log(`    - ${story.source}: ${story.url}`);
  }
}

function printHelp(): void {
  console.log(`AI Engineering Briefing\n\nCommands:\n  sources\n  voices                   List ElevenLabs voices and IDs\n  ingest [--fixture path]\n  review [--status pending|approved|rejected]\n  approve --ids 1,2       Approve cluster IDs\n  reject --ids 3,4        Reject cluster IDs\n  generate [--date YYYY-MM-DD] [--draft] [-y]\n  synthesize [--episode directory] [--draft] [-y]\n\nOptions:\n  --config path   Configuration file (default: config/default.json)\n  --date value    Coverage end date for generation (YYYY-MM-DD)\n  --episode path  Episode directory containing script.md\n  --draft         Preview generation or synthesis without a paid request\n  --yes, -y       Skip confirmation before a paid request`);
}

function printGenerationPreview(
  config: Awaited<ReturnType<typeof loadConfig>>,
  request: ReturnType<typeof buildEpisodeRequest>
): void {
  console.log("\nGeneration preview");
  console.log(`  Provider: ${config.model.provider}`);
  console.log(`  Model: ${config.model.model}`);
  console.log(`  Period: ${request.periodStart} through ${request.periodEnd}`);
  console.log(`  Target: ${request.minimumWords}-${request.maximumWords} words (~${config.episode.minimumMinutes}-${config.episode.maximumMinutes} minutes)`);
  console.log(`  Clusters: ${request.clusters.length}`);
  for (const cluster of request.clusters) {
    console.log(`    [${cluster.id}] ${cluster.title} (${cluster.stories.length} source article(s))`);
  }
  console.log("");
}

async function confirmPaidRequest(question: string): Promise<void> {
  if (!process.stdin.isTTY) throw new Error("Confirmation required. Re-run with --yes to make the model request.");
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`${question} [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) throw new Error("Generation cancelled.");
  } finally {
    terminal.close();
  }
}

function currentEpisodeDirectory(config: Awaited<ReturnType<typeof loadConfig>>): string {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  return join(config.outputDirectory, `${date}-${config.episode.cadence}`);
}

function parseEpisodeDate(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("Episode date must use YYYY-MM-DD format.");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
    throw new Error(`Invalid episode date "${value}".`);
  }
  return date;
}

function lookbackDate(cadence: "weekly" | "biweekly"): Date {
  const date = new Date();
  date.setDate(date.getDate() - (cadence === "biweekly" ? 14 : 7));
  return date;
}

function visibleStories(stories: Story[], config: Awaited<ReturnType<typeof loadConfig>>): Story[] {
  const disabled = new Set(config.sources.filter((source) => !source.enabled).map((source) => source.name));
  return stories.filter((story) => !disabled.has(story.source));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
