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
        content TEXT NOT NULL DEFAULT '',
        categories TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const columns = this.db.prepare("PRAGMA table_info(stories)").all() as Array<Record<string, unknown>>;
    if (!columns.some((column) => column.name === "content")) {
      this.db.exec("ALTER TABLE stories ADD COLUMN content TEXT NOT NULL DEFAULT ''");
    }
  }

  ingest(stories: StoryInput[]): { inserted: number; updated: number } {
    const statement = this.db.prepare(`
      INSERT INTO stories
        (source, title, url, published_at, summary, content, categories, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        source = excluded.source,
        title = excluded.title,
        published_at = excluded.published_at,
        summary = excluded.summary,
        content = excluded.content,
        categories = excluded.categories,
        score = excluded.score
    `);
    const exists = this.db.prepare("SELECT 1 FROM stories WHERE url = ?");
    let inserted = 0;
    let updated = 0;
    for (const story of stories) {
      const alreadyExists = Boolean(exists.get(story.url));
      statement.run(
        story.source,
        story.title,
        story.url,
        story.publishedAt,
        story.summary,
        story.content ?? story.summary,
        JSON.stringify(story.categories),
        scoreStory(story)
      );
      if (alreadyExists) updated += 1;
      else inserted += 1;
    }
    return { inserted, updated };
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
    content: String(row.content || row.summary),
    categories: JSON.parse(String(row.categories)) as string[],
    status: String(row.status) as Story["status"],
    score: Number(row.score)
  };
}
