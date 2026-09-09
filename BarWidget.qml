import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "ScheduleGenerator.js" as ScheduleGenerator
import "TimerEngine.js" as TimerEngine
import "Persistence.js" as Persistence
import "NotificationManager.js" as NotificationManager
import "SoundManager.js" as SoundManager

BarWidget {
  id: root
  moduleName: "io.github.bhittu21.omarchy-focus-timer"

  property var timerState: TimerEngine.createIdleState()
  property var viewDetails: TimerEngine.computeViewDetails(timerState, Date.now())
  property bool stateLoaded: false

  readonly property string homeDir: Quickshell.env("HOME")
  readonly property string stateFilePath: Persistence.getStateFilePath(homeDir)
  readonly property string soundAssetPath: Qt.resolvedUrl("assets/complete.wav").toString().replace(/^file:\/\//, "")

  readonly property bool opened: panel.open
  function open() { panel.open = true }
  function close() { panel.open = false }
  function toggle() { if (opened) close(); else open(); }

  function startSession(minutes) {
    var check = ScheduleGenerator.validateDurationInput(minutes);
    if (!check.valid) return;

    var sched = ScheduleGenerator.generateSchedule(check.seconds);
    root.timerState = TimerEngine.startTimer(check.minutes, sched, Date.now());
    root.persistState();
  }

  function pauseSession() {
    if (root.timerState.status !== "running") return;
    root.timerState = TimerEngine.pauseTimer(root.timerState, Date.now());
    root.persistState();
  }

  function resumeSession() {
    if (root.timerState.status !== "paused") return;
    root.timerState = TimerEngine.resumeTimer(root.timerState, Date.now());
    root.persistState();
  }

  function cancelSession() {
    root.timerState = TimerEngine.cancelTimer();
    root.persistState();
  }

  function persistState() {
    if (!stateLoaded) return;
    try {
      stateFile.setText(Persistence.serializeState(root.timerState));
    } catch (e) {
      console.warn("FocusTimer: failed to persist state:", e);
    }
  }

  function loadPersistedState(raw) {
    if (stateLoaded) return;
    stateLoaded = true;

    var parsed = Persistence.deserializeState(raw);
    var resolved = Persistence.resolveStateOnStartup(parsed, Date.now());

    if (resolved.expiredWhileOffline) {
      // Complete session ended while shell was asleep/closed
      NotificationManager.notifySessionComplete(Quickshell, resolved.requestedMinutes);
      SoundManager.playSound(Quickshell, root.soundAssetPath);
      root.timerState = TimerEngine.createIdleState();
      Qt.callLater(root.persistState);
      return;
    }

    root.timerState = resolved;
  }

  // 1-second interval heartbeat
  Timer {
    id: countdownTimer
    interval: 1000
    repeat: true
    running: root.timerState.status === "running"
    onTriggered: {
      var result = TimerEngine.tickTimer(root.timerState, Date.now());
      root.timerState = result.state;

      if (result.event) {
        if (result.event.type === "completed") {
          NotificationManager.notifySessionComplete(Quickshell, result.event.requestedMinutes);
          SoundManager.playSound(Quickshell, root.soundAssetPath);
          root.persistState();
        } else if (result.event.type === "phaseChanged") {
          root.persistState();
        }
      }
    }
  }

  // Ensure state cache directory exists
  Process {
    id: ensureDirProc
    command: ["mkdir", "-p", Persistence.getCacheDir(root.homeDir)]
  }

  // Persistent state file handler
  FileView {
    id: stateFile
    path: root.stateFilePath
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onLoaded: root.loadPersistedState(text())
    onLoadFailed: root.loadPersistedState("")
  }

  Component.onCompleted: {
    ensureDirProc.running = true;
    Qt.callLater(function() {
      stateFile.reload();
    });
  }

  // Omarchy IPC target for external scripting and cli
  IpcHandler {
    target: "io.github.bhittu21.omarchy-focus-timer"

    function open(): void { root.open() }
    function close(): void { root.close() }
    function toggle(): void { root.toggle() }
    function start(minutes: int): void { root.startSession(minutes) }
    function pause(): void { root.pauseSession() }
    function resume(): void { root.resumeSession() }
    function cancel(): void { root.cancelSession() }
    function status(): string {
      return JSON.stringify({
        status: root.timerState.status,
        remainingSeconds: root.viewDetails.remainingInPhase,
        phaseType: root.viewDetails.phaseType,
        totalSeconds: root.timerState.totalSeconds
      });
    }
  }

  // Bar label computation
  readonly property string barLabel: {
    if (!root.viewDetails.active) {
      return "FOCUS";
    }
    var timeStr = ScheduleGenerator.formatTime(root.viewDetails.remainingInPhase);
    if (root.viewDetails.status === "paused") {
      return "PAUSED " + timeStr;
    }
    if (root.viewDetails.phaseType === "break") {
      return "BREAK " + timeStr;
    }
    return "FOCUS " + timeStr;
  }

  readonly property string barTooltip: {
    if (!root.viewDetails.active) {
      return "Omarchy Focus Timer (Click to open)";
    }
    return "Session " + root.viewDetails.focusSessionIndex + " / " + root.viewDetails.totalFocusSessions +
           " • " + root.viewDetails.nextPhaseText;
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  // Compact Bar Button
  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.barLabel
    fontFamily: "monospace"
    fontSize: Style.font.caption
    active: root.opened || root.viewDetails.active
    foreground: root.viewDetails.active && root.viewDetails.status !== "paused"
      ? (root.viewDetails.phaseType === "break" ? "#68d391" : Color.accent)
      : (root.bar ? root.bar.barForeground : Color.foreground)
    tooltipText: root.barTooltip
    horizontalMargin: 8
    verticalPadding: 4

    onPressed: function(btn) {
      root.toggle();
    }
  }

  // The Popup Panel
  Panel {
    id: panel
    anchorItem: button
    bar: root.bar
    owner: root
    open: false
    timerState: root.timerState

    onStartRequested: function(minutes) { root.startSession(minutes) }
    onPauseRequested: function() { root.pauseSession() }
    onResumeRequested: function() { root.resumeSession() }
    onCancelRequested: function() { root.cancelSession() }
  }
}
