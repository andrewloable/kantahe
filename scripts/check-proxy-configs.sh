#!/usr/bin/env bash
# Checks the reverse-proxy examples in deploy/proxy: the settings that streaming and uploads
# depend on are present, and Caddy and nginx accept the files. Uses a local caddy / nginx when
# installed, else their official Docker images.
set -euo pipefail
cd "$(dirname "$0")/.."
caddyfile=deploy/proxy/Caddyfile
nginxconf=deploy/proxy/nginx.conf
caddy_image=caddy:2-alpine
nginx_image=nginx:stable-alpine
fail() { echo "check-proxy-configs: $*" >&2; exit 1; }

[ -f "$caddyfile" ] && [ -f "$nginxconf" ] || fail "missing $caddyfile or $nginxconf"

# 1. the settings without which streaming or uploads break
grep -Eq '^\s*flush_interval -1$' "$caddyfile" || fail "Caddyfile: reverse_proxy needs flush_interval -1"
grep -Eq '^\s*max_size 64MiB$' "$caddyfile" || fail "Caddyfile: request_body needs max_size 64MiB"
grep -Eq '^\s*client_max_body_size 64m;$' "$nginxconf" || fail "nginx.conf: client_max_body_size 64m missing"
grep -Eq 'proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;' "$nginxconf" || fail "nginx.conf: X-Forwarded-For is not set"
for rpc in /kantahe.v1.SessionService/WatchState /kantahe.v1.AuthService/WaitCodeLogin; do
  block=$(awk -v loc="location = $rpc " 'index($0, loc) {p=1} p {print} p && /^\t\t}/ {exit}' "$nginxconf")
  [ -n "$block" ] || fail "nginx.conf: no location for $rpc"
  grep -q 'proxy_buffering off;' <<<"$block" || fail "nginx.conf: $rpc needs proxy_buffering off"
  grep -q 'proxy_read_timeout 1h;' <<<"$block" || fail "nginx.conf: $rpc needs proxy_read_timeout 1h"
done

# 2. the servers accept the files
if command -v caddy >/dev/null; then
  caddy validate --config "$caddyfile" --adapter caddyfile >/dev/null 2>&1 || { caddy validate --config "$caddyfile" --adapter caddyfile; fail "caddy rejects the Caddyfile"; }
else
  docker run --rm -v "$PWD/$caddyfile:/etc/caddy/Caddyfile:ro" "$caddy_image" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null ||
    fail "caddy rejects the Caddyfile"
fi

# nginx -t reads the certificate files, so make throwaway ones
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=karaoke.example.com \
  -keyout "$tmp/privkey.pem" -out "$tmp/fullchain.pem" >/dev/null 2>&1
if command -v nginx >/dev/null; then
  # the live paths in the example do not exist here: point them at the throwaway certificate
  sed "s#/etc/letsencrypt/live/karaoke.example.com#$tmp#" "$nginxconf" >"$tmp/nginx.conf"
  nginx -t -c "$tmp/nginx.conf" -e "$tmp/error.log" -p "$tmp" || fail "nginx rejects nginx.conf"
else
  docker run --rm -v "$PWD/$nginxconf:/etc/nginx/nginx.conf:ro" \
    -v "$tmp:/etc/letsencrypt/live/karaoke.example.com:ro" "$nginx_image" nginx -t || fail "nginx rejects nginx.conf"
fi
echo "proxy configs ok"
