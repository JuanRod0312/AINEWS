export type Cadence = "weekly" | "biweekly";

export interface SourceConfig {
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}

export interface AppConfig {
  databasePath: string;
  outputDirectory: string;
  episode: {
    cadence: Cadence;
    maximumMinutes: number;
    maximumMainStories: number;
    wordsPerMinute: number;
    audience: string;
  };
  model: {
    provider: string;
    model: string;
  };
  sources: SourceConfig[];
}

export interface StoryInput {
  source: string;
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  categories: string[];
}

export interface Story extends StoryInput {
  id: number;
  status: "pending" | "approved" | "rejected";
  score: number;
}

export interface EpisodeRequest {
  title: string;
  periodStart: string;
  periodEnd: string;
  audience: string;
  maximumWords: number;
  stories: Story[];
}

export interface GeneratedEpisode {
  script: string;
  showNotes: string;
}

