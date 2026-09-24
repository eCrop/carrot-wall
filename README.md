# Carrot Wall

A live wall for the room: post what you want to learn, questions and frustrations from
your phone; the instructor answers, pins, and reads it back. No accounts.

## Run it

Two terminals, two commands. Requires **Java 21** (matches `apps/api/pom.xml`) and
**Node ≥22.22.3/24.15.0/26.0.0** (Angular CLI 22's floor).

`mise.toml` at the repo root pins both. With [mise](https://mise.jdx.dev/) installed:

```bash
mise install          # once, or whenever mise.toml changes
mise trust             # if this repo hasn't been trusted yet
```

Then either activate mise in your shell (`eval "$(mise activate bash)"` / `zsh`, usually
in your shell rc file) so `java`/`node` on `PATH` resolve to the pinned versions, or prefix
individual commands with `mise exec --`, e.g. `mise exec -- npm start`. Without mise, just
make sure your own Java/Node on `PATH` meet the versions above.

```bash
cd apps/api && ./mvnw quarkus:dev    # API  → http://localhost:8080
cd apps/web && npm install && npm start   # web → http://localhost:4200
```

The database is an H2 file under `apps/api/data/`, created and seeded on first boot.
Nothing to provision.

## Test it

```bash
cd apps/api && ./mvnw test
cd apps/web && npm test
```

## Admin

`/admin` asks for a passcode. Set it with the `ADMIN_PIN` environment variable
(defaults to `0000` in dev).

See `spec.md` for what it does and `feature-ideas.md` for what it could do next.
