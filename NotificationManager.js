.pragma library

// NotificationManager.js
// Dispatches desktop notifications upon complete session finish.

function notifySessionComplete(quickshell, requestedMinutes) {
  var minutes = Number(requestedMinutes) || 0;
  var title = "Focus session complete";
  var message = "Your " + minutes + " minute session is finished.";

  if (!quickshell || typeof quickshell.execDetached !== "function") {
    return false;
  }

  try {
    quickshell.execDetached([
      "notify-send",
      "-a", "Omarchy Focus Timer",
      "-i", "preferences-system-time",
      title,
      message
    ]);
    return true;
  } catch (e) {
    // Notification failure must never crash the plugin
    return false;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    notifySessionComplete: notifySessionComplete
  };
}
