package pt.ecrop.wall;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * {@code @QuarkusTest} rather than a plain unit test (unlike {@link PostTest}): {@code activate}
 * queries and persists through Panache, so it needs the DB. Flyway's V3 seed (one prompt row,
 * already active) is present before every test here, same as {@link WallResourceTest}'s posts.
 */
@QuarkusTest
class PromptTest {

    private String marker() {
        return "marker-" + UUID.randomUUID();
    }

    @Test
    @Transactional
    void activatingUnseenTextInsertsANewRow() {
        String text = marker();

        Prompt activated = Prompt.activate(text);

        assertEquals(text, activated.text);
        assertNotNull(activated.activatedAt);
        assertEquals(activated.id, Prompt.active().id);
    }

    @Test
    @Transactional
    void activatingTheSameTextTwiceBumpsTheSameRowRatherThanDuplicating() {
        String text = marker();

        Prompt first = Prompt.activate(text);
        Prompt second = Prompt.activate(text);

        assertEquals(first.id, second.id);
        assertEquals(second.id, Prompt.active().id);
    }

    @Test
    @Transactional
    void activatingV3sAlreadySeededTextBumpsItRatherThanInsertingADuplicate() {
        // V3 seeds exactly this text as the very first prompt row - covers the real-world case
        // where the instructor picks preset #1 back after having moved off it.
        String seededText = "A única coisa que quero desta semana é…";
        Prompt seeded = Prompt.find("text", seededText).firstResult();
        assertNotNull(seeded, "V3's seeded prompt row must exist for this test to mean anything");

        Prompt reactivated = Prompt.activate(seededText);

        assertEquals(seeded.id, reactivated.id);
        assertEquals(seeded.id, Prompt.active().id);
    }
}
