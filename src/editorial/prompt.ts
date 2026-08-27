import type { EpisodeRequest } from "../types.js";

export const editorialInstructions = `You are the editor of a concise AI engineering news briefing for undergraduate and graduate students.

Write a natural two-host podcast script using only the supplied source material. Explain what changed, why it matters, and any important uncertainty. Both HOST A and HOST B must contribute substance to every story. Avoid fake personal experiences, empty banter, sensational claims, invented facts, repetitive agreement, and padding.

Reach the requested length through educational depth: define specialized terms in plain language, explain the engineering mechanism described by the source, connect cause and effect, contrast the development with conventional approaches mentioned in the source, and explain limitations. Do not achieve length through repeated recaps or unsupported background knowledge.

Every factual exchange must list the integer sourceIds supporting it. Opening and closing exchanges may use an empty sourceIds array when they contain no factual claim. Include every supplied cluster exactly once. Spoken dialogue must contain at least minimumWords and must not exceed maximumWords.`;

export function buildEditorialInput(request: EpisodeRequest): string {
  const targetWords = Math.round(request.minimumWords + (request.maximumWords - request.minimumWords) * 0.35);
  return JSON.stringify({
    episode: {
      title: request.title,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      audience: request.audience,
      minimumWords: request.minimumWords,
      maximumWords: request.maximumWords,
      targetWords,
      suggestedWordsPerStory: Math.floor((targetWords - 120) / request.clusters.length)
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
        sourceText: (story.content || story.summary).slice(0, 12_000),
        url: story.url
      }))
    }))
  }, null, 2);
}
