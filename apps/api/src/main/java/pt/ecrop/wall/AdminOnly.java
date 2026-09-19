package pt.ecrop.wall;

import jakarta.ws.rs.NameBinding;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a resource (class or method) as requiring a valid admin session. {@link AdminAuthFilter}
 * enforces this once, in one place — every future admin endpoint (answer/pin/hide/prompt) opts
 * in by annotating itself, rather than each reimplementing the 401 check.
 */
@NameBinding
@Retention(RetentionPolicy.RUNTIME)
@Target({ ElementType.TYPE, ElementType.METHOD })
public @interface AdminOnly {}
