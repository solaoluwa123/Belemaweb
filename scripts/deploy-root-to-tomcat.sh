#!/usr/bin/env bash
# Run ON THE SERVER after copying ROOT.war to your home directory, e.g.:
#   scp ROOT.war john.nkwachi@172.17.10.128:~/
# Then:
#   chmod +x deploy-root-to-tomcat.sh
#   ./deploy-root-to-tomcat.sh
#
# Requires sudo for Tomcat paths.

set -euo pipefail

WAR_SRC="${HOME}/ROOT.war"
WEBAPPS="/opt/tomcat/webapps"

if [[ ! -f "$WAR_SRC" ]]; then
  echo "Missing $WAR_SRC — copy ROOT.war to your home first."
  exit 1
fi

echo "Stopping Tomcat..."
sudo systemctl stop tomcat10

echo "Removing old ROOT (exploded + war)..."
sudo rm -rf "${WEBAPPS}/ROOT"
sudo rm -f "${WEBAPPS}/ROOT.war"

echo "Installing new ROOT.war..."
sudo cp "$WAR_SRC" "${WEBAPPS}/ROOT.war"
sudo chown tomcat:tomcat "${WEBAPPS}/ROOT.war"

echo "Starting Tomcat..."
sudo systemctl start tomcat10

echo "Done. Check: http://$(hostname -I | awk '{print $1}'):8080/"
sudo systemctl --no-pager status tomcat10 || true
