package pt.ecrop.wall;

/** Exactly one of the two is expected; {@code presetId} wins if both are somehow sent. */
public record ActivatePromptRequest(Long presetId, String text) {}
