package pt.ecrop.wall;

import jakarta.inject.Inject;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * One endpoint, three modes, all returning the same shape: the active prompt, a list of
 * posts, any newly-hidden ids, and the server clock at response time. Separate endpoints per
 * mode would be three places to forget the hidden-post filter.
 *
 * <ul>
 *   <li>no params — page 1: every visible pinned post, then the newest page of unpinned ones.
 *   <li>{@code before} + {@code beforeId} — "load more": the next older page of unpinned posts.
 *   <li>{@code since} — the 5s poll delta: everything changed at or after that moment.
 * </ul>
 */
@Path("/api/wall")
@Produces(MediaType.APPLICATION_JSON)
public class WallResource {

    @ConfigProperty(name = "wall.page-size")
    int pageSize;

    @Inject
    AdminSessionStore sessionStore;

    @GET
    public WallResponse wall(
            @QueryParam("before") Long beforeMillis,
            @QueryParam("beforeId") Long beforeId,
            @QueryParam("since") Long sinceMillis,
            @QueryParam("includeHidden") boolean includeHidden,
            @CookieParam(AdminResource.SESSION_COOKIE) String adminSession) {

        // Unauthenticated by design — attendees poll this every 5s — so a missing/invalid
        // session never 401s the request, it just silently downgrades includeHidden to false.
        // Trusting the query param alone would let anyone read hidden content by appending
        // ?includeHidden=true; do not "simplify" this away.
        boolean effectiveIncludeHidden = includeHidden && sessionStore.isValid(adminSession);

        PromptDto prompt = PromptDto.from(Prompt.active());
        long serverTime = System.currentTimeMillis();

        if (sinceMillis != null) {
            LocalDateTime since = toLocalDateTime(sinceMillis);
            List<PostDto> posts =
                    Post.changedSince(since, effectiveIncludeHidden).stream()
                            .map(PostDto::from)
                            .toList();
            List<Long> removedIds = effectiveIncludeHidden ? List.of() : Post.hiddenSince(since);
            return new WallResponse(prompt, posts, removedIds, serverTime);
        }

        if (beforeMillis != null && beforeId != null) {
            List<PostDto> posts =
                    Post.before(
                                    toLocalDateTime(beforeMillis),
                                    beforeId,
                                    pageSize,
                                    effectiveIncludeHidden)
                            .stream()
                            .map(PostDto::from)
                            .toList();
            return new WallResponse(prompt, posts, List.of(), serverTime);
        }

        List<PostDto> posts =
                Post.firstPage(pageSize, effectiveIncludeHidden).stream()
                        .map(PostDto::from)
                        .toList();
        return new WallResponse(prompt, posts, List.of(), serverTime);
    }

    private static LocalDateTime toLocalDateTime(long epochMillis) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneId.systemDefault());
    }
}
