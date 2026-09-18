# Carrot Wall

A live wall for the room: post what you want to learn, questions and frustrations from
your phone; the instructor answers, pins, and reads it back. No accounts.

## Run it

Two terminals, two commands. Requires **Java 21** and **Node 20+**.

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
