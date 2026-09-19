package pt.ecrop.wall;

import io.quarkus.panache.common.Sort;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;

/**
 * The gate: {@code POST /login} trades the PIN for a session cookie, {@code GET /session} tells
 * the client whether it already has a valid one. {@code session} is itself {@link AdminOnly} —
 * it doubles as the endpoint that proves the shared 401 filter works, rather than needing a
 * placeholder route for that.
 */
@Path("/api/admin")
@Produces(MediaType.APPLICATION_JSON)
public class AdminResource {

    /** Not {@code Secure}: dev runs over plain http through the Angular proxy, and a
     * {@code Secure} cookie would silently never be sent there. */
    static final String SESSION_COOKIE = "admin_session";

    @ConfigProperty(name = "wall.admin-pin")
    String adminPin;

    @Inject
    AdminSessionStore sessionStore;

    @POST
    @Path("/login")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response login(AdminLoginRequest request) {
        String pin = request.pin() == null ? "" : request.pin().trim();
        if (!pin.equals(adminPin)) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        String token = sessionStore.create();
        NewCookie cookie =
                new NewCookie.Builder(SESSION_COOKIE)
                        .value(token)
                        .path("/")
                        .httpOnly(true)
                        .sameSite(NewCookie.SameSite.LAX)
                        .build();
        return Response.ok().cookie(cookie).build();
    }

    @GET
    @Path("/session")
    @AdminOnly
    public Response session() {
        return Response.ok().build();
    }

    @PUT
    @Path("/posts/{id}/answer")
    @Consumes(MediaType.APPLICATION_JSON)
    @AdminOnly
    @Transactional
    public Response setAnswer(@PathParam("id") Long id, AdminAnswerRequest request) {
        Post post = (Post) Post.findById(id);
        if (post == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        String answerText = request.answerText() == null ? "" : request.answerText().trim();
        if (answerText.length() > 1000) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new ApiError("O texto da resposta pode ter no máximo 1000 caracteres."))
                    .build();
        }

        post.answer(answerText);
        return Response.noContent().build();
    }

    @GET
    @Path("/prompts/presets")
    @AdminOnly
    public List<PromptPresetDto> listPresets() {
        return PromptPreset.<PromptPreset>listAll(Sort.by("id")).stream()
                .map(PromptPresetDto::from)
                .toList();
    }

    @POST
    @Path("/prompt")
    @Consumes(MediaType.APPLICATION_JSON)
    @AdminOnly
    @Transactional
    public Response activatePrompt(ActivatePromptRequest request) {
        String text;
        if (request.presetId() != null) {
            PromptPreset preset = (PromptPreset) PromptPreset.findById(request.presetId());
            if (preset == null) {
                return Response.status(Response.Status.NOT_FOUND).build();
            }
            text = preset.text;
        } else {
            text = request.text() == null ? "" : request.text().trim();
        }

        if (text.isBlank() || text.length() > 200) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new ApiError("A pergunta tem de ter entre 1 e 200 caracteres."))
                    .build();
        }

        Prompt.activate(text);
        return Response.noContent().build();
    }
}
