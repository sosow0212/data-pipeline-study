FROM golang:1.24.7-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /core ./cmd/api
FROM alpine:3.22
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
USER app
COPY --from=build /core /usr/local/bin/core
EXPOSE 8080
ENTRYPOINT ["core"]
