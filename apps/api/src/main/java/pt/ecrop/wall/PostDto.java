package pt.ecrop.wall;

import java.time.ZoneId;

/**
 * What a post looks like on the wire. Deliberately has no `hidden` field — a hidden post
 * either isn't in the list at all, or its id is in {@link WallResponse#removedIds()}.
 */
public record PostDto(
        Long id,
        String name,
        String message,
        String type,
        boolean pinned,
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
                post.upvotes,
                toEpochMillis(post.createdAt),
                post.answerText,
                post.answerUpdatedAt == null ? null : toEpochMillis(post.answerUpdatedAt));
    }

    static long toEpochMillis(java.time.LocalDateTime time) {
        return time.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }
}
