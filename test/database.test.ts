import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StoryStore } from "../src/database.js";

test("re-ingestion refreshes content without duplicating a story", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ainews-store-"));
  const store = new StoryStore(join(directory, "test.db"));
  try {
    const story = {
      source: "Publisher",
      title: "Initial title",
      url: "https://example.com/story",
      publishedAt: "2026-08-25T00:00:00.000Z",
      summary: "Initial summary",
      content: "Initial content",
      categories: ["engineering"]
    };
    assert.deepEqual(store.ingest([story]), { inserted: 1, updated: 0 });
    assert.deepEqual(store.ingest([{ ...story, title: "Updated title", content: "Richer source content" }]), {
      inserted: 0,
      updated: 1
    });
    const stories = store.list();
    assert.equal(stories.length, 1);
    assert.equal(stories[0]!.title, "Updated title");
    assert.equal(stories[0]!.content, "Richer source content");
  } finally {
    store.close();
    await rm(directory, { recursive: true });
  }
});
