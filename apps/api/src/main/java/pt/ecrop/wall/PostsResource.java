package pt.ecrop.wall;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Set;

/**
 * The write side of the wall: one message in, one post persisted. Validation is manual rather
 * than Bean Validation annotations because the message must be trimmed *before* its length is
 * checked — a whitespace-only message is empty — which {@code @NotBlank}/{@code @Size} don't do.
 */
@Path("/api/posts")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class PostsResource {

    private static final Set<String> VALID_TYPES =
            Set.of("quero-aprender", "pergunta", "frustração", "livre");

    @Inject
    RateLimiter rateLimiter;

    @POST
    @Transactional
    public Response create(CreatePostRequest request, @HeaderParam("X-Client-Token") String clientToken) {
        String message = request.message() == null ? "" : request.message().trim();
        String name = request.name() == null ? "" : request.name().trim();
        String type = request.type();

        if (message.isEmpty() || message.length() > 280) {
            return badRequest("Escreve qualquer coisa entre 1 e 280 caracteres.");
        }
        if (name.length() > 40) {
            return badRequest("O nome pode ter no máximo 40 caracteres.");
        }
        if (type == null || !VALID_TYPES.contains(type)) {
            return badRequest("Escolhe um dos tipos disponíveis.");
        }
        if (!rateLimiter.allow(clientToken)) {
            return Response.status(429)
                    .entity(new ApiError("Calma aí — espera um bocadinho antes de escreveres outra vez."))
                    .build();
        }

        Post post = Post.create(name, message, type);
        return Response.status(Response.Status.CREATED).entity(PostDto.from(post)).build();
    }

    /**
     * Any visitor can +1 a post once per browser (spec F5) — the guard is client-side
     * ({@code localStorage}), not here, so this endpoint has nothing to check beyond "does this
     * post exist and is it visible": a hidden post is a soft delete, and nothing invisible is
     * upvotable. Goes through {@link Post#upvote()} rather than a bulk {@code update(...)}
     * string so {@code updated_at} moves and the increment reaches polling clients.
     */
    @POST
    @Path("/{id}/upvote")
    @Consumes(MediaType.WILDCARD)
    @Transactional
    public Response upvote(@PathParam("id") Long id) {
        Post post = Post.findById(id);
        if (post == null || post.hidden) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        post.upvote();
        return Response.ok(PostDto.from(post)).build();
    }

    private static Response badRequest(String message) {
        return Response.status(Response.Status.BAD_REQUEST).entity(new ApiError(message)).build();
    }
}
