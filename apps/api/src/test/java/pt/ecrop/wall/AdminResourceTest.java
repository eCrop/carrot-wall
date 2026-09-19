package pt.ecrop.wall;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class AdminResourceTest {

    // Matches wall.admin-pin's dev default (ADMIN_PIN unset in %test too).
    private static final String CORRECT_PIN = "0000";

    private String marker() {
        return "marker-" + UUID.randomUUID();
    }

    @Transactional
    Post persistPost(String marker) {
        Post post = new Post();
        post.name = "Test";
        post.message = marker;
        post.type = "livre";
        post.persist();
        return post;
    }

    @Test
    void loginWithTheRightPinSucceedsAndSetsASessionCookie() {
        given().contentType(ContentType.JSON)
                .body("{\"pin\":\"" + CORRECT_PIN + "\"}")
                .when()
                .post("/api/admin/login")
                .then()
                .statusCode(200)
                .cookie("admin_session", notNullValue());
    }

    @Test
    void loginWithTheWrongPinFailsAndSetsNoCookie() {
        given().contentType(ContentType.JSON)
                .body("{\"pin\":\"wrong\"}")
                .when()
                .post("/api/admin/login")
                .then()
                .statusCode(401)
                .header("Set-Cookie", nullValue());
    }

    @Test
    void sessionCheckRejectsAMissingCookie() {
        given().when().get("/api/admin/session").then().statusCode(401);
    }

    @Test
    void sessionCheckRejectsAGarbageCookie() {
        given().cookie("admin_session", "not-a-real-token")
                .when()
                .get("/api/admin/session")
                .then()
                .statusCode(401);
    }

    @Test
    void sessionCheckAcceptsTheCookieFromALoginJustPerformed() {
        String token = login();

        given().cookie("admin_session", token).when().get("/api/admin/session").then().statusCode(200);
    }

    static String login() {
        return given().contentType(ContentType.JSON)
                .body("{\"pin\":\"" + CORRECT_PIN + "\"}")
                .when()
                .post("/api/admin/login")
                .then()
                .statusCode(200)
                .extract()
                .cookie("admin_session");
    }

    @Test
    void settingAnAnswerPersistsTrimmedTextAndShowsUpOnThePublicWall() {
        String marker = marker();
        Post post = persistPost(marker);
        String token = login();

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"answerText\":\"  Boa pergunta!  \"}")
                .when()
                .put("/api/admin/posts/" + post.id + "/answer")
                .then()
                .statusCode(204);

        given().when()
                .get("/api/wall")
                .then()
                .body("posts.find { it.message == '" + marker + "' }.answerText", equalTo("Boa pergunta!"))
                .body(
                        "posts.find { it.message == '" + marker + "' }.answerUpdatedAt",
                        notNullValue());
    }

    @Test
    void settingAnAnswerAgainReplacesTheExistingOne() {
        String marker = marker();
        Post post = persistPost(marker);
        String token = login();

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"answerText\":\"Primeira resposta\"}")
                .when()
                .put("/api/admin/posts/" + post.id + "/answer")
                .then()
                .statusCode(204);

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"answerText\":\"Resposta final\"}")
                .when()
                .put("/api/admin/posts/" + post.id + "/answer")
                .then()
                .statusCode(204);

        given().when()
                .get("/api/wall")
                .then()
                .body(
                        "posts.find { it.message == '" + marker + "' }.answerText",
                        equalTo("Resposta final"));
    }

    @Test
    void blankAnswerTextClearsTheAnswer() {
        String marker = marker();
        Post post = persistPost(marker);
        String token = login();

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"answerText\":\"Uma resposta\"}")
                .when()
                .put("/api/admin/posts/" + post.id + "/answer")
                .then()
                .statusCode(204);

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"answerText\":\"   \"}")
                .when()
                .put("/api/admin/posts/" + post.id + "/answer")
                .then()
                .statusCode(204);

        given().when()
                .get("/api/wall")
                .then()
                .body(
                        "posts.find { it.message == '" + marker + "' }.answerText",
                        nullValue());
    }

    @Test
    void answerTextOver1000CharsIsRejectedAndNotPersisted() {
        String marker = marker();
        Post post = persistPost(marker);
        String token = login();
        String tooLong = "x".repeat(1001);

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"answerText\":\"" + tooLong + "\"}")
                .when()
                .put("/api/admin/posts/" + post.id + "/answer")
                .then()
                .statusCode(400);

        given().when()
                .get("/api/wall")
                .then()
                .body(
                        "posts.find { it.message == '" + marker + "' }.answerText",
                        nullValue());
    }

    @Test
    void settingAnAnswerWithNoSessionCookieIsRejected() {
        String marker = marker();
        Post post = persistPost(marker);

        given().contentType(ContentType.JSON)
                .body("{\"answerText\":\"Boa pergunta!\"}")
                .when()
                .put("/api/admin/posts/" + post.id + "/answer")
                .then()
                .statusCode(401);

        given().when()
                .get("/api/wall")
                .then()
                .body(
                        "posts.find { it.message == '" + marker + "' }.answerText",
                        nullValue());
    }

    @Test
    void settingAnAnswerOnAnUnknownPostReturnsNotFound() {
        String token = login();

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"answerText\":\"Boa pergunta!\"}")
                .when()
                .put("/api/admin/posts/999999999/answer")
                .then()
                .statusCode(404);
    }

    @Test
    void settingAnAnswerDoesNotTouchPinnedUpvotesOrOrderOfAnotherPost() {
        String answeredMarker = marker();
        String siblingMarker = marker();
        Post answered = persistPost(answeredMarker);
        Post sibling = persistPost(siblingMarker);
        String token = login();

        List<Integer> idsBefore =
                given().when().get("/api/wall").then().extract().jsonPath().getList("posts.id", Integer.class);
        var siblingBefore = findByMessage(siblingMarker);

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"answerText\":\"Boa pergunta!\"}")
                .when()
                .put("/api/admin/posts/" + answered.id + "/answer")
                .then()
                .statusCode(204);

        List<Integer> idsAfter =
                given().when().get("/api/wall").then().extract().jsonPath().getList("posts.id", Integer.class);
        var siblingAfter = findByMessage(siblingMarker);

        assertEquals(idsBefore, idsAfter, "answering a post must not reorder the wall");
        assertEquals(siblingBefore.get("pinned"), siblingAfter.get("pinned"));
        assertEquals(
                ((Number) siblingBefore.get("upvotes")).intValue(),
                ((Number) siblingAfter.get("upvotes")).intValue());
        assertTrue(sibling.id != null, "sibling post must still exist");
    }

    @Test
    void pinSetsPinnedTrueAndLeavesHiddenUpvotesAndAnswerUntouched() {
        String marker = marker();
        Post post = persistPost(marker);
        String token = login();

        given().cookie("admin_session", token)
                .when()
                .post("/api/admin/posts/" + post.id + "/pin")
                .then()
                .statusCode(204);

        var after = findByMessage(marker);
        assertEquals(true, after.get("pinned"));
        assertEquals(false, after.get("hidden"));
        assertEquals(0, ((Number) after.get("upvotes")).intValue());
        assertEquals(null, after.get("answerText"));
    }

    @Test
    void unpinSetsPinnedFalse() {
        String marker = marker();
        Post post = persistPost(marker);
        String token = login();
        pin(post.id);

        given().cookie("admin_session", token)
                .when()
                .post("/api/admin/posts/" + post.id + "/unpin")
                .then()
                .statusCode(204);

        assertEquals(false, findByMessage(marker).get("pinned"));
    }

    @Test
    void hideSetsHiddenTrueAndRemovesThePostFromThePublicWallButNotAnAdminOne() {
        String marker = marker();
        Post post = persistPost(marker);
        String token = login();

        given().cookie("admin_session", token)
                .when()
                .post("/api/admin/posts/" + post.id + "/hide")
                .then()
                .statusCode(204);

        given().when()
                .get("/api/wall")
                .then()
                .body("posts.message", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(marker)));

        given().cookie("admin_session", token)
                .queryParam("includeHidden", true)
                .when()
                .get("/api/wall")
                .then()
                .body("posts.find { it.message == '" + marker + "' }.hidden", equalTo(true));
    }

    @Test
    void unhideSetsHiddenFalseAndRestoresThePostToThePublicWall() {
        String marker = marker();
        Post post = persistPost(marker);
        String token = login();
        hide(post.id);

        given().cookie("admin_session", token)
                .when()
                .post("/api/admin/posts/" + post.id + "/unhide")
                .then()
                .statusCode(204);

        given().when()
                .get("/api/wall")
                .then()
                .body("posts.message", org.hamcrest.Matchers.hasItem(marker));
    }

    @Test
    void pinUnpinHideAndUnhideEachTouchOnlyTheirOwnPostLeavingASiblingUntouched() {
        String targetMarker = marker();
        String siblingMarker = marker();
        Post target = persistPost(targetMarker);
        persistPost(siblingMarker);
        String token = login();

        for (String action : List.of("pin", "hide", "unpin", "unhide")) {
            var siblingBefore = findByMessage(siblingMarker);
            given().cookie("admin_session", token)
                    .when()
                    .post("/api/admin/posts/" + target.id + "/" + action)
                    .then()
                    .statusCode(204);
            var siblingAfter = findByMessage(siblingMarker);
            assertEquals(siblingBefore.get("pinned"), siblingAfter.get("pinned"));
            assertEquals(siblingBefore.get("hidden"), siblingAfter.get("hidden"));
            assertEquals(
                    ((Number) siblingBefore.get("upvotes")).intValue(),
                    ((Number) siblingAfter.get("upvotes")).intValue());
        }
    }

    @Test
    void everyModerationToggleReturns401WithNoSessionCookie() {
        String marker = marker();
        Post post = persistPost(marker);

        for (String action : List.of("pin", "unpin", "hide", "unhide")) {
            given().when()
                    .post("/api/admin/posts/" + post.id + "/" + action)
                    .then()
                    .statusCode(401);
        }
    }

    @Test
    void everyModerationToggleReturns404ForAnUnknownPostId() {
        String token = login();

        for (String action : List.of("pin", "unpin", "hide", "unhide")) {
            given().cookie("admin_session", token)
                    .when()
                    .post("/api/admin/posts/999999999/" + action)
                    .then()
                    .statusCode(404);
        }
    }

    @Transactional
    void pin(Long id) {
        ((Post) Post.findById(id)).pin();
    }

    @Transactional
    void hide(Long id) {
        ((Post) Post.findById(id)).hide();
    }

    private static java.util.Map<?, ?> findByMessage(String marker) {
        return given().when()
                .get("/api/wall")
                .then()
                .extract()
                .jsonPath()
                .getList("posts")
                .stream()
                .map(p -> (java.util.Map<?, ?>) p)
                .filter(p -> marker.equals(p.get("message")))
                .findFirst()
                .orElseThrow();
    }
}
