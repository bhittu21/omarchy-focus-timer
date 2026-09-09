.pragma library

// Persistence.js
// Local cache state serialization, deserialization, and crash recovery.

function getCacheDir(homePath) {
  var home = homePath || (typeof process !== "undefined" && process.env ? process.env.HOME : "");
  return (home ? home.replace(/\/$/, "") : "") + "/.cache/omarchy-focus-timer";
}

function getStateFilePath(homePath) {
  return getCacheDir(homePath) + "/state.json";
}

function serializeState(timerState) {
  if (!timerState || timerState.status === "idle") {
    return JSON.stringify({
      version: 1,
      status: "idle",
      savedAt: Date.now()
    }, null, 2) + "\n";
  }

  var payload = {
    version: 1,
    status: timerState.status,
    totalSeconds: timerState.totalSeconds || 0,
    requestedMinutes: timerState.requestedMinutes || 0,
    schedule: Array.isArray(timerState.schedule) ? timerState.schedule : [],
    phaseIndex: Number(timerState.phaseIndex) || 0,
    phaseStartTime: Number(timerState.phaseStartTime) || 0,
    elapsedInPhaseBeforePause: Number(timerState.elapsedInPhaseBeforePause) || 0,
    savedAt: Date.now()
  };

  return JSON.stringify(payload, null, 2) + "\n";
}

function deserializeState(rawJson) {
  if (!rawJson || typeof rawJson !== "string") return null;
  var text = rawJson.trim();
  if (!text) return null;

  try {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1) return null;

    if (parsed.status === "idle") {
      return { status: "idle" };
    }

    if (parsed.status !== "running" && parsed.status !== "paused") {
      return null;
    }

    if (!Array.isArray(parsed.schedule) || parsed.schedule.length === 0) {
      return null;
    }

    // Verify all schedule entries
    for (var i = 0; i < parsed.schedule.length; i++) {
      var item = parsed.schedule[i];
      if (!item || typeof item !== "object") return null;
      if (item.type !== "focus" && item.type !== "break") return null;
      if (typeof item.duration !== "number" || item.duration <= 0) return null;
    }

    var phaseIndex = Number(parsed.phaseIndex);
    if (isNaN(phaseIndex) || phaseIndex < 0 || phaseIndex >= parsed.schedule.length) {
      return null;
    }

    return {
      version: 1,
      status: parsed.status,
      totalSeconds: Number(parsed.totalSeconds) || 0,
      requestedMinutes: Number(parsed.requestedMinutes) || 0,
      schedule: parsed.schedule,
      phaseIndex: phaseIndex,
      phaseStartTime: Number(parsed.phaseStartTime) || 0,
      elapsedInPhaseBeforePause: Number(parsed.elapsedInPhaseBeforePause) || 0,
      savedAt: Number(parsed.savedAt) || 0
    };
  } catch (err) {
    // Malformed JSON is safely handled
    return null;
  }
}

function resolveStateOnStartup(savedState, nowMs) {
  var now = Number(nowMs) || Date.now();

  if (!savedState || savedState.status === "idle") {
    return {
      status: "idle",
      schedule: [],
      phaseIndex: 0,
      totalSeconds: 0,
      requestedMinutes: 0,
      expiredWhileOffline: false
    };
  }

  // If saved in PAUSED state, preserve exact paused position
  if (savedState.status === "paused") {
    return {
      status: "paused",
      schedule: savedState.schedule,
      phaseIndex: savedState.phaseIndex,
      totalSeconds: savedState.totalSeconds,
      requestedMinutes: savedState.requestedMinutes,
      phaseStartTime: savedState.phaseStartTime,
      elapsedInPhaseBeforePause: savedState.elapsedInPhaseBeforePause,
      expiredWhileOffline: false
    };
  }

  // If saved in RUNNING state, calculate elapsed wall-clock duration
  if (savedState.status === "running") {
    var elapsedSec = Math.floor((now - savedState.phaseStartTime) / 1000) + (savedState.elapsedInPhaseBeforePause || 0);
    if (elapsedSec < 0) elapsedSec = 0;

    var pIndex = savedState.phaseIndex;
    var sched = savedState.schedule;

    while (pIndex < sched.length && elapsedSec >= sched[pIndex].duration) {
      elapsedSec -= sched[pIndex].duration;
      pIndex++;
    }

    if (pIndex >= sched.length) {
      // Complete session expired while shell was offline
      return {
        status: "idle",
        schedule: [],
        phaseIndex: 0,
        totalSeconds: 0,
        requestedMinutes: savedState.requestedMinutes || 0,
        expiredWhileOffline: true
      };
    }

    // Timer is still active in phase pIndex
    return {
      status: "running",
      schedule: sched,
      phaseIndex: pIndex,
      totalSeconds: savedState.totalSeconds,
      requestedMinutes: savedState.requestedMinutes,
      phaseStartTime: now - (elapsedSec * 1000),
      elapsedInPhaseBeforePause: elapsedSec,
      expiredWhileOffline: false
    };
  }

  return {
    status: "idle",
    schedule: [],
    phaseIndex: 0,
    totalSeconds: 0,
    requestedMinutes: 0,
    expiredWhileOffline: false
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getCacheDir: getCacheDir,
    getStateFilePath: getStateFilePath,
    serializeState: serializeState,
    deserializeState: deserializeState,
    resolveStateOnStartup: resolveStateOnStartup
  };
}
