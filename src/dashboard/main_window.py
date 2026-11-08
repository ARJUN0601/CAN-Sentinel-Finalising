import sys
import threading
import time

import can

from PyQt5.QtCore import Qt, QObject, QTimer, pyqtSignal
from PyQt5.QtGui import QFont
from PyQt5.QtWidgets import (
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPlainTextEdit,
    QVBoxLayout,
    QWidget,
)

from section_header import SectionHeader
from status_badge import StatusBadge


class CANBridge(QObject):
    """Deliver CAN data safely to the Qt UI thread."""

    frame_received = pyqtSignal(str, object)
    connection_changed = pyqtSignal(bool)
    error_occurred = pyqtSignal(str)


class CANReader(threading.Thread):
    """Single SocketCAN reader for traffic and telemetry."""

    def __init__(self, bridge, interface="vcan0"):
        super().__init__(daemon=True)
        self.bridge = bridge
        self.interface = interface
        self.stop_event = threading.Event()

    def run(self):
        try:
            with can.Bus(
                interface="socketcan",
                channel=self.interface,
            ) as bus:
                self.bridge.connection_changed.emit(True)

                while not self.stop_event.is_set():
                    message = bus.recv(timeout=0.5)

                    if message is None:
                        continue

                    text = (
                        f"ID 0x{message.arbitration_id:03X} | "
                        f"DLC {message.dlc} | "
                        f"DATA {message.data.hex(' ').upper()}"
                    )

                    self.bridge.frame_received.emit(text, message)

        except Exception as exc:
            if not self.stop_event.is_set():
                self.bridge.error_occurred.emit(str(exc))

        finally:
            self.bridge.connection_changed.emit(False)

    def stop(self):
        self.stop_event.set()


class TelemetryCard(QFrame):
    """Reusable ECU telemetry card."""

    def __init__(self, title, unit, accent):
        super().__init__()

        self.setObjectName("telemetryCard")
        self.setStyleSheet("""
            QFrame#telemetryCard {
                background-color: #0F172A;
                border: 1px solid #334155;
                border-radius: 10px;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 14, 14, 14)
        layout.setSpacing(8)

        title_label = QLabel(title)
        title_label.setStyleSheet(
            "color: #94A3B8; background: transparent;"
            "font-size: 12px; font-weight: bold;"
        )

        self.value_label = QLabel("--")
        self.value_label.setStyleSheet(
            f"color: {accent}; background: transparent;"
            "font-size: 25px; font-weight: bold;"
        )

        unit_label = QLabel(unit)
        unit_label.setStyleSheet(
            "color: #64748B; background: transparent;"
            "font-size: 11px;"
        )

        layout.addWidget(title_label)
        layout.addWidget(self.value_label)
        layout.addWidget(unit_label)

    def set_value(self, value):
        self.value_label.setText(str(value))


class DashboardPanel(QFrame):
    """Reusable dashboard panel."""

    def __init__(self, title, description, accent):
        super().__init__()

        self.setObjectName("dashboardPanel")
        self.setStyleSheet(f"""
            QFrame#dashboardPanel {{
                background-color: #1E293B;
                border: 1px solid #334155;
                border-top: 3px solid {accent};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 18, 18, 18)
        layout.setSpacing(14)

        self.status_badge = StatusBadge("DISCONNECTED")
        layout.addWidget(self.status_badge, alignment=Qt.AlignRight)

        layout.addLayout(SectionHeader(title, description))
        self.content_layout = layout
        layout.addStretch()


class CANSentinelDashboard(QMainWindow):

    def __init__(self, interface="vcan0"):
        super().__init__()

        self.interface = interface
        self.last_telemetry_time = None
        self.reader = None
        self.closing = False

        self.setWindowTitle("CAN-Sentinel | Automotive Security")
        self.setMinimumSize(1100, 700)

        self.setStyleSheet("""
            QMainWindow, QWidget {
                background-color: #0F172A;
                color: #F8FAFC;
                font-family: Arial;
            }

            QLabel {
                background: transparent;
            }
        """)

        central = QWidget()
        self.setCentralWidget(central)

        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(28, 24, 28, 22)
        main_layout.setSpacing(20)

        # Header
        header_frame = QFrame()
        header_frame.setObjectName("headerFrame")
        header_frame.setStyleSheet("""
            QFrame#headerFrame {
                background-color: #1E293B;
                border: 1px solid #334155;
                border-radius: 12px;
            }
        """)

        header = QHBoxLayout(header_frame)
        header.setContentsMargins(20, 16, 20, 16)

        title = QLabel("CAN-SENTINEL")
        title.setFont(QFont("Arial", 24, QFont.Bold))

        subtitle = QLabel("AUTOMOTIVE INTRUSION DETECTION")
        subtitle.setStyleSheet("color: #94A3B8;")

        header.addWidget(title)
        header.addStretch()
        header.addWidget(subtitle)

        main_layout.addWidget(header_frame)

        heading = QLabel("Security Operations Dashboard")
        heading.setFont(QFont("Arial", 19, QFont.Bold))
        main_layout.addWidget(heading)

        # Dashboard panels
        panels_layout = QHBoxLayout()
        panels_layout.setSpacing(16)

        self.panels = {}

        for name, description, accent in [
            ("CAN Traffic", "Live CAN packet monitoring", "#38BDF8"),
            ("Threat Level", "Automotive security monitoring", "#F59E0B"),
            ("ECU Telemetry", "Vehicle speed and temperature", "#34D399"),
        ]:
            panel = DashboardPanel(name, description, accent)
            self.panels[name] = panel
            panels_layout.addWidget(panel, 1)

        main_layout.addLayout(panels_layout, 1)

        # CAN traffic view
        traffic_panel = self.panels["CAN Traffic"]

        self.can_traffic_view = QPlainTextEdit()
        self.can_traffic_view.setReadOnly(True)
        self.can_traffic_view.setPlaceholderText(
            "Waiting for CAN frames..."
        )
        self.can_traffic_view.setMaximumBlockCount(500)
        traffic_panel.content_layout.insertWidget(
            traffic_panel.content_layout.count() - 1,
            self.can_traffic_view,
        )

        # Threat information
        threat_panel = self.panels["Threat Level"]
        self.threat_label = QLabel("No threat events received.")
        self.threat_label.setWordWrap(True)
        threat_panel.content_layout.insertWidget(
            threat_panel.content_layout.count() - 1,
            self.threat_label,
        )

        # Telemetry cards
        telemetry_panel = self.panels["ECU Telemetry"]

        self.speed_card = TelemetryCard(
            "VEHICLE SPEED", "km/h", "#38BDF8"
        )
        self.temperature_card = TelemetryCard(
            "ENGINE TEMPERATURE", "°C", "#F59E0B"
        )

        telemetry_panel.content_layout.insertWidget(
            telemetry_panel.content_layout.count() - 1,
            self.speed_card,
        )
        telemetry_panel.content_layout.insertWidget(
            telemetry_panel.content_layout.count() - 1,
            self.temperature_card,
        )

        footer = QLabel(
            "CAN-Sentinel | Automotive Security Monitoring System"
        )
        footer.setAlignment(Qt.AlignCenter)
        footer.setStyleSheet("color: #94A3B8;")
        main_layout.addWidget(footer)

        # Thread-safe CAN event bridge
        self.bridge = CANBridge()
        self.bridge.frame_received.connect(self.process_frame)
        self.bridge.connection_changed.connect(
            self.update_connection_status
        )
        self.bridge.error_occurred.connect(self.handle_can_error)

        # Stale telemetry monitor
        self.stale_timer = QTimer(self)
        self.stale_timer.timeout.connect(self.check_stale_telemetry)
        self.stale_timer.start(500)

        # Start exactly one CAN reader
        self.reader = CANReader(self.bridge, self.interface)
        self.reader.start()

    def process_frame(self, text, message):
        """Update raw traffic and decode telemetry in the UI thread."""

        self.can_traffic_view.appendPlainText(text)

        can_id = message.arbitration_id
        data = message.data

        if can_id == 0x240 and len(data) >= 2:
            raw_speed = int.from_bytes(
                data[0:2],
                byteorder="little",
                signed=False,
            )

            speed = raw_speed / 100.0
            self.speed_card.set_value(f"{speed:.1f}")
            self.record_telemetry()

        elif can_id == 0x250 and len(data) >= 1:
            temperature = int.from_bytes(
                data[0:1],
                byteorder="little",
                signed=True,
            )

            self.temperature_card.set_value(str(temperature))
            self.record_telemetry()

    def record_telemetry(self):
        self.last_telemetry_time = time.monotonic()
        self.panels["ECU Telemetry"].status_badge.set_status(
            "MONITORING"
        )

    def check_stale_telemetry(self):
        if self.last_telemetry_time is None:
            return

        elapsed = time.monotonic() - self.last_telemetry_time

        if elapsed > 2.0:
            self.panels["ECU Telemetry"].status_badge.set_status(
                "WARNING"
            )

    def update_connection_status(self, connected):
        status = "CONNECTED" if connected else "DISCONNECTED"

        self.panels["CAN Traffic"].status_badge.set_status(status)

        if not connected:
            self.panels["ECU Telemetry"].status_badge.set_status(
                "DISCONNECTED"
            )

    def handle_can_error(self, error):
        self.threat_label.setText(f"CAN reader error: {error}")
        self.panels["CAN Traffic"].status_badge.set_status(
            "DISCONNECTED"
        )

    def closeEvent(self, event):
        self.closing = True
        self.stale_timer.stop()

        if self.reader is not None:
            self.reader.stop()
            self.reader.join(timeout=2.0)

            if self.reader.is_alive():
                event.ignore()
                return

        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)

    window = CANSentinelDashboard()
    window.show()

    sys.exit(app.exec_())
