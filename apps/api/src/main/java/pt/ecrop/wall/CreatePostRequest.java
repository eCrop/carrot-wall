package pt.ecrop.wall;

/**
 * The JSON body of {@code POST /api/posts}. No Bean Validation annotations: the message must
 * be trimmed before its length is checked (a whitespace-only message is empty), which
 * {@code @NotBlank}/{@code @Size} don't do — see {@link PostsResource}.
 */
public record CreatePostRequest(String name, String message, String type) {}
