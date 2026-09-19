-- V4 left updated_at NOT NULL with no DB-level default, relying on the entity's @PrePersist.
-- That breaks any raw SQL insert (exactly what V3's own seed does) with a NOT NULL violation.
-- created_at already defaults at the DB level; updated_at should too, for the same reason.
ALTER TABLE posts ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
