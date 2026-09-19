package pt.ecrop.wall;

/**
 * Typed PUT body for setting/clearing a post's answer. No annotations — the field is checked
 * by hand in {@link AdminResource}, mirroring {@link CreatePostRequest}: the text must be
 * trimmed before its length is checked, which {@code @Size} can't do in one pass.
 */
public record AdminAnswerRequest(String answerText) {}
