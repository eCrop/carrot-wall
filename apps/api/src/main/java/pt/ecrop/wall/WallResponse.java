package pt.ecrop.wall;

import java.util.List;

/**
 * The shape of every /api/wall response, whatever mode produced it (first page, "load more",
 * or a poll delta). `removedIds` is only ever non-empty on a `since` response.
 */
public record WallResponse(
        PromptDto prompt, List<PostDto> posts, List<Long> removedIds, long serverTime) {}
