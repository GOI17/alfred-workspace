#!/bin/bash
# Why: remove the PATH symlink that after-install.sh created, but only if it
# still points into an Alfred install dir — never delete an unrelated
# /usr/bin/alfred-ide a user or other package may own.
set -e

# RPM passes an instance count; dpkg passes the package lifecycle action.
case "${1-}" in
  0 | remove | purge) ;;
  *) exit 0 ;;
esac

link="/usr/bin/alfred-ide"

if [ -L "$link" ]; then
  target="$(readlink "$link" || true)"
  case "$target" in
    /opt/Alfred/*|/opt/alfred-ide/*|/opt/alfred/*)
      rm -f "$link"
      ;;
  esac
fi

exit 0
