package pt.ecrop.wall;

import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Cookie;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

/**
 * The 401 rule, enforced once: any request to an {@link AdminOnly}-annotated resource without a
 * valid {@code admin_session} cookie is rejected before the resource method runs.
 */
@Provider
@AdminOnly
public class AdminAuthFilter implements ContainerRequestFilter {

    @Inject
    AdminSessionStore sessionStore;

    @Override
    public void filter(ContainerRequestContext requestContext) {
        Cookie cookie = requestContext.getCookies().get(AdminResource.SESSION_COOKIE);
        String token = cookie == null ? null : cookie.getValue();
        if (!sessionStore.isValid(token)) {
            requestContext.abortWith(Response.status(Response.Status.UNAUTHORIZED).build());
        }
    }
}
