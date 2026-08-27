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
    minimumMinutes: number;
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
  content?: string;
  categories: string[];
}

export interface Story extends StoryInput {
  id: number;
  status: "pending" | "approved" | "rejected";
  score: number;
}

export interface StoryCluster {
  id: number;
  title: string;
  summary: string;
  categories: string[];
  status: Story["status"];
  score: number;
  stories: Story[];
}

export interface EpisodeRequest {
  title: string;
  periodStart: string;
  periodEnd: string;
  audience: string;
  minimumWords: number;
  maximumWords: number;
  clusters: StoryCluster[];
}

export interface GeneratedEpisode {
  script: string;
  showNotes: string;
}
