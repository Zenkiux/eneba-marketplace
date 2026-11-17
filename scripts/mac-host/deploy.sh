#!/bin/sh
# Builds the app and (re)starts it as a background service on this Mac, served publicly through
# a Cloudflare Tunnel at https://keyshop.zenkiux.com. See docs/deployment-plan.md.
#
#   scripts/mac-host/deploy.sh            build + install + (re)start the API service
#   scripts/mac-host/deploy.sh tunnel     install/restart the cloudflared tunnel service
#   scripts/mac-host/deploy.sh status     show both services and a health check
#   scripts/mac-host/deploy.sh seed       re-apply the (idempotent) demo seed to production after data changes
#
# Secrets live in ~/.keyshop/prod.env (chmod 600, never in git).
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
HOME_DIR="$HOME/.keyshop"
AGENTS="$HOME/Library/LaunchAgents"
API_LABEL=com.zenkiux.keyshop.api
TUNNEL_LABEL=com.zenkiux.keyshop.tunnel
UID_NUM=$(id -u)

plist() { # label, command
  cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string><string>$2</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$HOME_DIR/logs/$1.log</string>
  <key>StandardErrorPath</key><string>$HOME_DIR/logs/$1.log</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin</string></dict>
</dict></plist>
PLIST
}

restart() { # label
  launchctl bootout "gui/$UID_NUM/$1" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_NUM" "$AGENTS/$1.plist"
}

case "${1:-deploy}" in
deploy)
  test -f "$HOME_DIR/prod.env" || { echo "missing $HOME_DIR/prod.env"; exit 1; }
  echo "building API…"
  (cd "$REPO/api" && go build -o "$HOME_DIR/bin/server" ./cmd/server && go build -o "$HOME_DIR/bin/import-eneba" ./cmd/import-eneba)
  echo "building website…"
  (cd "$REPO/web" && npm run build >/dev/null)
  rsync -a --delete "$REPO/web/dist/" "$HOME_DIR/web/"
  mkdir -p "$AGENTS" "$HOME_DIR/logs"
  plist "$API_LABEL" "set -a; . $HOME_DIR/prod.env; exec $HOME_DIR/bin/server" > "$AGENTS/$API_LABEL.plist"
  restart "$API_LABEL"
  for i in $(seq 1 30); do curl -sf http://127.0.0.1:8090/api/healthz >/dev/null && { echo "API up on 127.0.0.1:8090"; exit 0; }; sleep 1; done
  echo "API did not become healthy; see $HOME_DIR/logs/$API_LABEL.log"; exit 1 ;;
tunnel)
  test -f "$HOME/.cloudflared/config.yml" || { echo "missing ~/.cloudflared/config.yml"; exit 1; }
  plist "$TUNNEL_LABEL" "exec cloudflared --no-autoupdate tunnel run keyshop" > "$AGENTS/$TUNNEL_LABEL.plist"
  restart "$TUNNEL_LABEL"
  echo "tunnel service (re)started" ;;
seed)
  (cd "$REPO/api" && go build -o "$HOME_DIR/bin/seed" ./cmd/seed)
  (set -a; . "$HOME_DIR/prod.env"; "$HOME_DIR/bin/seed") ;;
status)
  launchctl print "gui/$UID_NUM/$API_LABEL" 2>/dev/null | grep -E "state =|pid =" | head -2 || echo "api: not loaded"
  launchctl print "gui/$UID_NUM/$TUNNEL_LABEL" 2>/dev/null | grep -E "state =|pid =" | head -2 || echo "tunnel: not loaded"
  curl -s http://127.0.0.1:8090/api/healthz; echo ;;
*) echo "usage: $0 [deploy|tunnel|status|seed]"; exit 2 ;;
esac
