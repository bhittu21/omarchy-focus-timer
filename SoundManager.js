.pragma library

// SoundManager.js
// Handles offline completion sound playback.

function playSound(quickshell, soundFilePath) {
  if (!quickshell || typeof quickshell.execDetached !== "function") {
    return false;
  }
  if (!soundFilePath) return false;

  // Attempt playback with standard Linux pipewire / pulse / alsa backends
  // wrapped in a shell fallback sequence that runs detached.
  var cmd = "pw-play '" + soundFilePath + "' 2>/dev/null || " +
            "paplay '" + soundFilePath + "' 2>/dev/null || " +
            "aplay -q '" + soundFilePath + "' 2>/dev/null || " +
            "canberra-gtk-play -f '" + soundFilePath + "' 2>/dev/null || true";

  try {
    quickshell.execDetached(["bash", "-c", cmd]);
    return true;
  } catch (err) {
    // Audio failure must never crash the plugin
    return false;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    playSound: playSound
  };
}
