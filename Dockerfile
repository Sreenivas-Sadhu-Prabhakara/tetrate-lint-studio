# Self-contained image for tetrate-lint (Spectral wrapper with bundled rules).
# Build context is the repo root; only the cli/ wrapper is copied in.
#
#   docker build -t tetrate-lint .
#   docker run --rm -v "$PWD:/work" tetrate-lint /work/config.yaml --format stylish
#
FROM node:20-bookworm-slim AS build
WORKDIR /opt/tetrate-lint
COPY cli/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY cli/ ./

FROM node:20-bookworm-slim
WORKDIR /work
ENV NODE_ENV=production
COPY --from=build /opt/tetrate-lint /opt/tetrate-lint
ENTRYPOINT ["node", "/opt/tetrate-lint/bin.js"]
CMD ["--help"]
