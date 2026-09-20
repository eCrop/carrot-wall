package pt.ecrop.wall;

import io.vertx.ext.web.Router;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

/**
 * In production the Angular app is served from META-INF/resources, so a browser refresh on
 * /tv or /admin asks the server for a file that does not exist. Send those paths to index.html
 * and let the Angular router take over. Listed explicitly rather than catch-all, so /api and
 * the static assets are never touched.
 */
@ApplicationScoped
public class SpaRoutes {

    private static final String[] SPA_PATHS = { "/post", "/tv", "/admin", "/materials" };

    void registerSpaFallback(@Observes Router router) {
        for (String path : SPA_PATHS) {
            router.get(path).handler(rc -> rc.reroute("/index.html"));
        }
    }
}
