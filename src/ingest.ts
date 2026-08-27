import { readFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { SourceConfig, StoryInput } from "./types.js";

const fixtureSchema = z.object({
  stories: z.array(z.object({
    source: z.string(),
    title: z.string(),
    url: z.url(),
    publishedAt: z.iso.datetime(),
    summary: z.string(),
    categories: z.array(z.string())
  }))
});

export async function ingestFixture(path: string): Promise<StoryInput[]> {
  return fixtureSchema.parse(JSON.parse(await readFile(path, "utf8"))).stories;
}

export async function ingestSources(sources: SourceConfig[]): Promise<StoryInput[]> {
  const enabled = sources.filter((source) => source.enabled);
  const results = await Promise.allSettled(enabled.map(fetchFeed));
  const stories: StoryInput[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") stories.push(...result.value);
    else console.error(`Feed failed: ${String(result.reason)}`);
  }
  return stories;
}

async function fetchFeed(source: SourceConfig): Promise<StoryInput[]> {
  const response = await fetch(source.url, {
    headers: { "user-agent": "ainews-lab-briefing/0.1" }
  });
  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
  const document = new XMLParser({ ignoreAttributes: false }).parse(await response.text()) as any;
  const items = toArray(document?.rss?.channel?.item ?? document?.feed?.entry ?? []);
  return items.flatMap((item: any): StoryInput[] => {
    const url = getLink(item);
    const title = textValue(item.title);
    if (!url || !title) return [];
    return [{
      source: source.name,
      title,
      url,
      publishedAt: normalizeDate(item.pubDate ?? item.published ?? item.updated),
      summary: stripMarkup(textValue(item.description ?? item.summary ?? item.content)),
      categories: [source.category]
    }];
  });
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) return String((value as any)["#text"]);
  return "";
}

function getLink(item: any): string {
  if (typeof item.link === "string") return item.link;
  if (Array.isArray(item.link)) {
    const link = item.link.find((entry: any) => entry?.["@_rel"] === "alternate") ?? item.link[0];
    return String(link?.["@_href"] ?? "");
  }
  return String(item.link?.["@_href"] ?? item.guid?.["#text"] ?? item.guid ?? "");
}

function normalizeDate(value: unknown): string {
  const date = new Date(textValue(value) || String(value ?? ""));
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

