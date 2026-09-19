-- Every post mutation (pin, hide, answer, upvote) must move this column so the wall's
-- polling clients can ask "what changed since t" and actually get an answer.
ALTER TABLE posts ADD COLUMN updated_at TIMESTAMP;
UPDATE posts SET updated_at = created_at;
ALTER TABLE posts ALTER COLUMN updated_at SET NOT NULL;

-- The since= query filters hidden and orders/searches by updated_at, same shape as
-- idx_posts_visible in V2.
CREATE INDEX idx_posts_updated_at ON posts (hidden, updated_at);
