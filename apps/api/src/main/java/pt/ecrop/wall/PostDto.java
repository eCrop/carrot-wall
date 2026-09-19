package pt.ecrop.wall;

import java.time.ZoneId;

/**
 * What a post looks like on the wire. {@code hidden} is only ever {@code true} for a response an
 * admin asked for with {@code includeHidden=true} — {@link WallResource} and {@link Post}'s query
 * methods already guarantee a hidden post's row never reaches {@link #from(Post)} otherwise, so
 * this record doesn't re-check who's asking.
 */
public record PostDto(
        Long id,
        String name,
        String message,
        String type,
        boolean pinned,
        boolean hidden,
        int upvotes,
        long createdAt,
        String answerText,
        Long answerUpdatedAt) {

    static PostDto from(Post post) {
        return new PostDto(
                post.id,
                post.name,
                post.message,
                post.type,
                post.pinned,
                post.hidden,
                post.upvotes,
                toEpochMillis(post.createdAt),
                post.answerText,
                post.answerUpdatedAt == null ? null : toEpochMillis(post.answerUpdatedAt));
    }

    static long toEpochMillis(java.time.LocalDateTime time) {
        return time.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }
}
