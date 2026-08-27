import assert from "node:assert/strict";
import test from "node:test";
import { scoreStory } from "../src/scoring.js";

test("technical, detailed stories receive a strong score", () => {
  const score = scoreStory({
    source: "Research Feed",
    title: "Researchers release an evaluation dataset",
    url: "https://example.com/story",
    publishedAt: "2026-08-24T00:00:00.000Z",
    summary: "A detailed evaluation dataset separates planning, tool use, and environmental failure modes for engineering analysis.",
    categories: ["research", "evaluation"]
  });
  assert.ok(score >= 70);
  assert.ok(score <= 100);
});

