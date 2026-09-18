-- The instructor answers a post (one answer per post, editable).
ALTER TABLE posts ADD COLUMN answer_text       VARCHAR(1000);
ALTER TABLE posts ADD COLUMN answer_updated_at TIMESTAMP;

-- Moderation: pinned floats to the top, hidden is a soft delete (never DELETE a row).
ALTER TABLE posts ADD COLUMN pinned  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN hidden  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0;

-- Every public query filters hidden and orders pinned first.
CREATE INDEX idx_posts_visible ON posts (hidden, pinned, created_at DESC);
