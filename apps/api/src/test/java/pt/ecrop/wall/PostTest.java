package pt.ecrop.wall;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Plain unit test — no {@code @QuarkusTest}, no DB, just the entity's own logic. */
class PostTest {

    @Test
    void answerSetsTextAndStampsATimestamp() {
        Post post = new Post();
        post.answer("Boa pergunta!");

        assertEquals("Boa pergunta!", post.answerText);
        assertFalse(post.answerUpdatedAt == null);
    }

    @Test
    void answerCalledAgainReplacesBothFields() {
        Post post = new Post();
        post.answer("Primeira resposta");

        post.answer("Resposta melhor");

        assertEquals("Resposta melhor", post.answerText);
        assertFalse(post.answerUpdatedAt == null);
    }

    @Test
    void answerWithBlankTextClearsBothFields() {
        Post post = new Post();
        post.answer("Uma resposta");

        post.answer("   ");

        assertNull(post.answerText);
        assertNull(post.answerUpdatedAt);
    }

    @Test
    void answerWithEmptyStringClearsBothFields() {
        Post post = new Post();
        post.answer("Uma resposta");

        post.answer("");

        assertNull(post.answerText);
        assertNull(post.answerUpdatedAt);
    }

    @Test
    void answerWithNullClearsBothFields() {
        Post post = new Post();
        post.answer("Uma resposta");

        post.answer(null);

        assertNull(post.answerText);
        assertNull(post.answerUpdatedAt);
    }
}
