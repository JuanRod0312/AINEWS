#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { StoryStore } from "./database.js";
import { generateEpisode } from "./generate.js";
import { ingestFixture, ingestSources } from "./ingest.js";
import { createProvider } from "./providers/index.js";
import type { Story } from "./types.js";

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
          : await ingestSources(config.sources);
        const result = store.ingest(stories);
        console.log(`Ingested ${result.inserted}; skipped ${result.skipped} duplicate(s).`);
        break;
      }
      case "review": {
        printStories(store.list(asStatus(values.status) ?? "pending"));
        break;
      }
      case "approve":
      case "reject": {
        const ids = parseIds(values.ids);
        const status = command === "approve" ? "approved" : "rejected";
        console.log(`${store.setStatus(ids, status)} stor${ids.length === 1 ? "y" : "ies"} marked ${status}.`);
        break;
      }
      case "generate": {
        const directory = await generateEpisode(
          config,
          createProvider(config.model.provider),
          store.list("approved")
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

function printStories(stories: Story[]): void {
  if (stories.length === 0) {
    console.log("No stories found.");
    return;
  }
  for (const story of stories) {
    console.log(`\n[${story.id}] ${story.title}`);
    console.log(`    Score: ${story.score} | Status: ${story.status} | Source: ${story.source}`);
    console.log(`    Categories: ${story.categories.join(", ")}`);
    console.log(`    ${story.summary}`);
    console.log(`    ${story.url}`);
  }
}

function printHelp(): void {
  console.log(`AI Engineering Briefing\n\nCommands:\n  ingest [--fixture path]\n  review [--status pending|approved|rejected]\n  approve --ids 1,2\n  reject --ids 3,4\n  generate\n\nOptions:\n  --config path   Configuration file (default: config/default.json)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

