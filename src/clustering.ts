import type { Story, StoryCluster } from "./types.js";

const stopWords = new Set([
  "a", "about", "after", "ai", "an", "and", "are", "as", "at", "be", "by",
  "for", "from", "how", "in", "into", "is", "it", "its", "new", "of", "on",
  "or", "s", "that", "the", "their", "this", "to", "with"
]);

const maximumGapMs = 5 * 24 * 60 * 60 * 1000;

export function clusterStories(stories: Story[]): StoryCluster[] {
  const ordered = [...stories].sort((a, b) => b.score - a.score || a.id - b.id);
  const groups: Story[][] = [];

  for (const story of ordered) {
    const group = groups.find((candidate) => candidate.some((member) => areRelated(story, member)));
    if (group) group.push(story);
    else groups.push([story]);
  }

  return groups.map(toCluster).sort((a, b) => b.score - a.score || a.id - b.id);
}

export function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function areRelated(left: Story, right: Story): boolean {
  const timeGap = Math.abs(new Date(left.publishedAt).valueOf() - new Date(right.publishedAt).valueOf());
  if (!Number.isFinite(timeGap) || timeGap > maximumGapMs) return false;

  const titleSimilarity = similarity(left.title, right.title);
  const leftTokens = tokens(left.title);
  const rightTokens = tokens(right.title);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const containment = shared / Math.max(1, Math.min(leftTokens.size, rightTokens.size));
  return titleSimilarity >= 0.42 || (shared >= 3 && containment >= 0.6);
}

function toCluster(stories: Story[]): StoryCluster {
  const representative = [...stories].sort(
    (a, b) => b.score - a.score || b.summary.length - a.summary.length || a.id - b.id
  )[0]!;
  const uniqueSources = new Set(stories.map((story) => story.source)).size;
  const corroborationBonus = Math.min(18, Math.max(0, uniqueSources - 1) * 6);
  return {
    id: Math.min(...stories.map((story) => story.id)),
    title: representative.title,
    summary: representative.summary,
    categories: [...new Set(stories.flatMap((story) => story.categories))].sort(),
    status: representative.status,
    score: Math.min(100, Math.max(...stories.map((story) => story.score)) + corroborationBonus),
    stories: [...stories].sort((a, b) => b.score - a.score || a.id - b.id)
  };
}

function tokens(value: string): Set<string> {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return new Set(
    normalized.split(/\s+/).filter((token) => token.length > 2 && !stopWords.has(token))
  );
}
