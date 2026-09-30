#!/usr/bin/env bash
# Build and copy printer-ui to the printer host. Needs no sudo: it only
# writes ~/printer-ui there. Installing the nginx site is a one-time step,
# printed at the end.
set -euo pipefail

HOST="${DEPLOY_HOST:-harrison@192.168.0.140}"
REMOTE_DIR="${DEPLOY_DIR:-printer-ui}"

cd "$(dirname "$0")/.."

npm run build
# tar over ssh (the host has no rsync). Unpack beside the live copy and swap,
# so nginx never serves a half-written build.
tar -C dist -cz . | ssh "$HOST" "set -e
  mkdir -p $REMOTE_DIR
  rm -rf $REMOTE_DIR/dist.new
  mkdir $REMOTE_DIR/dist.new
  tar -xz -C $REMOTE_DIR/dist.new
  rm -rf $REMOTE_DIR/dist.old
  if [ -d $REMOTE_DIR/dist ]; then mv $REMOTE_DIR/dist $REMOTE_DIR/dist.old; fi
  mv $REMOTE_DIR/dist.new $REMOTE_DIR/dist
  rm -rf $REMOTE_DIR/dist.old"
scp -q deploy/nginx-printer-ui.conf deploy/nginx-printer-ui-ender5.conf deploy/host-battery.py "$HOST:$REMOTE_DIR/"

echo
echo "Deployed to $HOST:~/$REMOTE_DIR/dist"
echo "First deploy only — install the nginx site on the host (needs sudo):"
echo "  sudo cp ~/$REMOTE_DIR/nginx-printer-ui.conf /etc/nginx/sites-available/printer-ui"
echo "  sudo ln -s /etc/nginx/sites-available/printer-ui /etc/nginx/sites-enabled/printer-ui"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo "Ender 5 site (port 4412 → Moonraker 7126), likewise once:"
echo "  sudo cp ~/$REMOTE_DIR/nginx-printer-ui-ender5.conf /etc/nginx/sites-available/printer-ui-ender5"
echo "  sudo ln -s /etc/nginx/sites-available/printer-ui-ender5 /etc/nginx/sites-enabled/printer-ui-ender5"
echo "  sudo nginx -t && sudo systemctl reload nginx"
