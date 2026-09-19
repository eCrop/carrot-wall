package pt.ecrop.wall;

/** Typed login body. No annotations — the one field is checked by hand in {@link AdminResource}. */
public record AdminLoginRequest(String pin) {}
