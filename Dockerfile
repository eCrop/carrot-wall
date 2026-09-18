# 1. Build the Angular app
FROM node:22-alpine AS web
WORKDIR /web
COPY apps/web/package*.json ./
# ponytail: npm install, not ci — the lockfile omits wasm32-wasi optional peers
# that npm only resolves on linux. Back to `npm ci` if the lock ever covers them.
RUN npm install --no-audit --no-fund
COPY apps/web/ ./
RUN npm run build -- --configuration production

# 2. Build the Quarkus app, with the Angular output baked in as static resources
FROM maven:3.9-eclipse-temurin-21 AS api
WORKDIR /api
COPY apps/api/ ./
COPY --from=web /web/dist/web/browser/ src/main/resources/META-INF/resources/
RUN mvn -B package -DskipTests

# 3. Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /deployments
COPY --from=api /api/target/quarkus-app/lib/ ./lib/
COPY --from=api /api/target/quarkus-app/*.jar ./
COPY --from=api /api/target/quarkus-app/app/ ./app/
COPY --from=api /api/target/quarkus-app/quarkus/ ./quarkus/
EXPOSE 8080
ENV WALL_DB_PATH=/data/carrot-wall
CMD ["java", "-jar", "quarkus-run.jar"]
