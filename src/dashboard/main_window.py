import sys

from PyQt5.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QFrame
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont

from status_badge import StatusBadge
from section_header import SectionHeader


class TelemetryCard(QFrame):
    """Reusable card for displaying ECU telemetry values."""

    def __init__(self, title, value, unit, accent):
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
        layout.setContentsMargins(14, 16, 14, 16)
        layout.setSpacing(10)

        title_label = QLabel(title)
        title_label.setStyleSheet("""
            color: #94A3B8;
            background: transparent;
            font-size: 12px;
            font-weight: bold;
        """)

        self.value_label = QLabel(value)
        self.value_label.setStyleSheet(f"""
            color: {accent};
            background: transparent;
            font-size: 25px;
            font-weight: bold;
        """)

        unit_label = QLabel(unit)
        unit_label.setStyleSheet("""
            color: #64748B;
            background: transparent;
            font-size: 11px;
        """)

        layout.addWidget(title_label)
        layout.addWidget(self.value_label)
        layout.addWidget(unit_label)


class DashboardPanel(QFrame):
    """Reusable dashboard panel."""

    def __init__(self, title, description, accent):
        super().__init__()

        self.setObjectName("dashboardPanel")
        self.setMinimumHeight(380)

        self.setStyleSheet(f"""
            QFrame#dashboardPanel {{
                background-color: #1E293B;
                border: 1px solid #334155;
                border-top: 3px solid {accent};
                border-radius: 14px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(22, 22, 22, 22)
        layout.setSpacing(20)

        self.status_badge = StatusBadge("DISCONNECTED")
        layout.addWidget(self.status_badge, alignment=Qt.AlignRight)

        layout.addLayout(SectionHeader(title, description))

        if title == "CAN Traffic":
            content = QLabel("Waiting for CAN messages...")
            content.setObjectName("placeholderText")
            layout.addWidget(content)

        elif title == "Threat Level":
            content = QLabel("No threat data available.")
            content.setObjectName("placeholderText")
            layout.addWidget(content)

        elif title == "ECU Telemetry":
            telemetry_layout = QVBoxLayout()
            telemetry_layout.setSpacing(14)

            self.speed_card = TelemetryCard(
                "VEHICLE SPEED",
                "--",
                "km/h",
                "#38BDF8"
            )

            self.temperature_card = TelemetryCard(
                "ENGINE TEMPERATURE",
                "--",
                "°C",
                "#F59E0B"
            )

            telemetry_layout.addWidget(self.speed_card)
            telemetry_layout.addWidget(self.temperature_card)

            layout.addLayout(telemetry_layout)

        layout.addStretch()


class CANSentinelDashboard(QMainWindow):

    def __init__(self):
        super().__init__()

        self.setWindowTitle("CAN-Sentinel | Automotive Security")
        self.setMinimumSize(1100, 700)

        self.setStyleSheet("""
            QMainWindow, QWidget {
                background-color: #0F172A;
                color: #F8FAFC;
                font-family: Arial;
            }

            QLabel#mutedText {
                color: #94A3B8;
                background: transparent;
            }

            QFrame#headerFrame {
                background-color: #1E293B;
                border: 1px solid #334155;
                border-radius: 12px;
            }

            QLabel#placeholderText {
                color: #94A3B8;
                background: transparent;
                font-size: 13px;
                padding: 12px 0px;
            }
        """)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(28, 25, 28, 22)
        main_layout.setSpacing(24)

        # Header
        header_frame = QFrame()
        header_frame.setObjectName("headerFrame")

        header = QHBoxLayout(header_frame)
        header.setContentsMargins(22, 18, 22, 18)

        title = QLabel("CAN-SENTINEL")
        title.setFont(QFont("Arial", 25, QFont.Bold))

        subtitle = QLabel("AUTOMOTIVE INTRUSION DETECTION")
        subtitle.setObjectName("mutedText")
        subtitle.setFont(QFont("Arial", 10, QFont.Bold))

        header.addWidget(title)
        header.addStretch()
        header.addWidget(subtitle)

        main_layout.addWidget(header_frame)

        # Dashboard heading
        heading_section = QVBoxLayout()
        heading_section.setSpacing(5)

        heading = QLabel("Security Operations Dashboard")
        heading.setFont(QFont("Arial", 20, QFont.Bold))

        description = QLabel(
            "Monitor vehicle communication, ECU telemetry and security threats."
        )
        description.setObjectName("mutedText")

        heading_section.addWidget(heading)
        heading_section.addWidget(description)

        main_layout.addLayout(heading_section)

        # Dashboard panels
        panels_layout = QHBoxLayout()
        panels_layout.setSpacing(20)

        panels = [
            (
                "CAN Traffic",
                "Live CAN packet monitoring",
                "#38BDF8"
            ),
            (
                "Threat Level",
                "Automotive security threat monitoring",
                "#F59E0B"
            ),
            (
                "ECU Telemetry",
                "Vehicle speed and temperature status",
                "#34D399"
            )
        ]

        for panel_title, panel_description, accent in panels:
            panel = DashboardPanel(
                panel_title,
                panel_description,
                accent
            )
            panels_layout.addWidget(panel, 1)

        main_layout.addLayout(panels_layout, 1)

        # Footer
        footer = QLabel(
            "CAN-Sentinel  |  Automotive Security Monitoring System  |  Week 3"
        )
        footer.setAlignment(Qt.AlignCenter)
        footer.setObjectName("mutedText")

        main_layout.addWidget(footer)


if __name__ == "__main__":
    app = QApplication(sys.argv)

    window = CANSentinelDashboard()
    window.show()

    sys.exit(app.exec_())
