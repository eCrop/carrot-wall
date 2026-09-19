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
}
