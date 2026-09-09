.pragma library

// TimerEngine.js
// State machine and timestamp-based countdown calculations for Omarchy Focus Timer.

function createIdleState() {
  return {
    status: "idle",
    schedule: [],
    phaseIndex: 0,
    totalSeconds: 0,
    requestedMinutes: 0,
    phaseStartTime: 0,
    elapsedInPhaseBeforePause: 0
  };
}

function startTimer(minutes, schedule, nowMs) {
  var now = Number(nowMs) || Date.now();
  var min = Number(minutes) || 0;
  var sched = Array.isArray(schedule) ? schedule : [];

  var total = 0;
  for (var i = 0; i < sched.length; i++) {
    total += sched[i].duration;
  }

  return {
    status: "running",
    schedule: sched,
    phaseIndex: 0,
    totalSeconds: total,
    requestedMinutes: min,
    phaseStartTime: now,
    elapsedInPhaseBeforePause: 0
  };
}

function pauseTimer(state, nowMs) {
  if (!state || state.status !== "running") return state;
  var now = Number(nowMs) || Date.now();

  var elapsedInRun = Math.floor((now - state.phaseStartTime) / 1000);
  if (elapsedInRun < 0) elapsedInRun = 0;

  var accumulated = (state.elapsedInPhaseBeforePause || 0) + elapsedInRun;

  return {
    status: "paused",
    schedule: state.schedule,
    phaseIndex: state.phaseIndex,
    totalSeconds: state.totalSeconds,
    requestedMinutes: state.requestedMinutes,
    phaseStartTime: state.phaseStartTime,
    elapsedInPhaseBeforePause: accumulated
  };
}

function resumeTimer(state, nowMs) {
  if (!state || state.status !== "paused") return state;
  var now = Number(nowMs) || Date.now();

  return {
    status: "running",
    schedule: state.schedule,
    phaseIndex: state.phaseIndex,
    totalSeconds: state.totalSeconds,
    requestedMinutes: state.requestedMinutes,
    phaseStartTime: now,
    elapsedInPhaseBeforePause: state.elapsedInPhaseBeforePause || 0
  };
}

function cancelTimer() {
  return createIdleState();
}

function tickTimer(state, nowMs) {
  if (!state || state.status !== "running") {
    return {
      state: state || createIdleState(),
      event: null
    };
  }

  var now = Number(nowMs) || Date.now();
  var elapsedInRun = Math.floor((now - state.phaseStartTime) / 1000);
  if (elapsedInRun < 0) elapsedInRun = 0;

  var elapsedInPhase = (state.elapsedInPhaseBeforePause || 0) + elapsedInRun;
  var sched = state.schedule;
  var pIndex = state.phaseIndex;

  if (!sched || sched.length === 0 || pIndex >= sched.length) {
    return {
      state: createIdleState(),
      event: { type: "completed", requestedMinutes: state.requestedMinutes, totalSeconds: state.totalSeconds }
    };
  }

  var currentPhase = sched[pIndex];

  // Did the current phase elapse?
  if (elapsedInPhase >= currentPhase.duration) {
    var nextIndex = pIndex + 1;
    if (nextIndex < sched.length) {
      // Advance to next phase
      var nextState = {
        status: "running",
        schedule: sched,
        phaseIndex: nextIndex,
        totalSeconds: state.totalSeconds,
        requestedMinutes: state.requestedMinutes,
        phaseStartTime: now,
        elapsedInPhaseBeforePause: 0
      };
      return {
        state: nextState,
        event: {
          type: "phaseChanged",
          fromIndex: pIndex,
          toIndex: nextIndex,
          phase: sched[nextIndex]
        }
      };
    } else {
      // Entire session finished!
      return {
        state: createIdleState(),
        event: {
          type: "completed",
          requestedMinutes: state.requestedMinutes,
          totalSeconds: state.totalSeconds
        }
      };
    }
  }

  return {
    state: state,
    event: null
  };
}

function computeViewDetails(state, nowMs) {
  if (!state || state.status === "idle" || !state.schedule || state.schedule.length === 0) {
    return {
      active: false,
      status: "idle",
      phaseType: "focus",
      phaseDuration: 0,
      remainingInPhase: 0,
      elapsedInPhase: 0,
      phaseProgress: 0.0,
      sessionElapsed: 0,
      sessionRemaining: 0,
      sessionProgress: 0.0,
      focusSessionIndex: 1,
      totalFocusSessions: 1,
      nextPhaseText: ""
    };
  }

  var now = Number(nowMs) || Date.now();
  var sched = state.schedule;
  var pIndex = Math.min(state.phaseIndex, sched.length - 1);
  var currentPhase = sched[pIndex];

  var elapsedInPhase = 0;
  if (state.status === "running") {
    var delta = Math.floor((now - state.phaseStartTime) / 1000);
    elapsedInPhase = (state.elapsedInPhaseBeforePause || 0) + Math.max(0, delta);
  } else if (state.status === "paused") {
    elapsedInPhase = state.elapsedInPhaseBeforePause || 0;
  }

  var phaseDuration = currentPhase.duration;
  var remainingInPhase = Math.max(0, phaseDuration - elapsedInPhase);
  var phaseProgress = phaseDuration > 0 ? Math.min(1.0, elapsedInPhase / phaseDuration) : 0.0;

  // Compute total session elapsed time across previous phases
  var previousPhasesDuration = 0;
  var focusCount = 0;
  var currentFocusIndex = 1;

  for (var i = 0; i < sched.length; i++) {
    if (sched[i].type === "focus") {
      focusCount++;
      if (i <= pIndex) {
        currentFocusIndex = focusCount;
      }
    }
    if (i < pIndex) {
      previousPhasesDuration += sched[i].duration;
    }
  }

  var sessionElapsed = Math.min(state.totalSeconds, previousPhasesDuration + elapsedInPhase);
  var sessionRemaining = Math.max(0, state.totalSeconds - sessionElapsed);
  var sessionProgress = state.totalSeconds > 0 ? Math.min(1.0, sessionElapsed / state.totalSeconds) : 0.0;

  var nextText = "FINAL PERIOD";
  if (pIndex + 1 < sched.length) {
    var nextPhase = sched[pIndex + 1];
    var nextMin = Math.round(nextPhase.duration / 60);
    var nextMinStr = (nextMin < 10 ? "0" : "") + nextMin;
    nextText = (nextPhase.type === "break" ? "BREAK " : "FOCUS ") + nextMinStr + ":00";
  }

  return {
    active: true,
    status: state.status,
    phaseType: currentPhase.type,
    phaseDuration: phaseDuration,
    remainingInPhase: remainingInPhase,
    elapsedInPhase: elapsedInPhase,
    phaseProgress: phaseProgress,
    sessionElapsed: sessionElapsed,
    sessionRemaining: sessionRemaining,
    sessionProgress: sessionProgress,
    focusSessionIndex: currentFocusIndex,
    totalFocusSessions: Math.max(1, focusCount),
    nextPhaseText: nextText
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createIdleState: createIdleState,
    startTimer: startTimer,
    pauseTimer: pauseTimer,
    resumeTimer: resumeTimer,
    cancelTimer: cancelTimer,
    tickTimer: tickTimer,
    computeViewDetails: computeViewDetails
  };
}
