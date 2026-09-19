package pt.ecrop.wall;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The DB is never empty: Flyway seeds 11 posts (one pinned, one answered) before every test
 * class runs, and the in-memory DB is shared across the whole test JVM. So every test here
 * marks its own rows with a unique message substring and asserts on those, rather than
 * assuming a known row count or an empty wall.
 */
@QuarkusTest
class WallResourceTest {

    private String marker() {
        return "marker-" + UUID.randomUUID();
    }

    @Transactional
    Post persistPost(String marker, boolean pinned) {
        Post post = new Post();
        post.name = "Test";
        post.message = marker;
        post.type = "livre";
        post.pinned = pinned;
        post.persist();
        return post;
    }

    @Test
    void pinnedPostsComeBeforeUnpinnedOnesOnPageOne() {
        // wall.page-size is 3 under %test, so this relies on the fresh unpinned post below
        // being the newest — true as long as tests never backdate before asserting here.
        String pinnedMarker = marker();
        String unpinnedMarker = marker();
        persistPost(unpinnedMarker, false);
        persistPost(pinnedMarker, true);

        List<Map<String, Object>> posts =
                given().when().get("/api/wall").then().extract().jsonPath().getList("posts");

        int pinnedIndex = indexOfMessage(posts, pinnedMarker);
        int unpinnedIndex = indexOfMessage(posts, unpinnedMarker);
        assertTrue(pinnedIndex >= 0 && unpinnedIndex >= 0, "both test posts should be visible");
        assertTrue(pinnedIndex < unpinnedIndex, "pinned post must precede the unpinned one");
    }

    @Test
    void hiddenPostsAreAbsentFromEveryResponseShape() {
        String marker = marker();
        Post post = persistPost(marker, false);
        hide(post.id);

        given().when()
                .get("/api/wall")
                .then()
                .body("posts.message", not(hasItem(marker)));

        given().queryParam("before", 0L)
                .queryParam("beforeId", Long.MAX_VALUE)
                .when()
                .get("/api/wall")
                .then()
                .body("posts.message", not(hasItem(marker)));

        given().queryParam("since", 0L)
                .when()
                .get("/api/wall")
                .then()
                .body("posts.message", not(hasItem(marker)));
    }

    @Test
    void sincePicksUpAPinChangeWithNoOtherEdit() {
        String marker = marker();
        Post post = persistPost(marker, false);
        // Backdate first: the post's own insert set updatedAt = createdAt moments ago, which
        // would already be inside a since=justBefore window on its own. Only a real bump from
        // the pin below should land it there — otherwise this test passes even with no
        // @PreUpdate at all.
        backdate(post.id, LocalDateTime.now().minusHours(1));
        long justBefore = System.currentTimeMillis();

        pin(post.id);

        List<String> messages =
                given().queryParam("since", justBefore)
                        .when()
                        .get("/api/wall")
                        .then()
                        .extract()
                        .jsonPath()
                        .getList("posts.message", String.class);
        assertTrue(messages.contains(marker), "a pin-only change must move updatedAt");
    }

    @Test
    void sincePicksUpAnUpvoteWithNoOtherEdit() {
        String marker = marker();
        Post post = persistPost(marker, false);
        backdate(post.id, LocalDateTime.now().minusHours(1)); // see comment above
        long justBefore = System.currentTimeMillis();

        upvote(post.id);

        List<Map<String, Object>> posts =
                given().queryParam("since", justBefore).when().get("/api/wall").then().extract().jsonPath().getList("posts");
        int index = indexOfMessage(posts, marker);
        assertTrue(index >= 0, "an upvote-only change must move updatedAt");
        assertEquals(1, ((Number) posts.get(index).get("upvotes")).intValue());
    }

    @Test
    void sinceReportsANewlyHiddenPostByIdOnlyWithNoMessageLeak() {
        String marker = marker();
        Post post = persistPost(marker, false);
        backdate(post.id, LocalDateTime.now().minusHours(1)); // see comment above
        long justBefore = System.currentTimeMillis();

        hide(post.id);

        String body =
                given().queryParam("since", justBefore)
                        .when()
                        .get("/api/wall")
                        .then()
                        .body("removedIds", hasItem(post.id.intValue()))
                        .extract()
                        .asString();
        assertFalse(body.contains(marker), "a removed post's message must never reach the wire");
    }

    @Test
    void beforeCursorReturnsTheNextPageWithNoOverlapWithPageOne() {
        String olderMarker = marker();
        Post older = persistPost(olderMarker, false);
        backdate(older.id, LocalDateTime.now().minusDays(1));

        var page1 = given().when().get("/api/wall").then().extract().jsonPath();
        List<Integer> page1Ids = page1.getList("posts.id", Integer.class);

        // wall.page-size is 3 under %test, so page 1 cannot hold every seeded + test post —
        // walking the cursor from the last id on page 1 must eventually surface the older post.
        int lastIndex = page1Ids.size() - 1;
        long cursorCreatedAt = page1.getLong("posts[" + lastIndex + "].createdAt");
        long cursorId = page1.getLong("posts[" + lastIndex + "].id");

        List<Integer> page2Ids =
                given().queryParam("before", cursorCreatedAt)
                        .queryParam("beforeId", cursorId)
                        .when()
                        .get("/api/wall")
                        .then()
                        .extract()
                        .jsonPath()
                        .getList("posts.id", Integer.class);

        assertFalse(page2Ids.isEmpty(), "there must be older posts to load");
        for (Integer id : page2Ids) {
            assertFalse(page1Ids.contains(id), "page 2 must not repeat a page 1 id");
        }
    }

    private static int indexOfMessage(List<Map<String, Object>> posts, String message) {
        for (int i = 0; i < posts.size(); i++) {
            if (message.equals(posts.get(i).get("message"))) {
                return i;
            }
        }
        return -1;
    }

    @Transactional
    void pin(Long id) {
        ((Post) Post.findById(id)).pin();
    }

    @Transactional
    void hide(Long id) {
        ((Post) Post.findById(id)).hide();
    }

    @Transactional
    void upvote(Long id) {
        ((Post) Post.findById(id)).upvote();
    }

    @Transactional
    void backdate(Long id, LocalDateTime when) {
        Post post = (Post) Post.findById(id);
        post.createdAt = when;
        post.updatedAt = when;
    }
}
