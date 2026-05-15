PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS authors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    UNIQUE NOT NULL,
  name            TEXT    NOT NULL,
  avatar_path     TEXT,
  contentful_id   TEXT    UNIQUE
);

CREATE TABLE IF NOT EXISTS posts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                TEXT    UNIQUE NOT NULL,
  title               TEXT    NOT NULL,
  subtitle            TEXT,
  author_id           INTEGER REFERENCES authors(id),
  published_at        TEXT    NOT NULL,
  featured_image_path TEXT,
  source_url          TEXT,
  body_html           TEXT    NOT NULL,
  origin              TEXT    NOT NULL CHECK (origin IN ('standard', 'rss')),
  contentful_id       TEXT    UNIQUE,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_origin       ON posts(origin);

CREATE TABLE IF NOT EXISTS post_stats (
  post_id             INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  clicks              INTEGER NOT NULL DEFAULT 0,
  votes               INTEGER NOT NULL DEFAULT 0,
  comments_cached     INTEGER NOT NULL DEFAULT 0,
  comments_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS click_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  occurred_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  ip_hash      TEXT,
  ua_class     TEXT
);

CREATE INDEX IF NOT EXISTS idx_click_events_post_id ON click_events(post_id, occurred_at DESC);
