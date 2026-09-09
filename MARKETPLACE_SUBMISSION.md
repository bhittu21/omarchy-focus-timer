### Repository URL

https://github.com/bhittu21/omarchy-focus-timer

### Category

Productivity

### Tags

bar, quickshell

### Suggest a missing tag

_No response_

### Maintainer notes

A minimal, production-ready offline focus timer plugin for Omarchy Quattro. It accepts a requested total session duration and automatically schedules focus intervals and 5-minute breaks while strictly guaranteeing the total requested elapsed time. Features local state persistence via FileView, wall-clock timestamp drift prevention, bundled CC0 audio chime, desktop notifications upon complete session end, and a minimalist monospace/terminal aesthetic.

**Security Baseline Transparency (Manual Review):**
- **Remote Source (`remote-build`)**: The automated baseline detects `remote-build` because the README provides transparent `git clone` instructions for developers/users installing directly from this public repository. The repository contains no build scripts, external binary downloads, or remote code execution.
- **Process Execution**: Strictly limited to `mkdir -p ~/.cache/omarchy-focus-timer` for state caching, `notify-send` for end-of-session desktop notifications, and standard Linux audio backends (`pw-play` / `paplay` / `aplay`) to play the bundled offline chime.
- **Network**: Completely offline with zero network sockets or telemetry.

### Submission checklist

- [x] The repository is public and contains installation and removal instructions.
- [x] I have documented the plugin license and any external dependencies.
- [x] I confirm that I own or have permission to submit this plugin and its preview assets.
- [x] The plugin does not overwrite user configuration without explicit consent.
- [x] I understand that approval is for listing and is not a security review.
