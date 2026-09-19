package pt.ecrop.wall;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class AdminResourceTest {

    // Matches wall.admin-pin's dev default (ADMIN_PIN unset in %test too).
    private static final String CORRECT_PIN = "0000";

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
}
