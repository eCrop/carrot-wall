---
name: project-conventions
description: How code is written in the Carrot Wall project. Use when creating or modifying source files, tests, or migrations.
---
# Conventions

## Structure
- apps/web: Angular standalone components, Material themed to the Claude tokens.
- apps/api: Quarkus REST resources with Bean Validation, Panache entities.

## Rules
- Never modify an existing Flyway migration. New schema changes get a new versioned file.
- Messages render as text, never innerHTML.
- Every new endpoint validates its input with Bean Validation annotations.

## Tests
- API: JUnit next to the resource. Web: unit tests beside the component, e2e in apps/web/e2e.
- A change is not done until ./mvnw test and npm test both pass.
