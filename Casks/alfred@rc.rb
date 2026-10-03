cask "alfred@rc" do
  disable! date: "2026-09-18", because: "awaiting the first Alfred workspace release and verified checksums"

  arch arm: "arm64", intel: "x64"

  version "1.4.36-rc.3"
  sha256 arm:   "563b6b14323fc9d5489299c82442d514bc12cabffc9d06d3964ed572af4b3955",
         intel: "457088c7021f07de1a419197f7b2bd00092741ad4727d4fef3d86af38a6831e7"

  url "https://github.com/GOI17/alfred-workspace/releases/download/v#{version}/alfred-macos-#{arch}.dmg",
      verified: "github.com/GOI17/alfred-workspace/"
  name "Alfred workspace RC"
  desc "IDE for orchestrating AI coding agents across terminals and worktrees"
  homepage "https://alfredlabs.org/"

  livecheck do
    url "https://github.com/GOI17/alfred-workspace"
    regex(/^v?(\d+(?:\.\d+)+-rc\.\d+)$/i)
    strategy :github_releases do |json, regex|
      json.map do |release|
        next if release["draft"]
        next unless release["prerelease"]

        match = release["tag_name"]&.match(regex)
        next if match.blank?

        match[1]
      end
    end
  end

  # Why: RC installs should follow Alfred's prerelease-aware updater instead of
  # waiting for Homebrew metadata churn between frequent release candidates.
  auto_updates true
  conflicts_with cask: "alfred"
  depends_on macos: :big_sur

  app "Alfred workspace.app"

  # Why: expose the bundled `alfred` CLI on PATH at install time (Homebrew symlinks
  # this into its already-on-PATH bin dir). Without it, the CLI is only registered
  # by the in-app "Install CLI" action, which a headless host can never trigger —
  # so `alfred serve` on a server would be unreachable from the shell. The shim
  # resolves the real app by walking symlinks, so the Homebrew symlink works.
  binary "#{appdir}/Alfred workspace.app/Contents/Resources/bin/alfred"

  # Why: Alfred writes user data under ~/.alfred (worktrees, agent state) and
  # Electron's standard userData directories. Zap removes everything the app
  # creates during normal use so `brew uninstall --zap` is a clean slate.
  zap trash: [
    "~/.alfred",
    "~/Library/Application Support/Alfred workspace",
    "~/Library/Application Support/alfred-workspace",
    "~/Library/Caches/org.alfredlabs.workspace",
    "~/Library/Caches/org.alfredlabs.workspace.ShipIt",
    "~/Library/HTTPStorages/org.alfredlabs.workspace",
    "~/Library/Preferences/org.alfredlabs.workspace.plist",
    "~/Library/Saved Application State/org.alfredlabs.workspace.savedState",
  ]
end
