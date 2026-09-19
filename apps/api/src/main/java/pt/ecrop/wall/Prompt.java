package pt.ecrop.wall;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * The prompt of the moment. Exactly one is active: whichever row was activated most recently.
 * Extends {@link PanacheEntityBase} with an explicit {@code IDENTITY} id — see {@link Post}.
 */
@Entity
@Table(name = "prompts")
public class Prompt extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public String text;

    @Column(name = "activated_at")
    public LocalDateTime activatedAt;

    public static Prompt active() {
        return find("order by activatedAt desc").firstResult();
    }

    /**
     * Activates {@code text}: bumps {@code activatedAt} on the existing row with that exact
     * text if one exists (matching V3's already-seeded first prompt, for instance), otherwise
     * inserts a new row. Never edits a row's {@code text} — an activation is always either an
     * insert or a timestamp change, per spec §7. Sets {@code activatedAt} directly rather than
     * via a {@code @PreUpdate} like {@link Post#touch()}: unlike {@code Post}, a {@code Prompt}
     * has no other mutable column for such a hook to guard.
     */
    public static Prompt activate(String text) {
        Prompt existing = find("text", text).firstResult();
        if (existing != null) {
            existing.activatedAt = LocalDateTime.now();
            return existing;
        }

        Prompt prompt = new Prompt();
        prompt.text = text;
        prompt.activatedAt = LocalDateTime.now();
        prompt.persist();
        return prompt;
    }
}
