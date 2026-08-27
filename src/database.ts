import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { scoreStory } from "./scoring.js";
import type { Story, StoryInput } from "./types.js";

export class StoryStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        published_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        categories TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  ingest(stories: StoryInput[]): { inserted: number; skipped: number } {
    const statement = this.db.prepare(`
      INSERT OR IGNORE INTO stories
        (source, title, url, published_at, summary, categories, score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const story of stories) {
      const result = statement.run(
        story.source,
        story.title,
        story.url,
        story.publishedAt,
        story.summary,
        JSON.stringify(story.categories),
        scoreStory(story)
      );
      inserted += Number(result.changes);
    }
    return { inserted, skipped: stories.length - inserted };
  }

  list(status?: Story["status"]): Story[] {
    const rows = status
      ? this.db.prepare("SELECT * FROM stories WHERE status = ? ORDER BY score DESC, published_at DESC").all(status)
      : this.db.prepare("SELECT * FROM stories ORDER BY score DESC, published_at DESC").all();
    return rows.map(mapRow);
  }

  setStatus(ids: number[], status: Story["status"]): number {
    const statement = this.db.prepare("UPDATE stories SET status = ? WHERE id = ?");
    let updated = 0;
    this.db.exec("BEGIN");
    try {
      for (const id of ids) updated += Number(statement.run(status, id).changes);
      this.db.exec("COMMIT");
      return updated;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

function mapRow(row: Record<string, unknown>): Story {
  return {
    id: Number(row.id),
    source: String(row.source),
    title: String(row.title),
    url: String(row.url),
    publishedAt: String(row.published_at),
    summary: String(row.summary),
    categories: JSON.parse(String(row.categories)) as string[],
    status: String(row.status) as Story["status"],
    score: Number(row.score)
  };
}

