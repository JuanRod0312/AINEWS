import assert from "node:assert/strict";
import test from "node:test";
import { TemplateProvider } from "../src/providers/template.js";

test("template provider creates two-host script and sourced notes", async () => {
  const provider = new TemplateProvider();
  const result = await provider.generateEpisode({
    title: "Test Briefing",
    periodStart: "2026-08-17",
    periodEnd: "2026-08-24",
    audience: "engineering students",
    maximumWords: 500,
    stories: [{
      id: 1,
      source: "Test Source",
      title: "A useful development",
      url: "https://example.com/useful",
      publishedAt: "2026-08-23T00:00:00.000Z",
      summary: "A concise factual summary.",
      categories: ["engineering"],
      status: "approved",
      score: 80
    }]
  });
  assert.match(result.script, /HOST A/);
  assert.match(result.script, /HOST B/);
  assert.match(result.showNotes, /https:\/\/example.com\/useful/);
});

