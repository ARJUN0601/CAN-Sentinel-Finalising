
import sys
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget,
    QVBoxLayout, QHBoxLayout, QLabel,
    QFrame
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont


class CANSentinelDashboard(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("CAN-Sentinel | Automotive Security")
        self.setMinimumSize(1000, 650)
        self.setStyleSheet("""
            QMainWindow, QWidget {
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
                color: #9CA3AF;
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
        subtitle.setAlignment(Qt.AlignRight | Qt.AlignVCenter)

        header.addWidget(title)
        header.addStretch()
        header.addWidget(subtitle)
        main_layout.addLayout(header)

        # Welcome section
        intro = QLabel("Security Operations Dashboard")
        intro.setFont(QFont("Arial", 16, QFont.DemiBold))
        main_layout.addWidget(intro)

        # Dashboard panels
        panels = QHBoxLayout()
        panels.setSpacing(16)
        self.panels = {}

        for heading, description in [
            ("CAN Traffic", "Live packet stream will appear here."),
            ("Threat Level", "Threat indicator will appear here."),
            ("ECU Telemetry", "ECU status and telemetry will appear here."),
        ]:
            panel = QFrame()
            panel.setObjectName("panel")
            panel_layout = QVBoxLayout(panel)
            panel_layout.setContentsMargins(18, 20, 18, 20)

            heading_label = QLabel(heading)
            heading_label.setFont(QFont("Arial", 13, QFont.Bold))

            description_label = QLabel(description)
            description_label.setObjectName("muted")
            description_label.setWordWrap(True)

            panel_layout.addWidget(heading_label)
            panel_layout.addSpacing(10)
            panel_layout.addWidget(description_label)
            panel_layout.addStretch()

            panels.addWidget(panel)
        self.panels[heading] = panel

        main_layout.addLayout(panels, 1)

        footer = QLabel(
            "CAN-Sentinel | UI Architecture Prototype | Live integration pending"
        )
        footer.setObjectName("muted")
        footer.setAlignment(Qt.AlignCenter)
        main_layout.addWidget(footer)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = CANSentinelDashboard()
    window.show()
    sys.exit(app.exec_())
