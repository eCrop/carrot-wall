package pt.ecrop.wall;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The 5 course preset prompts (V6 seed) offered as one-tap choices on {@code /admin}. Reference
 * data — a preset is never itself "active"; activating one goes through {@link Prompt#activate}
 * like any free-typed text, so it lands in {@code prompts} the same way. Ordering by {@code id}
 * (see {@link AdminResource}) is enough to keep the 5 buttons in seed order — no custom query
 * method needed, {@code listAll(Sort)} is already provided by {@link PanacheEntityBase}.
 */
@Entity
@Table(name = "prompt_presets")
public class PromptPreset extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public String text;
}
