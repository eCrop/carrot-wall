-- The wall in its simplest useful form: someone writes a message, optionally signs it.
CREATE TABLE posts (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(40),
    message    VARCHAR(280) NOT NULL,
    type       VARCHAR(20)  NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The wall is always read newest-first.
CREATE INDEX idx_posts_created_at ON posts (created_at DESC);
