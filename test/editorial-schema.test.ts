import assert from "node:assert/strict";
import test from "node:test";
import { validateAndRenderEpisode } from "../src/editorial/schema.js";
import type { EpisodeRequest } from "../src/types.js";

const request: EpisodeRequest = {
  title: "Test Briefing",
  periodStart: "2026-08-19",
  periodEnd: "2026-08-26",
  audience: "engineering students",
  minimumWords: 1,
  maximumWords: 100,
  clusters: [{
    id: 7,
    title: "Atlas evaluation",
    summary: "Atlas was evaluated.",
    categories: ["evaluation"],
    status: "approved",
    score: 80,
    stories: [{
      id: 11,
      source: "Research Source",
      title: "Atlas evaluation",
      url: "https://example.com/atlas",
      publishedAt: "2026-08-25T00:00:00.000Z",
      summary: "Atlas was evaluated.",
      categories: ["evaluation"],
      status: "approved",
      score: 80
    }]
  }]
};

const validDraft = {
  opening: [
    { host: "HOST A", text: "Welcome.", sourceIds: [] },
    { host: "HOST B", text: "Here is the briefing.", sourceIds: [] }
  ],
  stories: [{
    clusterId: 7,
    heading: "Atlas evaluation",
    exchanges: [
      { host: "HOST A", text: "Atlas was evaluated.", sourceIds: [11] },
      { host: "HOST B", text: "What did the evaluation measure?", sourceIds: [11] },
      { host: "HOST A", text: "It measured the result described by the source.", sourceIds: [11] },
      { host: "HOST B", text: "That makes the comparison useful.", sourceIds: [11] }
    ]
  }],
  closing: [
    { host: "HOST A", text: "That is all.", sourceIds: [] },
    { host: "HOST B", text: "Sources are attached.", sourceIds: [] }
  ]
};

test("validated drafts render dialogue and local show notes", () => {
  const result = validateAndRenderEpisode(validDraft, request);
  assert.match(result.script, /\*\*HOST A:\*\*/);
  assert.match(result.showNotes, /https:\/\/example.com\/atlas/);
});

test("unknown source IDs fail validation", () => {
  const invalid = structuredClone(validDraft);
  invalid.stories[0]!.exchanges[0]!.sourceIds = [999];
  assert.throws(() => validateAndRenderEpisode(invalid, request), /unknown source ID/);
});

test("missing clusters fail validation", () => {
  const invalid = { ...validDraft, stories: [] };
  assert.throws(() => validateAndRenderEpisode(invalid, request), /each selected cluster/);
});

test("scripts below the minimum spoken word count fail validation", () => {
  assert.throws(
    () => validateAndRenderEpisode(validDraft, { ...request, minimumWords: 100 }),
    /minimum is 100/
  );
});

test("story dialogue must contain an answered question", () => {
  const invalid = structuredClone(validDraft);
  invalid.stories[0]!.exchanges[1]!.text = "The evaluation measured a result.";
  assert.throws(() => validateAndRenderEpisode(invalid, request), /question answered/);
});

test("story dialogue must alternate hosts", () => {
  const invalid = structuredClone(validDraft);
  invalid.stories[0]!.exchanges[1]!.host = "HOST A";
  assert.throws(() => validateAndRenderEpisode(invalid, request), /alternate hosts/);
});

test("speech-unfriendly model identifiers are rejected", () => {
  const invalid = structuredClone(validDraft);
  invalid.stories[0]!.exchanges[0]!.text = "Qwen3.5-0.8B's weights changed.";
  assert.throws(() => validateAndRenderEpisode(invalid, request), /dense identifier/);
});

test("unexplained technical shorthand is rejected", () => {
  const invalid = structuredClone(validDraft);
  invalid.stories[0]!.exchanges[0]!.text = "PPO changed the result.";
  assert.throws(() => validateAndRenderEpisode(invalid, request), /shorthand/);
});
