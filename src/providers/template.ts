import type { EpisodeRequest, GeneratedEpisode } from "../types.js";
import type { LanguageModelProvider } from "./provider.js";

export class TemplateProvider implements LanguageModelProvider {
  readonly name = "template";

  async generateEpisode(request: EpisodeRequest): Promise<GeneratedEpisode> {
    const segments = request.clusters.map((cluster, index) => {
      const lead = index === 0 ? "Let's begin with the development that ranked highest." : "Our next story shifts the focus.";
      const sourceNames = [...new Set(cluster.stories.map((story) => story.source))];
      return `## Story ${index + 1}: ${cluster.title}\n\n` +
        `**HOST A:** ${lead} ${cluster.summary}\n\n` +
        `**HOST B:** What should engineering students take away from this?\n\n` +
        `**HOST A:** The useful question is how this changes what engineers can measure, build, or evaluate. ` +
        `The available reporting comes from ${formatNames(sourceNames)}, so we should treat claims beyond that evidence carefully.\n`;
    });

    const script = `# ${request.title}\n\n` +
      `*Coverage period: ${request.periodStart} through ${request.periodEnd}*\n\n` +
      `**HOST A:** Welcome to our AI engineering briefing. We selected ${request.clusters.length} ` +
      `developments that help explain what changed during this period.\n\n` +
      `**HOST B:** We'll focus on the evidence, the engineering context, and what remains uncertain.\n\n` +
      segments.join("\n") +
      `\n## Closing\n\n**HOST B:** Those are the developments worth carrying into the next week.\n\n` +
      `**HOST A:** Full sources are included in the accompanying show notes.\n`;

    const showNotes = `# ${request.title} - Show Notes\n\n` + request.clusters.map(
      (cluster) => `## ${cluster.title}\n\n` + cluster.stories.map(
        (story) => `- [${story.title}](${story.url}) — ${story.source}`
      ).join("\n")
    ).join("\n\n") + "\n";

    return { script: trimToWords(script, request.maximumWords), showNotes };
  }
}

function formatNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "the cited source";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function trimToWords(text: string, maximumWords: number): string {
  const words = text.split(/\s+/);
  return words.length <= maximumWords ? text : `${words.slice(0, maximumWords).join(" ")}\n`;
}
