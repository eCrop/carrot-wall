package pt.ecrop.wall;

import jakarta.enterprise.context.ApplicationScoped;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Valid admin session tokens, in memory. One instructor, one laptop, five days: no expiry, no
 * logout, nothing to evict. Resets on redeploy, which is fine — the spec only asks the session
 * to survive a page refresh, not a restart.
 */
@ApplicationScoped
public class AdminSessionStore {

    private final SecureRandom random = new SecureRandom();
    private final Set<String> validTokens = ConcurrentHashMap.newKeySet();

    public String create() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        validTokens.add(token);
        return token;
    }

    public boolean isValid(String token) {
        return token != null && validTokens.contains(token);
    }
}
