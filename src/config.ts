import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { AppConfig } from "./types.js";

const configSchema = z.object({
  databasePath: z.string().min(1),
  outputDirectory: z.string().min(1),
  episode: z.object({
    cadence: z.enum(["weekly", "biweekly"]),
    maximumMinutes: z.number().positive().max(10),
    maximumMainStories: z.number().int().positive(),
    wordsPerMinute: z.number().int().positive(),
    audience: z.string().min(1)
  }),
  model: z.object({
    provider: z.string().min(1),
    model: z.string().min(1)
  }),
  sources: z.array(z.object({
    name: z.string().min(1),
    url: z.url(),
    category: z.string().min(1),
    enabled: z.boolean()
  }))
});

export async function loadConfig(path = "config/default.json"): Promise<AppConfig> {
  const contents = await readFile(path, "utf8");
  return configSchema.parse(JSON.parse(contents));
}

