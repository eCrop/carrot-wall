---
description: Create a new Flyway migration following this project's conventions
argument-hint: [what the schema change does]
---
Create a new Flyway migration for: $ARGUMENTS
Follow the existing files under apps/api/src/main/resources/db/migration/ for naming
and style. Never modify an existing migration. Include the entity change, then run
./mvnw test.
