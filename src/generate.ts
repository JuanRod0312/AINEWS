import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig, StoryCluster } from "./types.js";
import type { LanguageModelProvider } from "./providers/provider.js";

export async function generateEpisode(
  config: AppConfig,
  provider: LanguageModelProvider,
  clusters: StoryCluster[],
  periodEnd = new Date()
): Promise<string> {
  const request = buildEpisodeRequest(config, clusters, periodEnd);
  const date = request.periodEnd;
  const directory = join(config.outputDirectory, `${date}-${config.episode.cadence}`);
  const result = await provider.generateEpisode(request);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "script.md"), result.script, "utf8"),
    writeFile(join(directory, "show-notes.md"), result.showNotes, "utf8"),
    writeFile(join(directory, "sources.json"), JSON.stringify(request.clusters, null, 2) + "\n", "utf8")
  ]);
  return directory;
}

export function buildEpisodeRequest(
  config: AppConfig,
  clusters: StoryCluster[],
  periodEnd = new Date()
) {
  if (clusters.length === 0) throw new Error("No approved story clusters. Approve clusters before generating.");
  const days = config.episode.cadence === "biweekly" ? 14 : 7;
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - days);
  const date = formatLocalDate(periodEnd);
  const selected = clusters.slice(0, config.episode.maximumMainStories);
  return {
    title: "AI Engineering Briefing",
    periodStart: formatLocalDate(periodStart),
    periodEnd: date,
    audience: config.episode.audience,
    maximumWords: config.episode.maximumMinutes * config.episode.wordsPerMinute,
    clusters: selected
  };
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
