package pt.ecrop.wall;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * The rate limiter is an {@code @ApplicationScoped} singleton shared by every test in this
 * class, so each test uses its own random {@code X-Client-Token} — otherwise tests would
 * pollute each other's request counts depending on execution order.
 */
@QuarkusTest
class PostsResourceTest {

    private String token() {
        return "token-" + UUID.randomUUID();
    }

    private io.restassured.response.Response post(String name, String message, String type, String token) {
        return given()
                .contentType("application/json")
                .header("X-Client-Token", token)
                .body(Map.of("name", name == null ? "" : name, "message", message == null ? "" : message, "type", type == null ? "" : type))
                .when()
                .post("/api/posts");
    }

    @Test
    void createsATrimmedPostWithTheGivenType() {
        String marker = "marker-" + UUID.randomUUID();
        post("  Ana  ", "  " + marker + "  ", "pergunta", token())
                .then()
                .statusCode(201)
                .body("name", equalTo("Ana"))
                .body("message", equalTo(marker))
                .body("type", equalTo("pergunta"))
                .body("id", notNullValue());
    }

    @Test
    void aBlankNameIsStoredAsNoNameNotAsAnonimo() {
        String marker = "marker-" + UUID.randomUUID();
        Long id =
                post("   ", marker, "livre", token())
                        .then()
                        .statusCode(201)
                        .body("name", nullValue())
                        .extract()
                        .jsonPath()
                        .getLong("id");

        Post saved = (Post) Post.findById(id);
        assertNull(saved.name);
    }

    @Test
    void anEmptyMessageIsRejected() {
        post(null, "", "livre", token()).then().statusCode(400);
    }

    @Test
    void aWhitespaceOnlyMessageIsRejected() {
        post(null, "    ", "livre", token()).then().statusCode(400);
    }

    @Test
    void aMessageOfExactly280CharsIsAccepted() {
        post(null, "a".repeat(280), "livre", token()).then().statusCode(201);
    }

    @Test
    void aMessageOver280CharsIsRejected() {
        post(null, "a".repeat(281), "livre", token()).then().statusCode(400);
    }

    @Test
    void anUnknownTypeIsRejected() {
        post(null, "hello", "not-a-real-type", token()).then().statusCode(400);
    }

    @Test
    void aTypeWithADiacriticRoundTrips() {
        post(null, "marker-" + UUID.randomUUID(), "frustração", token())
                .then()
                .statusCode(201)
                .body("type", equalTo("frustração"));
    }

    @Test
    void theFifthPostFromOneTokenSucceedsTheSixthIsRateLimited() {
        String sharedToken = token();
        for (int i = 0; i < 5; i++) {
            post(null, "hit-" + i + "-" + UUID.randomUUID(), "livre", sharedToken)
                    .then()
                    .statusCode(201);
        }
        post(null, "hit-6-" + UUID.randomUUID(), "livre", sharedToken).then().statusCode(429);
    }

    @Test
    void aDifferentTokenIsUnaffectedByAnotherTokensLimit() {
        String exhaustedToken = token();
        for (int i = 0; i < 5; i++) {
            post(null, "burst-" + i + "-" + UUID.randomUUID(), "livre", exhaustedToken)
                    .then()
                    .statusCode(201);
        }
        post(null, "burst-6-" + UUID.randomUUID(), "livre", exhaustedToken).then().statusCode(429);

        post(null, "other-token-" + UUID.randomUUID(), "livre", token()).then().statusCode(201);
    }

    @Test
    void requestsWithNoClientTokenAreNeverRateLimited() {
        for (int i = 0; i < 7; i++) {
            given()
                    .contentType("application/json")
                    .body(Map.of("message", "no-token-" + i + "-" + UUID.randomUUID(), "type", "livre"))
                    .when()
                    .post("/api/posts")
                    .then()
                    .statusCode(201);
        }
    }
}
