# syntax=docker/dockerfile:1
#
#   docker buildx build --platform linux/amd64,linux/arm64 --build-arg VERSION=v0.1.0 -t kantahe .
#
# The web app and the Go binary are built on the build machine's own architecture (the Go compiler
# cross-compiles), so building for arm64 needs no emulation; only running the result does.

FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npx ng build

FROM --platform=$BUILDPLATFORM alpine:3.22 AS soundfont
RUN apk add --no-cache curl ca-certificates
COPY scripts/soundfont.lock /soundfont.lock
RUN set -eu; \
    url=$(sed -n 's/^URL=//p' /soundfont.lock); \
    want=$(sed -n 's/^SHA256=//p' /soundfont.lock); \
    curl -fsSL -o /GeneralUser-GS.sf2 "$url"; \
    echo "$want  /GeneralUser-GS.sf2" | sha256sum -c -

FROM --platform=$BUILDPLATFORM golang:1.25-bookworm AS build
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
WORKDIR /src/server
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
COPY --from=web /src/web/dist/web/browser/ internal/webui/dist/
COPY --from=soundfont /GeneralUser-GS.sf2 internal/assets/soundfont/GeneralUser-GS.sf2
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags "-s -w -X main.version=$VERSION" -o /out/kantahe ./cmd/kantahe
# empty directories for the final image, which has no shell to make them
RUN mkdir /out-data /out-library

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
COPY --from=build /out/kantahe /kantahe
# the data directory belongs to the unprivileged user (65532) so that a new named volume is writable
COPY --from=build --chown=65532:65532 /out-data /data
COPY --from=build /out-library /library
EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["/kantahe"]
CMD ["--data", "/data", "--library", "/library", "--listen", ":8080"]
