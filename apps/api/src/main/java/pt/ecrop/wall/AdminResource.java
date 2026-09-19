package pt.ecrop.wall;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

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
}
