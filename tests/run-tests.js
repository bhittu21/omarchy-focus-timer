// tests/run-tests.js
// Comprehensive test suite for Omarchy Focus Timer.

const fs = require("fs");

// Support QML .pragma library directive in Node.js test environment
require.extensions[".js"] = function(module, filename) {
  let content = fs.readFileSync(filename, "utf8");
  if (content.startsWith(".pragma library")) {
    content = content.replace(/^\.pragma\s+library\s*;?\s*/m, "// .pragma library\n");
  }
  module._compile(content, filename);
};

const assert = require("assert");
const ScheduleGenerator = require("../ScheduleGenerator.js");
const Persistence = require("../Persistence.js");
const TimerEngine = require("../TimerEngine.js");

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("=== Running Schedule Generator Tests ===");

const testDurations = [20, 25, 30, 40, 41, 45, 50, 60, 75, 90, 120];

testDurations.forEach((minutes) => {
  const totalSeconds = minutes * 60;
  runTest(`Duration ${minutes}m: sum(durations) == requested (${totalSeconds}s)`, () => {
    const schedule = ScheduleGenerator.generateSchedule(totalSeconds);
    assert(Array.isArray(schedule), "Schedule must be an array");
    assert(schedule.length > 0, "Schedule must not be empty");

    let sum = 0;
    for (const phase of schedule) {
      assert(phase.type === "focus" || phase.type === "break", "Phase type must be focus or break");
      assert(Number.isInteger(phase.duration), "Duration must be an integer");
      assert(phase.duration > 0, "Duration must be positive");
      sum += phase.duration;
    }

    assert.strictEqual(sum, totalSeconds, `Sum of durations (${sum}) must equal requested total (${totalSeconds})`);
  });
});

runTest("<= 40 minutes has exactly 1 continuous focus period and 0 breaks", () => {
  for (const m of [5, 15, 20, 25, 30, 40]) {
    const sched = ScheduleGenerator.generateSchedule(m * 60);
    assert.strictEqual(sched.length, 1, `Expected 1 phase for ${m}m`);
    assert.strictEqual(sched[0].type, "focus");
    assert.strictEqual(sched[0].duration, m * 60);
  }
});

runTest("> 40 minutes introduces 5-minute (300s) breaks", () => {
  for (const m of [41, 45, 50, 60, 75, 90, 120]) {
    const sched = ScheduleGenerator.generateSchedule(m * 60);
    const breaks = sched.filter(p => p.type === "break");
    assert(breaks.length >= 1, `Expected at least 1 break for ${m}m`);
    for (const b of breaks) {
      assert.strictEqual(b.duration, 300, `Break duration must be 300s (5m) for ${m}m`);
    }
  }
});

runTest("45m schedule produces balanced ~20:00 focus periods", () => {
  const sched = ScheduleGenerator.generateSchedule(45 * 60);
  assert.strictEqual(sched.length, 3);
  assert.strictEqual(sched[0].type, "focus");
  assert.strictEqual(sched[0].duration, 1200); // 20:00
  assert.strictEqual(sched[1].type, "break");
  assert.strictEqual(sched[1].duration, 300);  // 05:00
  assert.strictEqual(sched[2].type, "focus");
  assert.strictEqual(sched[2].duration, 1200); // 20:00
});

runTest("60m schedule produces [25:00 focus, 05:00 break, 30:00 focus]", () => {
  const sched = ScheduleGenerator.generateSchedule(60 * 60);
  assert.strictEqual(sched.length, 3);
  assert.strictEqual(sched[0].type, "focus");
  assert.strictEqual(sched[0].duration, 1500); // 25:00
  assert.strictEqual(sched[1].type, "break");
  assert.strictEqual(sched[1].duration, 300);  // 05:00
  assert.strictEqual(sched[2].type, "focus");
  assert.strictEqual(sched[2].duration, 1800); // 30:00
});

runTest("75m schedule produces [25:00 focus, 05:00 break, 25:00 focus, 05:00 break, 15:00 focus]", () => {
  const sched = ScheduleGenerator.generateSchedule(75 * 60);
  assert.strictEqual(sched.length, 5);
  assert.strictEqual(sched[0].duration, 1500);
  assert.strictEqual(sched[1].duration, 300);
  assert.strictEqual(sched[2].duration, 1500);
  assert.strictEqual(sched[3].duration, 300);
  assert.strictEqual(sched[4].duration, 900);
});

runTest("90m schedule produces [25:00 focus, 05:00 break, 25:00 focus, 05:00 break, 30:00 focus]", () => {
  const sched = ScheduleGenerator.generateSchedule(90 * 60);
  assert.strictEqual(sched.length, 5);
  assert.strictEqual(sched[0].duration, 1500);
  assert.strictEqual(sched[1].duration, 300);
  assert.strictEqual(sched[2].duration, 1500);
  assert.strictEqual(sched[3].duration, 300);
  assert.strictEqual(sched[4].duration, 1800);
});

console.log("\n=== Running Input Validation Tests ===");

runTest("Validate valid duration inputs", () => {
  const v1 = ScheduleGenerator.validateDurationInput("25");
  assert.strictEqual(v1.valid, true);
  assert.strictEqual(v1.minutes, 25);
  assert.strictEqual(v1.seconds, 1500);

  const v2 = ScheduleGenerator.validateDurationInput("  90 ");
  assert.strictEqual(v2.valid, true);
  assert.strictEqual(v2.minutes, 90);

  const v3 = ScheduleGenerator.validateDurationInput("1440");
  assert.strictEqual(v3.valid, true);
});

runTest("Reject invalid duration inputs", () => {
  assert.strictEqual(ScheduleGenerator.validateDurationInput("0").valid, false);
  assert.strictEqual(ScheduleGenerator.validateDurationInput("-10").valid, false);
  assert.strictEqual(ScheduleGenerator.validateDurationInput("abc").valid, false);
  assert.strictEqual(ScheduleGenerator.validateDurationInput("25.5").valid, false);
  assert.strictEqual(ScheduleGenerator.validateDurationInput("").valid, false);
  assert.strictEqual(ScheduleGenerator.validateDurationInput("1441").valid, false);
});

console.log("\n=== Running TimerEngine State Machine Tests ===");

runTest("Start, Pause, and Resume state transitions", () => {
  const sched = ScheduleGenerator.generateSchedule(30 * 60);
  let now = 1000000;
  let state = TimerEngine.startTimer(30, sched, now);

  assert.strictEqual(state.status, "running");
  assert.strictEqual(state.phaseIndex, 0);
  assert.strictEqual(state.phaseStartTime, now);
  assert.strictEqual(state.elapsedInPhaseBeforePause, 0);

  // Advance 30 seconds
  now += 30000;
  state = TimerEngine.pauseTimer(state, now);
  assert.strictEqual(state.status, "paused");
  assert.strictEqual(state.elapsedInPhaseBeforePause, 30);

  // Wait 100 seconds while paused
  now += 100000;
  const view1 = TimerEngine.computeViewDetails(state, now);
  assert.strictEqual(view1.elapsedInPhase, 30);
  assert.strictEqual(view1.remainingInPhase, 1800 - 30);

  // Resume
  state = TimerEngine.resumeTimer(state, now);
  assert.strictEqual(state.status, "running");
  assert.strictEqual(state.phaseStartTime, now);
  assert.strictEqual(state.elapsedInPhaseBeforePause, 30);

  // Advance 20 more seconds
  now += 20000;
  const view2 = TimerEngine.computeViewDetails(state, now);
  assert.strictEqual(view2.elapsedInPhase, 50);
  assert.strictEqual(view2.remainingInPhase, 1800 - 50);
});

runTest("Pause during break preserves state", () => {
  const sched = ScheduleGenerator.generateSchedule(45 * 60); // [1200, 300, 1200]
  let now = 1000000;
  let state = TimerEngine.startTimer(45, sched, now);

  // Fast forward to break phase (index 1)
  now += 1200 * 1000;
  const tick1 = TimerEngine.tickTimer(state, now);
  assert(tick1.event && tick1.event.type === "phaseChanged");
  state = tick1.state;
  assert.strictEqual(state.phaseIndex, 1);
  assert.strictEqual(state.schedule[1].type, "break");

  // Advance 45 seconds into the break
  now += 45 * 1000;
  state = TimerEngine.pauseTimer(state, now);
  assert.strictEqual(state.status, "paused");
  assert.strictEqual(state.elapsedInPhaseBeforePause, 45);

  const view = TimerEngine.computeViewDetails(state, now + 10000);
  assert.strictEqual(view.phaseType, "break");
  assert.strictEqual(view.remainingInPhase, 300 - 45);

  // Resume
  state = TimerEngine.resumeTimer(state, now + 10000);
  assert.strictEqual(state.status, "running");
  assert.strictEqual(state.phaseIndex, 1);
});

runTest("Cancel resets state to idle", () => {
  const sched = ScheduleGenerator.generateSchedule(60 * 60);
  let state = TimerEngine.startTimer(60, sched, Date.now());
  assert.strictEqual(state.status, "running");

  state = TimerEngine.cancelTimer();
  assert.strictEqual(state.status, "idle");
  assert.strictEqual(state.schedule.length, 0);
});

runTest("Timer completion emits event and returns to idle", () => {
  const sched = [{ type: "focus", duration: 10 }];
  let now = 1000000;
  let state = TimerEngine.startTimer(1, sched, now);

  // Advance 9 seconds
  now += 9000;
  let result = TimerEngine.tickTimer(state, now);
  assert.strictEqual(result.event, null);
  assert.strictEqual(result.state.status, "running");

  // Advance to 10 seconds
  now += 1000;
  result = TimerEngine.tickTimer(state, now);
  assert(result.event !== null);
  assert.strictEqual(result.event.type, "completed");
  assert.strictEqual(result.state.status, "idle");
});

console.log("\n=== Running Persistence & Crash Recovery Tests ===");

runTest("Serialize and deserialize active state", () => {
  const sched = ScheduleGenerator.generateSchedule(45 * 60);
  const state = {
    status: "running",
    totalSeconds: 2700,
    requestedMinutes: 45,
    schedule: sched,
    phaseIndex: 1,
    phaseStartTime: 1725900000000,
    elapsedInPhaseBeforePause: 25
  };

  const json = Persistence.serializeState(state);
  const parsed = Persistence.deserializeState(json);

  assert.strictEqual(parsed.status, "running");
  assert.strictEqual(parsed.totalSeconds, 2700);
  assert.strictEqual(parsed.requestedMinutes, 45);
  assert.strictEqual(parsed.phaseIndex, 1);
  assert.strictEqual(parsed.phaseStartTime, 1725900000000);
  assert.strictEqual(parsed.elapsedInPhaseBeforePause, 25);
  assert.strictEqual(parsed.schedule.length, 3);
});

runTest("Startup recovery: restore PAUSED session exactly", () => {
  const sched = ScheduleGenerator.generateSchedule(60 * 60);
  const saved = {
    version: 1,
    status: "paused",
    totalSeconds: 3600,
    requestedMinutes: 60,
    schedule: sched,
    phaseIndex: 0,
    phaseStartTime: 1000000,
    elapsedInPhaseBeforePause: 350
  };

  const restored = Persistence.resolveStateOnStartup(saved, 2000000);
  assert.strictEqual(restored.status, "paused");
  assert.strictEqual(restored.phaseIndex, 0);
  assert.strictEqual(restored.elapsedInPhaseBeforePause, 350);
});

runTest("Startup recovery: restore RUNNING session with elapsed wall-clock advancement", () => {
  const sched = ScheduleGenerator.generateSchedule(45 * 60); // [1200s focus, 300s break, 1200s focus]
  const startTime = 1000000;
  const saved = {
    version: 1,
    status: "running",
    totalSeconds: 2700,
    requestedMinutes: 45,
    schedule: sched,
    phaseIndex: 0,
    phaseStartTime: startTime,
    elapsedInPhaseBeforePause: 0
  };

  // 1300 seconds passed while shell was closed (first phase 1200s done, 100s into 300s break)
  const now = startTime + (1300 * 1000);
  const restored = Persistence.resolveStateOnStartup(saved, now);

  assert.strictEqual(restored.status, "running");
  assert.strictEqual(restored.phaseIndex, 1); // Advanced to break phase
  assert.strictEqual(restored.schedule[1].type, "break");
  assert.strictEqual(restored.elapsedInPhaseBeforePause, 100);
});

runTest("Startup recovery: expired session clears state and flags expiredWhileOffline", () => {
  const sched = ScheduleGenerator.generateSchedule(30 * 60); // 1800s
  const startTime = 1000000;
  const saved = {
    version: 1,
    status: "running",
    totalSeconds: 1800,
    requestedMinutes: 30,
    schedule: sched,
    phaseIndex: 0,
    phaseStartTime: startTime,
    elapsedInPhaseBeforePause: 0
  };

  // 2500 seconds passed (session naturally expired)
  const now = startTime + (2500 * 1000);
  const restored = Persistence.resolveStateOnStartup(saved, now);

  assert.strictEqual(restored.status, "idle");
  assert.strictEqual(restored.expiredWhileOffline, true);
  assert.strictEqual(restored.requestedMinutes, 30);
});

runTest("Corrupted or empty state handling", () => {
  assert.strictEqual(Persistence.deserializeState(null), null);
  assert.strictEqual(Persistence.deserializeState(""), null);
  assert.strictEqual(Persistence.deserializeState("invalid json {[["), null);
  assert.strictEqual(Persistence.deserializeState('{"version": 99}'), null);
  assert.strictEqual(Persistence.deserializeState('{"version": 1, "status": "unknown"}'), null);

  const restored = Persistence.resolveStateOnStartup(null, Date.now());
  assert.strictEqual(restored.status, "idle");
  assert.strictEqual(restored.expiredWhileOffline, false);
});

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests} / ${totalTests} passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
