import assert from "node:assert/strict";
import test from "node:test";
import { clusterStories, similarity } from "../src/clustering.js";
import type { Story } from "../src/types.js";

const base: Story = {
  id: 1,
  source: "Source A",
  title: "Researchers release Atlas model evaluation benchmark",
  url: "https://example.com/a",
  publishedAt: "2026-08-24T00:00:00.000Z",
  summary: "Atlas is evaluated on a new benchmark.",
  categories: ["evaluation"],
  status: "pending",
  score: 76
};

test("title similarity ignores common filler words", () => {
  assert.ok(similarity(
    "The Atlas model is released with a new benchmark",
    "Researchers release Atlas model evaluation benchmark"
  ) >= 0.42);
});

test("related coverage clusters and receives a source diversity bonus", () => {
  const corroborating: Story = {
    ...base,
    id: 2,
    source: "Source B",
    title: "New Atlas model released with evaluation benchmark",
    url: "https://example.com/b",
    score: 72
  };
  const unrelated: Story = {
    ...base,
    id: 3,
    source: "Source C",
    title: "Open robotics dataset targets manipulation",
    url: "https://example.com/c",
    score: 74
  };
  const clusters = clusterStories([base, corroborating, unrelated]);
  assert.equal(clusters.length, 2);
  const atlas = clusters.find((cluster) => cluster.stories.length === 2);
  assert.ok(atlas);
  assert.equal(atlas.id, 1);
  assert.equal(atlas.score, 82);
});
