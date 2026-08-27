import type { StoryInput } from "./types.js";

const highLearningValue = new Set([
  "agents", "datasets", "engineering", "evaluation", "infrastructure",
  "models", "policy", "research", "robotics", "security"
]);

export function scoreStory(story: StoryInput): number {
  const categoryScore = story.categories.reduce(
    (score, category) => score + (highLearningValue.has(category.toLowerCase()) ? 6 : 2),
    0
  );
  const detailScore = Math.min(20, Math.floor(story.summary.length / 30));
  const primarySignal = /research|release|evaluation|dataset|standard/i.test(
    `${story.title} ${story.summary}`
  ) ? 15 : 5;
  return Math.min(100, 45 + categoryScore + detailScore + primarySignal);
}

