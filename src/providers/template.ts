import type { EpisodeRequest, GeneratedEpisode } from "../types.js";
import type { LanguageModelProvider } from "./provider.js";
import { validateAndRenderEpisode } from "../editorial/schema.js";

export class TemplateProvider implements LanguageModelProvider {
  readonly name = "template";

  async generateEpisode(request: EpisodeRequest): Promise<GeneratedEpisode> {
    const stories = request.clusters.map((cluster, index) => {
      const lead = index === 0 ? "Let's begin with the development that ranked highest." : "Our next story shifts the focus.";
      const sourceIds = cluster.stories.map((story) => story.id);
      return {
        clusterId: cluster.id,
        heading: `Story ${index + 1}: ${cluster.title}`,
        exchanges: [
          { host: "HOST A" as const, text: `${lead} ${cluster.summary}`, sourceIds },
          { host: "HOST B" as const, text: "What should engineering students take away from this?", sourceIds: [] },
          { host: "HOST A" as const, text: "The useful question is how this changes what engineers can measure, build, or evaluate. We should treat claims beyond the supplied evidence carefully.", sourceIds },
          { host: "HOST B" as const, text: "That distinction gives us a practical way to evaluate the development without overstating it.", sourceIds }
        ]
      };
    });
    return validateAndRenderEpisode({
      opening: [
        { host: "HOST A", text: `Welcome to our AI engineering briefing. We selected ${request.clusters.length} developments that help explain what changed during this period.`, sourceIds: [] },
        { host: "HOST B", text: "We'll focus on the evidence, the engineering context, and what remains uncertain.", sourceIds: [] }
      ],
      stories,
      closing: [
        { host: "HOST B", text: "Those are the developments worth carrying into the next week.", sourceIds: [] },
        { host: "HOST A", text: "Full sources are included in the accompanying show notes.", sourceIds: [] }
      ]
    }, request);
  }
}
