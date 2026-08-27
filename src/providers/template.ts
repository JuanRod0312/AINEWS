import type { EpisodeRequest, GeneratedEpisode } from "../types.js";
import type { LanguageModelProvider } from "./provider.js";

export class TemplateProvider implements LanguageModelProvider {
  readonly name = "template";

  async generateEpisode(request: EpisodeRequest): Promise<GeneratedEpisode> {
    const segments = request.stories.map((story, index) => {
      const lead = index === 0 ? "Let's begin with the development that ranked highest." : "Our next story shifts the focus.";
      return `## Story ${index + 1}: ${story.title}\n\n` +
        `**HOST A:** ${lead} ${story.summary}\n\n` +
        `**HOST B:** What should engineering students take away from this?\n\n` +
        `**HOST A:** The useful question is how this changes what engineers can measure, build, or evaluate. ` +
        `The available reporting comes from ${story.source}, so we should treat claims beyond that evidence carefully.\n`;
    });

    const script = `# ${request.title}\n\n` +
      `*Coverage period: ${request.periodStart} through ${request.periodEnd}*\n\n` +
      `**HOST A:** Welcome to our AI engineering briefing. We selected ${request.stories.length} ` +
      `developments that help explain what changed during this period.\n\n` +
      `**HOST B:** We'll focus on the evidence, the engineering context, and what remains uncertain.\n\n` +
      segments.join("\n") +
      `\n## Closing\n\n**HOST B:** Those are the developments worth carrying into the next week.\n\n` +
      `**HOST A:** Full sources are included in the accompanying show notes.\n`;

    const showNotes = `# ${request.title} - Show Notes\n\n` + request.stories.map(
      (story) => `- [${story.title}](${story.url}) — ${story.source}`
    ).join("\n") + "\n";

    return { script: trimToWords(script, request.maximumWords), showNotes };
  }
}

function trimToWords(text: string, maximumWords: number): string {
  const words = text.split(/\s+/);
  return words.length <= maximumWords ? text : `${words.slice(0, maximumWords).join(" ")}\n`;
}

