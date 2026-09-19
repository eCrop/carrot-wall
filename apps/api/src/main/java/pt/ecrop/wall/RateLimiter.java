package pt.ecrop.wall;

import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A sliding-window post limit keyed on a client-supplied token, not IP — the whole classroom
 * sits behind one public IP on Railway, and IP-keying would lock out the whole room together.
 * A missing token gets no check at all: the header is a friendly-room guard, not auth, and a
 * client that can't or won't send one must never be blocked.
 *
 * <p>ponytail: in-memory, single-process — resets on redeploy and doesn't span instances. Fine
 * because production is one container (see CLAUDE.md); revisit if that ever changes.
 */
@ApplicationScoped
public class RateLimiter {

    private static final int MAX_REQUESTS = 5;
    private static final long WINDOW_SECONDS = 60;

    private final ConcurrentHashMap<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    public boolean allow(String token) {
        if (token == null || token.isBlank()) {
            return true;
        }

        Deque<Instant> timestamps = hits.computeIfAbsent(token, t -> new ArrayDeque<>());
        Instant now = Instant.now();
        Instant cutoff = now.minusSeconds(WINDOW_SECONDS);

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= MAX_REQUESTS) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }
}
