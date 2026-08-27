import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
  return configSchema.parse(await loadConfigObject(resolve(path), new Set()));
}

async function loadConfigObject(path: string, visited: Set<string>): Promise<Record<string, unknown>> {
  if (visited.has(path)) throw new Error(`Circular configuration inheritance involving ${path}`);
  visited.add(path);
  const current = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  const parentPath = current.extends;
  delete current.extends;
  if (typeof parentPath !== "string") return current;
  const parent = await loadConfigObject(resolve(dirname(path), parentPath), visited);
  return mergeObjects(parent, current);
}

function mergeObjects(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    merged[key] = isObject(existing) && isObject(value) ? mergeObjects(existing, value) : value;
  }
  return merged;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
