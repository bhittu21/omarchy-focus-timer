.pragma library

// ScheduleGenerator.js
// Handles smart duration splitting and time formatting for Omarchy Focus Timer.
//
// Rules:
// - <= 40 minutes: single continuous focus period, no breaks.
// - > 40 minutes: 5-minute breaks introduced between focus periods.
// - Focus periods target approximately 25 minutes (1500 seconds).
// - Breaks count toward the total requested session duration.
// - sum(schedule durations) == requested total duration exactly (second-level accuracy).

function generateSchedule(totalSeconds) {
  var seconds = Math.floor(Number(totalSeconds) || 0);
  if (seconds <= 0) return [];

  // <= 40 minutes (2400 seconds): single continuous focus session
  if (seconds <= 2400) {
    return [
      {
        type: "focus",
        duration: seconds
      }
    ];
  }

  // > 40 minutes: introduce 5-minute (300s) breaks.
  var breakDuration = 300;
  var targetFocusDuration = 1500; // 25 minutes

  // Calculate the optimal number of breaks (k >= 1)
  // Each break of 300s leaves (seconds - k * 300) focus time to be split among (k + 1) periods.
  var maxBreaks = Math.max(1, Math.floor((seconds - 300) / 1800));
  var bestK = 1;
  var minDiff = Infinity;

  for (var k = 1; k <= maxBreaks; k++) {
    var totalFocusTime = seconds - (k * breakDuration);
    if (totalFocusTime <= 0) break;
    var numFocusPeriods = k + 1;
    var avgFocus = totalFocusTime / numFocusPeriods;
    var diff = Math.abs(avgFocus - targetFocusDuration);

    if (diff < minDiff) {
      minDiff = diff;
      bestK = k;
    }
  }

  var numPeriods = bestK + 1;
  var focusTime = seconds - (bestK * breakDuration);
  var focusDurations = [];

  // Distribution strategy:
  // If 2 focus periods and total focus time is less than 50 minutes (3000s, e.g. 45m total with 40m focus),
  // split focus evenly so both periods are balanced (~20:00 each).
  if (numPeriods === 2 && focusTime < 3000) {
    var firstPeriod = Math.floor(focusTime / 2);
    var secondPeriod = focusTime - firstPeriod;
    focusDurations.push(firstPeriod);
    focusDurations.push(secondPeriod);
  } else {
    // For standard sessions (60m, 75m, 90m, 120m, etc.):
    // Give the first (numPeriods - 1) focus periods exactly 25 minutes (1500s).
    // The final focus period absorbs the remaining focus time.
    var accumulatedFocus = 0;
    for (var p = 0; p < numPeriods - 1; p++) {
      focusDurations.push(targetFocusDuration);
      accumulatedFocus += targetFocusDuration;
    }
    var remainingFocus = focusTime - accumulatedFocus;
    focusDurations.push(remainingFocus);
  }

  // Interleave focus periods with 5-minute break periods
  var schedule = [];
  for (var i = 0; i < focusDurations.length; i++) {
    schedule.push({
      type: "focus",
      duration: focusDurations[i]
    });
    if (i < focusDurations.length - 1) {
      schedule.push({
        type: "break",
        duration: breakDuration
      });
    }
  }

  return schedule;
}

function formatTime(totalSeconds) {
  var sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  var hours = Math.floor(sec / 3600);
  var minutes = Math.floor((sec % 3600) / 60);
  var seconds = sec % 60;

  var mm = (minutes < 10 ? "0" : "") + minutes;
  var ss = (seconds < 10 ? "0" : "") + seconds;

  if (hours > 0) {
    var hh = (hours < 10 ? "0" : "") + hours;
    return hh + ":" + mm + ":" + ss;
  }
  return mm + ":" + ss;
}

function formatDurationLabel(totalSeconds) {
  var sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  var hours = Math.floor(sec / 3600);
  var minutes = Math.floor((sec % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return hours + "h " + minutes + "m";
  } else if (hours > 0) {
    return hours + "h";
  }
  return minutes + "m";
}

function generateProgressBar(ratio, width) {
  var totalChars = width || 20;
  var clamped = Math.max(0.0, Math.min(1.0, Number(ratio) || 0.0));
  var filledCount = Math.round(clamped * totalChars);
  var emptyCount = Math.max(0, totalChars - filledCount);

  var filledStr = "";
  for (var i = 0; i < filledCount; i++) filledStr += "█";
  var emptyStr = "";
  for (var j = 0; j < emptyCount; j++) emptyStr += "░";

  return filledStr + emptyStr;
}

function validateDurationInput(rawInput) {
  var str = String(rawInput || "").trim();
  if (str === "") {
    return { valid: false, error: "Duration cannot be empty." };
  }
  var num = Number(str);
  if (isNaN(num) || !Number.isFinite(num) || Math.floor(num) !== num) {
    return { valid: false, error: "Enter a whole number of minutes." };
  }
  if (num <= 0) {
    return { valid: false, error: "Duration must be greater than 0." };
  }
  if (num > 1440) {
    return { valid: false, error: "Maximum session is 1440 minutes (24 hours)." };
  }

  return {
    valid: true,
    minutes: num,
    seconds: num * 60,
    error: ""
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateSchedule: generateSchedule,
    formatTime: formatTime,
    formatDurationLabel: formatDurationLabel,
    generateProgressBar: generateProgressBar,
    validateDurationInput: validateDurationInput
  };
}
