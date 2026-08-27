import { z } from "zod";
import type { EpisodeRequest, GeneratedEpisode, StoryCluster } from "../types.js";

export const exchangeSchema = z.object({
  host: z.enum(["HOST A", "HOST B"]),
  text: z.string().min(1),
  sourceIds: z.array(z.number().int().positive())
});

export const episodeDraftSchema = z.object({
  opening: z.array(exchangeSchema).min(2),
  stories: z.array(z.object({
    clusterId: z.number().int().positive(),
    heading: z.string().min(1),
    exchanges: z.array(exchangeSchema).min(2)
  })),
  closing: z.array(exchangeSchema).min(2)
});

export type EpisodeDraft = z.infer<typeof episodeDraftSchema>;

const exchangeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["host", "text", "sourceIds"],
  properties: {
    host: { type: "string", enum: ["HOST A", "HOST B"] },
    text: { type: "string" },
    sourceIds: { type: "array", items: { type: "integer" } }
  }
} as const;

export const episodeDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["opening", "stories", "closing"],
  properties: {
    opening: { type: "array", items: exchangeJsonSchema },
    stories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clusterId", "heading", "exchanges"],
        properties: {
          clusterId: { type: "integer" },
          heading: { type: "string" },
          exchanges: { type: "array", items: exchangeJsonSchema }
        }
      }
    },
    closing: { type: "array", items: exchangeJsonSchema }
  }
} as const;

export function validateAndRenderEpisode(raw: unknown, request: EpisodeRequest): GeneratedEpisode {
  const draft = episodeDraftSchema.parse(raw);
  const expectedClusters = new Set(request.clusters.map((cluster) => cluster.id));
  const returnedClusters = draft.stories.map((story) => story.clusterId);
  if (returnedClusters.length !== expectedClusters.size || returnedClusters.some((id) => !expectedClusters.has(id))) {
    throw new Error("Generated episode did not include each selected cluster exactly once.");
  }
  if (new Set(returnedClusters).size !== returnedClusters.length) {
    throw new Error("Generated episode repeated a story cluster.");
  }

  const clusterById = new Map(request.clusters.map((cluster) => [cluster.id, cluster]));
  for (const story of draft.stories) {
    const cluster = clusterById.get(story.clusterId)!;
    const allowedSources = new Set(cluster.stories.map((source) => source.id));
    const hosts = new Set(story.exchanges.map((exchange) => exchange.host));
    if (hosts.size !== 2) throw new Error(`Cluster ${story.clusterId} must include both hosts.`);
    for (const exchange of story.exchanges) {
      if (exchange.sourceIds.some((id) => !allowedSources.has(id))) {
        throw new Error(`Cluster ${story.clusterId} cited an unknown source ID.`);
      }
    }
  }

  const script = renderScript(draft, request);
  const spokenWords = draftWords(draft);
  if (spokenWords > request.maximumWords) {
    throw new Error(`Generated script has ${spokenWords} spoken words; maximum is ${request.maximumWords}.`);
  }
  return { script, showNotes: renderShowNotes(request.clusters, request.title) };
}

function renderScript(draft: EpisodeDraft, request: EpisodeRequest): string {
  const lines = [`# ${request.title}`, "", `*Coverage period: ${request.periodStart} through ${request.periodEnd}*`, ""];
  appendExchanges(lines, draft.opening);
  for (const story of draft.stories) {
    lines.push(`## ${story.heading}`, "");
    appendExchanges(lines, story.exchanges);
  }
  lines.push("## Closing", "");
  appendExchanges(lines, draft.closing);
  return lines.join("\n").trim() + "\n";
}

function appendExchanges(lines: string[], exchanges: EpisodeDraft["opening"]): void {
  for (const exchange of exchanges) lines.push(`**${exchange.host}:** ${exchange.text}`, "");
}

function renderShowNotes(clusters: StoryCluster[], title: string): string {
  return `# ${title} - Show Notes\n\n` + clusters.map(
    (cluster) => `## ${cluster.title}\n\n` + cluster.stories.map(
      (story) => `- [${story.title}](${story.url}) — ${story.source}`
    ).join("\n")
  ).join("\n\n") + "\n";
}

function draftWords(draft: EpisodeDraft): number {
  const exchanges = [
    ...draft.opening,
    ...draft.stories.flatMap((story) => story.exchanges),
    ...draft.closing
  ];
  return exchanges.reduce((count, exchange) => count + exchange.text.trim().split(/\s+/).length, 0);
}
