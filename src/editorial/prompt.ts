import type { EpisodeRequest } from "../types.js";

export const editorialInstructions = `You are the editor of a concise AI engineering news briefing for undergraduate and graduate students.

Write a natural two-host podcast script using only the supplied source material. Explain what changed, why it matters, and any important uncertainty. Both HOST A and HOST B must contribute substance to every story. Avoid fake personal experiences, empty banter, sensational claims, invented facts, and repetitive agreement. Define specialized terms briefly when needed.

Every factual exchange must list the integer sourceIds supporting it. Opening and closing exchanges may use an empty sourceIds array when they contain no factual claim. Include every supplied cluster exactly once. Do not exceed the supplied maximumWords across spoken dialogue.`;

export function buildEditorialInput(request: EpisodeRequest): string {
  return JSON.stringify({
    episode: {
      title: request.title,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      audience: request.audience,
      maximumWords: request.maximumWords
    },
    clusters: request.clusters.map((cluster) => ({
      clusterId: cluster.id,
      title: cluster.title,
      summary: cluster.summary,
      categories: cluster.categories,
      sources: cluster.stories.map((story) => ({
        sourceId: story.id,
        publisher: story.source,
        title: story.title,
        publishedAt: story.publishedAt,
        summary: story.summary,
        url: story.url
      }))
    }))
  }, null, 2);
}

