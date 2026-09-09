pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import Quickshell
import qs.Commons
import qs.Ui
import "ScheduleGenerator.js" as ScheduleGenerator
import "TimerEngine.js" as TimerEngine

KeyboardPanel {
  id: root

  property var timerState: null
  property var viewDetails: TimerEngine.computeViewDetails(timerState, Date.now())

  signal startRequested(int minutes)
  signal pauseRequested()
  signal resumeRequested()
  signal cancelRequested()

  readonly property string monoFont: "monospace"
  readonly property color termForeground: bar ? bar.barForeground : Color.foreground
  readonly property color termAccent: Color.accent
  readonly property color termBorderColor: Color.popups.border
  readonly property color termMuted: Qt.darker(termForeground, 1.6)

  property int selectedPreset: 25
  property string customDurationText: "25"
  property string validationError: ""

  contentWidth: fittedContentWidth(Style.space(340))
  contentHeight: fittedContentHeight(panelColumn.implicitHeight + Style.space(24))

  focusTarget: keyCatcher

  function startSessionWithMinutes(min) {
    var check = ScheduleGenerator.validateDurationInput(min);
    if (!check.valid) {
      validationError = check.error;
      return;
    }
    validationError = "";
    root.startRequested(check.minutes);
  }

  function startFromCustom() {
    startSessionWithMinutes(customDurationText);
  }

  PanelKeyCatcher {
    id: keyCatcher
    anchors.fill: parent
    blocked: customInput.activeFocus

    onCloseRequested: root.close()
    onReturnRequested: {
      if (!root.viewDetails.active) {
        root.startFromCustom();
      } else if (root.viewDetails.status === "running") {
        root.pauseRequested();
      } else if (root.viewDetails.status === "paused") {
        root.resumeRequested();
      }
    }

    Column {
      id: panelColumn
      width: parent.width
      spacing: Style.space(12)

      // Terminal Header
      Row {
        width: parent.width
        Text {
          text: "OMARCHY_FOCUS"
          font.family: root.monoFont
          font.pixelSize: Style.font.bodySmall
          font.bold: true
          color: root.termAccent
          font.letterSpacing: 1
        }
      }

      // Thin separator
      Rectangle {
        width: parent.width
        height: 1
        color: root.termBorderColor
        opacity: 0.6
      }

      // IDLE STATE VIEW
      Column {
        id: idleView
        visible: !root.viewDetails.active
        width: parent.width
        spacing: Style.space(14)

        Text {
          text: "SELECT DURATION"
          font.family: root.monoFont
          font.pixelSize: Style.font.caption
          color: root.termMuted
          font.bold: true
          font.letterSpacing: 1
        }

        // Preset buttons row
        Row {
          spacing: Style.space(8)
          anchors.horizontalCenter: parent.horizontalCenter

          Repeater {
            model: [25, 45, 60, 90]

            Button {
              required property int modelData
              text: "[ " + modelData + " ]"
              fontFamily: root.monoFont
              fontSize: Style.font.bodySmall
              foreground: root.selectedPreset === modelData ? root.termAccent : root.termForeground
              selected: root.selectedPreset === modelData
              horizontalPadding: Style.space(8)
              verticalPadding: Style.space(4)
              onClicked: {
                root.selectedPreset = modelData;
                root.customDurationText = String(modelData);
                root.validationError = "";
              }
            }
          }
        }

        // Custom duration input row
        Row {
          spacing: Style.space(8)
          anchors.horizontalCenter: parent.horizontalCenter

          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: "CUSTOM:"
            font.family: root.monoFont
            font.pixelSize: Style.font.bodySmall
            color: root.termForeground
          }

          TextField {
            id: customInput
            width: Style.space(64)
            text: root.customDurationText
            font.family: root.monoFont
            font.pixelSize: Style.font.bodySmall
            horizontalAlignment: Text.AlignHCenter
            verticalPadding: Style.space(4)
            horizontalPadding: Style.space(6)
            selectByMouse: true
            onTextChanged: {
              root.customDurationText = text;
              var check = ScheduleGenerator.validateDurationInput(text);
              if (check.valid) {
                root.selectedPreset = check.minutes;
                root.validationError = "";
              }
            }
            onAccepted: root.startFromCustom()
          }

          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: "MIN"
            font.family: root.monoFont
            font.pixelSize: Style.font.bodySmall
            color: root.termMuted
          }
        }

        // Validation error display
        Text {
          visible: root.validationError !== ""
          text: root.validationError
          color: Color.urgent
          font.family: root.monoFont
          font.pixelSize: Style.font.caption
          anchors.horizontalCenter: parent.horizontalCenter
          wrapMode: Text.WordWrap
          width: parent.width
          horizontalAlignment: Text.AlignHCenter
        }

        // Start button
        Button {
          width: parent.width
          text: "[ START ]"
          fontFamily: root.monoFont
          fontSize: Style.font.body
          foreground: root.termAccent
          bordered: true
          horizontalPadding: Style.space(16)
          verticalPadding: Style.space(8)
          onClicked: root.startFromCustom()
        }
      }

      // ACTIVE / PAUSED SESSION VIEW
      Column {
        id: activeView
        visible: root.viewDetails.active
        width: parent.width
        spacing: Style.space(10)

        // Phase badge
        Text {
          anchors.horizontalCenter: parent.horizontalCenter
          text: root.viewDetails.status === "paused"
            ? "— PAUSED —"
            : (root.viewDetails.phaseType === "break" ? "— BREAK PERIOD —" : "— FOCUS PERIOD —")
          font.family: root.monoFont
          font.pixelSize: Style.font.caption
          font.bold: true
          font.letterSpacing: 2
          color: root.viewDetails.status === "paused"
            ? root.termMuted
            : (root.viewDetails.phaseType === "break" ? "#68d391" : root.termAccent)
        }

        // Big monospace countdown
        Text {
          id: countdownLabel
          anchors.horizontalCenter: parent.horizontalCenter
          text: ScheduleGenerator.formatTime(root.viewDetails.remainingInPhase)
          font.family: root.monoFont
          font.pixelSize: Style.space(42)
          font.bold: true
          color: root.termForeground
        }

        // Hacker-style ASCII block progress bar
        Text {
          anchors.horizontalCenter: parent.horizontalCenter
          text: ScheduleGenerator.generateProgressBar(root.viewDetails.phaseProgress, 22)
          font.family: root.monoFont
          font.pixelSize: Style.font.bodySmall
          color: root.viewDetails.status === "paused" ? root.termMuted : root.termAccent
        }

        // Session & next info
        Column {
          anchors.horizontalCenter: parent.horizontalCenter
          spacing: Style.space(4)
          width: parent.width

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "SESSION " + root.viewDetails.focusSessionIndex + " / " + root.viewDetails.totalFocusSessions
            font.family: root.monoFont
            font.pixelSize: Style.font.caption
            font.bold: true
            color: root.termMuted
          }

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "NEXT → " + root.viewDetails.nextPhaseText
            font.family: root.monoFont
            font.pixelSize: Style.font.caption
            color: root.termMuted
          }
        }

        // Action controls
        Row {
          anchors.horizontalCenter: parent.horizontalCenter
          spacing: Style.space(12)

          Button {
            visible: root.viewDetails.status === "running"
            text: "[ PAUSE ]"
            fontFamily: root.monoFont
            fontSize: Style.font.bodySmall
            foreground: root.termForeground
            bordered: true
            horizontalPadding: Style.space(14)
            verticalPadding: Style.space(6)
            onClicked: root.pauseRequested()
          }

          Button {
            visible: root.viewDetails.status === "paused"
            text: "[ RESUME ]"
            fontFamily: root.monoFont
            fontSize: Style.font.bodySmall
            foreground: root.termAccent
            bordered: true
            horizontalPadding: Style.space(14)
            verticalPadding: Style.space(6)
            onClicked: root.resumeRequested()
          }

          Button {
            text: "[ CANCEL ]"
            fontFamily: root.monoFont
            fontSize: Style.font.bodySmall
            foreground: Color.urgent
            bordered: true
            horizontalPadding: Style.space(14)
            verticalPadding: Style.space(6)
            onClicked: root.cancelRequested()
          }
        }
      }
    }
  }
}
