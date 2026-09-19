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

    @Test
    void listingPresetsWithNoSessionCookieIsRejected() {
        given().when().get("/api/admin/prompts/presets").then().statusCode(401);
    }

    @Test
    void listingPresetsReturnsTheFiveSeededOnes() {
        String token = login();

        given().cookie("admin_session", token)
                .when()
                .get("/api/admin/prompts/presets")
                .then()
                .statusCode(200)
                .body("size()", equalTo(5))
                .body("[0].text", equalTo("A única coisa que quero desta semana é…"));
    }

    @Test
    void activatingAPresetChangesWhatThePublicWallReturns() {
        String token = login();
        long presetId =
                given().cookie("admin_session", token)
                        .when()
                        .get("/api/admin/prompts/presets")
                        .then()
                        .extract()
                        .jsonPath()
                        .getLong("find { it.text == 'Perguntas para o fim do dia' }.id");

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"presetId\":" + presetId + "}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(204);

        given().when()
                .get("/api/wall")
                .then()
                .body("prompt.text", equalTo("Perguntas para o fim do dia"));
    }

    @Test
    void activatingFreeTextChangesWhatThePublicWallReturns() {
        String marker = marker();
        String token = login();

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"text\":\"" + marker + "\"}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(204);

        given().when().get("/api/wall").then().body("prompt.text", equalTo(marker));
    }

    @Test
    void activatingTheSameTextTwiceLeavesThePromptIdUnchanged() {
        String marker = marker();
        String token = login();

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"text\":\"" + marker + "\"}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(204);
        int firstId =
                given().when().get("/api/wall").then().extract().jsonPath().getInt("prompt.id");

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"text\":\"" + marker + "\"}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(204);
        int secondId =
                given().when().get("/api/wall").then().extract().jsonPath().getInt("prompt.id");

        assertEquals(firstId, secondId);
    }

    @Test
    void activatingBlankTextIsRejectedAndLeavesThePromptUnchanged() {
        String token = login();
        String activeBefore =
                given().when().get("/api/wall").then().extract().jsonPath().getString("prompt.text");

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"text\":\"   \"}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(400);

        given().when().get("/api/wall").then().body("prompt.text", equalTo(activeBefore));
    }

    @Test
    void activatingTextOver200CharsIsRejectedAndLeavesThePromptUnchanged() {
        String token = login();
        String activeBefore =
                given().when().get("/api/wall").then().extract().jsonPath().getString("prompt.text");
        String tooLong = "x".repeat(201);

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"text\":\"" + tooLong + "\"}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(400);

        given().when().get("/api/wall").then().body("prompt.text", equalTo(activeBefore));
    }

    @Test
    void activatingAnUnknownPresetIdReturnsNotFound() {
        String token = login();

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"presetId\":999999999}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(404);
    }

    @Test
    void activatingAPromptWithNoSessionCookieIsRejected() {
        String activeBefore =
                given().when().get("/api/wall").then().extract().jsonPath().getString("prompt.text");

        given().contentType(ContentType.JSON)
                .body("{\"text\":\"" + marker() + "\"}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(401);

        given().when().get("/api/wall").then().body("prompt.text", equalTo(activeBefore));
    }

    @Test
    void aScriptTagInAPromptRendersAsLiteralTextOnThePublicWall() {
        String scriptText = marker() + "-<script>alert(1)</script>";
        String token = login();

        given().cookie("admin_session", token)
                .contentType(ContentType.JSON)
                .body("{\"text\":\"" + scriptText + "\"}")
                .when()
                .post("/api/admin/prompt")
                .then()
                .statusCode(204);

        given().when().get("/api/wall").then().body("prompt.text", equalTo(scriptText));
    }
}
