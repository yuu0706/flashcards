-- Migration number: 0001 	 2026-10-26T00:00:00.000Z
-- 利用者 / 単語帳 / 札 / 復習の記録 (Cloudflare D1 / SQLite)

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- 利用者。Cloudflare Access が渡すメールアドレスで識別する。
-- 初回ログイン時に自動で作られる
-- ------------------------------------------------------------
CREATE TABLE users (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ------------------------------------------------------------
-- 単語帳(デッキ)。資格ごと・分野ごとに分ける
-- ------------------------------------------------------------
CREATE TABLE decks (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  -- 1日に新しく出す札の上限。復習が溜まりすぎるのを防ぐ
  new_per_day  INTEGER NOT NULL DEFAULT 20 CHECK (new_per_day BETWEEN 0 AND 1000),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX decks_user_id ON decks(user_id);

-- ------------------------------------------------------------
-- 札。間隔反復(SM-2 相当)の状態を札そのものに持つ。
--   state: new(未学習) / learning(当日中に再出題) / review(間隔を空けて復習)
--   due:   次に出す日(YYYY-MM-DD、利用者の現地日付)。new の間は NULL
-- ------------------------------------------------------------
CREATE TABLE cards (
  id             TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  deck_id        TEXT    NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id        TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  front          TEXT    NOT NULL,
  back           TEXT    NOT NULL,
  note           TEXT    NOT NULL DEFAULT '',
  -- タグは JSON の文字列配列。SQLite に配列型が無く、検索は LIKE で足りるため
  tags           TEXT    NOT NULL DEFAULT '[]',
  state          TEXT    NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review')),
  due            TEXT,
  interval_days  INTEGER NOT NULL DEFAULT 0,
  ease           REAL    NOT NULL DEFAULT 2.5,
  reps           INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX cards_deck_due ON cards(deck_id, state, due);
CREATE INDEX cards_user_id ON cards(user_id);

-- ------------------------------------------------------------
-- 復習の記録。学習量の確認用に残す(札を消しても記録は消す)
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  card_id     TEXT    NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      TEXT    NOT NULL CHECK (rating IN ('again', 'hard', 'good')),
  reviewed_on TEXT    NOT NULL,
  interval_before INTEGER NOT NULL,
  interval_after  INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX reviews_user_on ON reviews(user_id, reviewed_on);
