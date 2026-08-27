import type { EpisodeRequest, GeneratedEpisode } from "../types.js";

export interface LanguageModelProvider {
  readonly name: string;
  generateEpisode(request: EpisodeRequest): Promise<GeneratedEpisode>;
}

