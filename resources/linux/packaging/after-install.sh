#!/bin/bash
# Why: register the bundled `alfred-ide` CLI on PATH at package-install time.
# The in-app "Install CLI" action (CliInstaller) can never run on a headless
# server, so without this symlink `alfred serve` is unreachable from the shell on
# the exact hosts that need it most. deb/rpm both run this after unpacking.
#
# The shim resolves the real app by walking up from its own location, so a
# symlink works. We discover the install dir instead of hardcoding /opt/Alfred
# because electron-builder's directory name can vary by productName sanitization.
set -e

link="/usr/bin/alfred-ide"

is_owned_link() {
  [ -L "$link" ] || return 1
  local link_target candidate candidate_target
  link_target="$(readlink -f -- "$link" 2>/dev/null || true)"
  for candidate in /opt/Alfred/resources/bin/alfred-ide /opt/alfred-ide/resources/bin/alfred-ide /opt/alfred/resources/bin/alfred-ide; do
    candidate_target="$(readlink -f -- "$candidate" 2>/dev/null || true)"
    if [ -n "$candidate_target" ] && [ "$link_target" = "$candidate_target" ]; then
      return 0
    fi
  done
  return 1
}

for dir in /opt/Alfred /opt/alfred-ide /opt/alfred; do
  sandbox="$dir/chrome-sandbox"
  if [ -f "$sandbox" ]; then
    # Why: packaged Linux installs must leave Chromium's sandbox helper usable
    # on hosts where unprivileged user namespaces are unavailable.
    chmod 4755 "$sandbox" || true
  fi

  shim="$dir/resources/bin/alfred-ide"
  if [ -x "$shim" ]; then
    # Only manage our own symlink; never clobber an unrelated /usr/bin/alfred-ide.
    if { [ ! -e "$link" ] && [ ! -L "$link" ]; } || is_owned_link; then
      ln -sfn -- "$shim" "$link"
    fi
    break
  fi
done

exit 0
