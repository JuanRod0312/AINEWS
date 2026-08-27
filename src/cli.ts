#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { clusterStories } from "./clustering.js";
import { StoryStore } from "./database.js";
import { generateEpisode } from "./generate.js";
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
      ids: { type: "string" }
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
        console.log(`Ingested ${result.inserted}; skipped ${result.skipped} duplicate(s).`);
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
        const directory = await generateEpisode(
          config,
          createProvider(config.model.provider),
          clusterStories(visibleStories(store.list("approved"), config))
        );
        console.log(`Episode written to ${directory}`);
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
  console.log(`AI Engineering Briefing\n\nCommands:\n  sources\n  ingest [--fixture path]\n  review [--status pending|approved|rejected]\n  approve --ids 1,2       Approve cluster IDs\n  reject --ids 3,4        Reject cluster IDs\n  generate\n\nOptions:\n  --config path   Configuration file (default: config/default.json)`);
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
