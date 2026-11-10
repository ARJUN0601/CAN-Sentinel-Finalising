import sys
import time
import threading
from collections import defaultdict, deque

import can

from PyQt5.QtCore import Qt, QObject, pyqtSignal, pyqtSlot
from PyQt5.QtGui import QFont
from PyQt5.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QPlainTextEdit,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QFrame,
)


# Existing detector.py demo rule
WINDOW_SECONDS = 2.0
THRESHOLD = 5


class CANBridge(QObject):
    frame_received = pyqtSignal(object)
    status = pyqtSignal(str)
    error = pyqtSignal(str)


class CANReader(threading.Thread):
    def __init__(self, bridge, channel="vcan0"):
        super().__init__(daemon=True)
        self.bridge = bridge
        self.channel = channel
        self.stop_event = threading.Event()

    def run(self):
        try:
            with can.Bus(
                interface="socketcan",
                channel=self.channel
            ) as bus:
                self.bridge.status.emit(
                    f"Connected to {self.channel}"
                )

                while not self.stop_event.is_set():
                    msg = bus.recv(timeout=0.5)
                    if msg is not None:
                        self.bridge.frame_received.emit(msg)

        except Exception as exc:
            self.bridge.error.emit(str(exc))

    def stop(self):
        self.stop_event.set()


class CANSentinelDashboard(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("CAN-Sentinel | Automotive Security")
        self.setMinimumSize(1000, 650)

        self.recent = defaultdict(deque)
        self.active_alert_ids = set()

        self.setStyleSheet("""
            QWidget {
                background-color: #111827;
                color: #E5E7EB;
                font-family: Arial;
            }

            QFrame#panel {
                background-color: #1F2937;
                border: 1px solid #374151;
                border-radius: 10px;
            }

            QLabel#muted {
                color: #93A3AF;
            }

            QLabel#panelTitle {
                font-size: 15px;
                font-weight: bold;
            }

            QPlainTextEdit {
                background-color: #111827;
                color: #E5E7EB;
                border: 1px solid #374151;
                border-radius: 5px;
                padding: 8px;
                font-family: monospace;
                font-size: 11px;
            }
        """)

        central = QWidget()
        self.setCentralWidget(central)

        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(24, 24, 24, 24)
        main_layout.setSpacing(18)

        # Header
        header = QHBoxLayout()

        title = QLabel("CAN-SENTINEL")
        title.setFont(QFont("Arial", 22, QFont.Bold))

        subtitle = QLabel("AUTOMOTIVE INTRUSION DETECTION")
        subtitle.setObjectName("muted")

        header.addWidget(title)
        header.addStretch(1)
        header.addWidget(subtitle)
        main_layout.addLayout(header)

        intro = QLabel("Security Operations Dashboard")
        intro.setFont(QFont("Arial", 16, QFont.Bold))
        main_layout.addWidget(intro)

        # Three dashboard panels
        panels = QHBoxLayout()
        panels.setSpacing(16)

        # CAN Traffic panel
        traffic_panel, traffic_layout = self.create_panel("CAN Traffic")

        self.can_traffic_view = QPlainTextEdit()
        self.can_traffic_view.setReadOnly(True)
        self.can_traffic_view.setPlaceholderText(
            "Waiting for live CAN messages on vcan0..."
        )
        self.can_traffic_view.setMaximumBlockCount(500)

        traffic_layout.addWidget(self.can_traffic_view, 1)

        # Threat Level panel
        threat_panel, threat_layout = self.create_panel("Threat Level")

        self.threat_state = QLabel("WAITING FOR CAN TRAFFIC")
        self.threat_state.setFont(QFont("Arial", 14, QFont.Bold))

        self.threat_details = QLabel(
            "Demo rule: 5 or more messages with the same CAN ID "
            "within 2 seconds."
        )
        self.threat_details.setObjectName("muted")
        self.threat_details.setWordWrap(True)

        threat_layout.addWidget(self.threat_state)
        threat_layout.addWidget(self.threat_details)
        threat_layout.addStretch(1)

        # ECU Telemetry panel
        ecu_panel, ecu_layout = self.create_panel("ECU Telemetry")

        self.speed_label = QLabel("Speed: Waiting for 0x240")
        self.speed_label.setFont(QFont("Arial", 13, QFont.Bold))

        self.temp_label = QLabel("Temperature: Waiting for 0x250")
        self.temp_label.setFont(QFont("Arial", 13, QFont.Bold))

        ecu_note = QLabel(
            "Decoded from the actual CAN frame data."
        )
        ecu_note.setObjectName("muted")
        ecu_note.setWordWrap(True)

        ecu_layout.addWidget(self.speed_label)
        ecu_layout.addSpacing(12)
        ecu_layout.addWidget(self.temp_label)
        ecu_layout.addSpacing(12)
        ecu_layout.addWidget(ecu_note)
        ecu_layout.addStretch(1)

        panels.addWidget(traffic_panel, 1)
        panels.addWidget(threat_panel, 1)
        panels.addWidget(ecu_panel, 1)

        main_layout.addLayout(panels, 1)

        # Connection status
        self.status_label = QLabel("Starting CAN receiver...")
        self.status_label.setObjectName("muted")
        self.status_label.setAlignment(Qt.AlignCenter)
        main_layout.addWidget(self.status_label)

        # Thread-safe CAN to GUI communication
        self.bridge = CANBridge()

        self.bridge.frame_received.connect(
            self.handle_can_frame,
            Qt.QueuedConnection
        )
        self.bridge.status.connect(
            self.handle_status,
            Qt.QueuedConnection
        )
        self.bridge.error.connect(
            self.handle_error,
            Qt.QueuedConnection
        )

        self.reader = CANReader(self.bridge)
        self.reader.start()

    def create_panel(self, heading):
        panel = QFrame()
        panel.setObjectName("panel")

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(18, 18, 18, 18)
        layout.setSpacing(12)

        heading_label = QLabel(heading)
        heading_label.setObjectName("panelTitle")
        layout.addWidget(heading_label)

        return panel, layout

    @pyqtSlot(str)
    def handle_status(self, message):
        self.status_label.setText(message)
        self.status_label.setStyleSheet("color: #86EFAC;")

    @pyqtSlot(str)
    def handle_error(self, message):
        self.status_label.setText(f"CAN receiver error: {message}")
        self.status_label.setStyleSheet("color: #FCA5A5;")

    @pyqtSlot(object)
    def handle_can_frame(self, msg):
        can_id = msg.arbitration_id
        data = bytes(msg.data)

        # 1. Display actual CAN traffic
        data_text = " ".join(f"{byte:02X}" for byte in data)

        line = (
            f"ID 0x{can_id:03X} | "
            f"DLC {len(data)} | DATA {data_text}"
        )
        self.can_traffic_view.appendPlainText(line)

        # 2. Decode speed: unsigned little-endian uint16 / 100
        if can_id == 0x240 and len(data) >= 2:
            speed_raw = int.from_bytes(data[:2], "little")
            speed = speed_raw / 100.0

            self.speed_label.setText(
                f"Speed: {speed:.1f} km/h"
            )

        # 3. Decode temperature: signed 8-bit integer
        elif can_id == 0x250 and len(data) >= 1:
            temperature = int.from_bytes(
                data[:1],
                byteorder="little",
                signed=True
            )

            self.temp_label.setText(
                f"Temperature: {temperature} °C"
            )

        # 4. Live high-message-rate detection
        now = time.monotonic()

        for observed_id, timestamps in self.recent.items():
            while (
                timestamps
                and now - timestamps[0] > WINDOW_SECONDS
            ):
                timestamps.popleft()

            if len(timestamps) < THRESHOLD:
                self.active_alert_ids.discard(observed_id)

        recent_messages = self.recent[can_id]
        recent_messages.append(now)

        if len(recent_messages) >= THRESHOLD:
            self.active_alert_ids.add(can_id)

        if self.active_alert_ids:
            ids = ", ".join(
                f"0x{item:03X}"
                for item in sorted(self.active_alert_ids)
            )

            self.threat_state.setText("HIGH MESSAGE RATE")
            self.threat_state.setStyleSheet(
                "color: #FCA5A5; font-weight: bold;"
            )
            self.threat_details.setText(
                f"Demo rate rule triggered for: {ids}\n"
                f"Threshold: {THRESHOLD} messages / "
                f"{WINDOW_SECONDS:.0f} seconds per CAN ID.\n"
                "This is a rate alert, not proof of an attack."
            )
        else:
            self.threat_state.setText("NORMAL")
            self.threat_state.setStyleSheet(
                "color: #86EFAC; font-weight: bold;"
            )
            self.threat_details.setText(
                "No high-message-rate activity detected."
            )

    def closeEvent(self, event):
        self.reader.stop()
        self.reader.join(timeout=1.5)
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)

    window = CANSentinelDashboard()
    window.show()

    sys.exit(app.exec_())
