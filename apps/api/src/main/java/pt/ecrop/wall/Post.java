package pt.ecrop.wall;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import io.quarkus.panache.common.Sort;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.List;

/**
 * A post on the wall. `updatedAt` moves on every mutation (pin, hide, upvote, answer) so
 * polling clients can ask "what changed since t" and get a real answer — see the mutation
 * methods below. Never mutate a post's columns via a bulk `update(...)` string: that bypasses
 * {@link #touch()} and silently breaks polling for that row.
 *
 * <p>Extends {@link PanacheEntityBase} rather than {@code PanacheEntity} so the id can use
 * {@code IDENTITY} generation, matching V1's {@code BIGSERIAL} column — PanacheEntity's default
 * id assumes a SQL sequence, which this table does not have.
 */
@Entity
@Table(name = "posts")
public class Post extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public String name;
    public String message;
    public String type;
    public boolean pinned;
    public boolean hidden;
    public int upvotes;

    @Column(name = "answer_text")
    public String answerText;

    @Column(name = "answer_updated_at")
    public LocalDateTime answerUpdatedAt;

    @Column(name = "created_at")
    public LocalDateTime createdAt;

    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        updatedAt = createdAt;
    }

    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }

    public void pin() {
        pinned = true;
    }

    public void unpin() {
        pinned = false;
    }

    public void hide() {
        hidden = true;
    }

    public void unhide() {
        hidden = false;
    }

    public void upvote() {
        upvotes++;
    }

    public void answer(String text) {
        answerText = text;
        answerUpdatedAt = LocalDateTime.now();
    }

    /**
     * Creates and persists a new post. {@code name} and {@code message} are expected to
     * already be trimmed and validated by the caller (see {@link PostsResource}); a blank name
     * is stored as {@code null} — "Anónimo" is a display fallback, never a stored value.
     */
    public static Post create(String name, String message, String type) {
        Post post = new Post();
        post.name = (name == null || name.isBlank()) ? null : name;
        post.message = message;
        post.type = type;
        post.persist();
        return post;
    }

    private static final Sort NEWEST_FIRST =
            Sort.by("createdAt", Sort.Direction.Descending).and("id", Sort.Direction.Descending);

    /** Page 1: every visible pinned post, then the newest {@code pageSize} visible unpinned ones. */
    public static List<Post> firstPage(int pageSize) {
        List<Post> pinnedPosts = list("hidden = false and pinned = true", NEWEST_FIRST);
        List<Post> unpinnedPosts =
                find("hidden = false and pinned = false", NEWEST_FIRST).page(0, pageSize).list();
        pinnedPosts.addAll(unpinnedPosts);
        return pinnedPosts;
    }

    /** "Load more": the next {@code pageSize} visible unpinned posts older than the cursor. */
    public static List<Post> before(LocalDateTime cursorCreatedAt, Long cursorId, int pageSize) {
        return find(
                        "hidden = false and pinned = false"
                                + " and (createdAt < ?1 or (createdAt = ?1 and id < ?2))",
                        NEWEST_FIRST,
                        cursorCreatedAt,
                        cursorId)
                .page(0, pageSize)
                .list();
    }

    /** Visible posts created or modified at or after {@code since} — the poll delta. */
    public static List<Post> changedSince(LocalDateTime since) {
        return list("hidden = false and updatedAt >= ?1", Sort.by("updatedAt"), since);
    }

    /** Ids of posts hidden at or after {@code since} — content never leaves the DB for these. */
    public static List<Long> hiddenSince(LocalDateTime since) {
        return list("hidden = true and updatedAt >= ?1", since).stream()
                .map(p -> ((Post) p).id)
                .toList();
    }
}
