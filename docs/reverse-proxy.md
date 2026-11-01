# HTTPS with a reverse proxy

Kantahe speaks plain HTTP. For use outside your home network, for microphone scoring in browsers (which only
allow the microphone on HTTPS pages) and for the in-page MIDI synthesizer (an AudioWorklet is also HTTPS only;
on plain HTTP the server renders MIDI songs instead), put a reverse proxy in front of it. The examples in
[deploy/proxy/](../deploy/proxy/) are complete: `Caddyfile` (certificates automatic) and `nginx.conf`
(bring your own certificate, for example from certbot).

## What the proxy must do

* **Not buffer the streaming calls.** The app keeps a call open for as long as it is on screen:
  `/kantahe.v1.SessionService/WatchState` (the player state, pushed at every change),
  `/kantahe.v1.AuthService/WaitCodeLogin` (a TV waiting to be approved) and, while an administrator checks the
  library for broken songs, `/kantahe.v1.AdminService/CheckLibrary` (its progress). A stream can be silent for
  minutes at a time. A proxy that collects the response before passing it on makes the app look frozen: Caddy needs
  `flush_interval -1`, nginx `proxy_buffering off` and `proxy_read_timeout 1h` on those three paths.
* **Allow big uploads.** The server accepts 50 MiB per song by default (an admin can raise it to 1 GiB);
  the proxy limit must be higher: `request_body { max_size 64MiB }` in Caddy, `client_max_body_size 64m` in
  nginx. Raise both together if you raise the server's limit.
  A background video goes up in requests of 4 MiB, one after the other, so the limit must be at least 5 MiB;
  the 64 MiB above covers it.
* **Pass the background videos through.** Players fetch `/media/video/...` (files of tens to hundreds of MB) with `Range`
  headers and expect `206` answers as the server gives them. The server sets the cache headers itself (a strong `ETag` and
  `Cache-Control: private, max-age=21600`), so the proxy must not add caching, and it should not buffer them: Caddy's
  `flush_interval -1` above covers it, nginx needs `proxy_buffering off` on `/media/video/` (the example has it).
* **Pass the client address.** Both examples send `X-Forwarded-For`. Kantahe believes that header only from
  proxies you name, so start it with `--trusted-proxies` set to the proxy's address, for example
  `--trusted-proxies 127.0.0.1/32` when the proxy runs on the same machine. Without it the server sees
  every visitor as the proxy, and its protection against password guessing counts them all together.
  The value is a list of CIDR ranges separated by commas (`127.0.0.1/32`, not a bare address); for a proxy
  in another container use the range of the Docker network. Caddy sets `X-Forwarded-For` itself; nginx
  appends to it as configured in the example.
* **Know its public address.** Start Kantahe with `--public-url https://karaoke.example.com`, the address
  TVs show in the QR code for approving a sign-in from a phone.

Bind Kantahe to the loopback address when the proxy is on the same machine:
`--listen 127.0.0.1:8080`.

## Caddy

```sh
sudo cp deploy/proxy/Caddyfile /etc/caddy/Caddyfile      # change the host name first
sudo systemctl reload caddy
```

## nginx

Needs nginx 1.25.1 or newer (`http2 on`). Copy the two `server` blocks into your `http` block, change the
host name and the certificate paths, then `sudo nginx -t && sudo systemctl reload nginx`.

## Checking your setup

Sign in through the proxy and open the player page on a second device: a song queued on one must appear
on the other at once. If it only appears after a reload or after a long delay, a proxy is buffering the
stream. Leave a tab open for ten minutes: it must stay connected without reconnect notices.

The files in `deploy/proxy/` are checked by `scripts/check-proxy-configs.sh` (needs `caddy` and `nginx`
or Docker).
