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


class DashboardPanel(QFrame):
    """Reusable dashboard panel."""

    def __init__(self, title, description):
        super().__init__()

        self.setObjectName("dashboardPanel")

        layout = QVBoxLayout(self)

        heading = QLabel(title)
        heading.setFont(QFont("Arial", 14, QFont.Bold))

        info = QLabel(description)
        info.setWordWrap(True)
        info.setObjectName("mutedText")

        layout.addWidget(heading)
        layout.addWidget(info)
        layout.addStretch()


class CANSentinelDashboard(QMainWindow):

    def __init__(self):
        super().__init__()

        self.setWindowTitle("CAN-Sentinel | Security Dashboard")
        self.setMinimumSize(1100, 700)

        self.setStyleSheet("""
            QMainWindow, QWidget {
                background-color: #111827;
                color: #F9FAFB;
                font-family: Arial;
            }

            QFrame#dashboardPanel {
                background-color: #1F2937;
                border: 1px solid #374151;
                border-radius: 12px;
            }

            QLabel#mutedText {
                color: #9CA3AF;
            }
        """)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(25, 25, 25, 25)
        main_layout.setSpacing(20)

        # Header
        header = QHBoxLayout()

        title = QLabel("CAN-SENTINEL")
        title.setFont(QFont("Arial", 24, QFont.Bold))

        subtitle = QLabel("AUTOMOTIVE SECURITY SYSTEM")
        subtitle.setObjectName("mutedText")

        header.addWidget(title)
        header.addStretch()
        header.addWidget(subtitle)

        main_layout.addLayout(header)

        # Dashboard heading
        heading = QLabel("Security Operations Dashboard")
        heading.setFont(QFont("Arial", 18, QFont.Bold))

        main_layout.addWidget(heading)

        # Dashboard panels
        panels_layout = QHBoxLayout()
        panels_layout.setSpacing(15)

        panels = [
            ("CAN Traffic", "Live CAN packet display"),
            ("Threat Level", "Security threat monitoring"),
            ("ECU Telemetry", "Vehicle telemetry status")
        ]

        for title, description in panels:
            panel = DashboardPanel(title, description)
            panels_layout.addWidget(panel)

        main_layout.addLayout(panels_layout)

        # Footer
        footer = QLabel("CAN-Sentinel | Week 3 UI Architecture")
        footer.setAlignment(Qt.AlignCenter)
        footer.setObjectName("mutedText")

        main_layout.addWidget(footer)


if __name__ == "__main__":
    app = QApplication(sys.argv)

    window = CANSentinelDashboard()
    window.show()

    sys.exit(app.exec_())
