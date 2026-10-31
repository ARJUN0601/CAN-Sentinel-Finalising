from PyQt5.QtWidgets import QLabel
from PyQt5.QtCore import Qt


class StatusBadge(QLabel):
    """Reusable status indicator for the CAN-Sentinel dashboard."""

    STATUS_STYLES = {
        "CONNECTED": ("#065F46", "#A7F3D0"),
        "DISCONNECTED": ("#7F1D1D", "#FECACA"),
        "MONITORING": ("#1E40AF", "#BFDBFE"),
        "WARNING": ("#92400E", "#FDE68A"),
    }

    def __init__(self, status="DISCONNECTED", parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignCenter)
        self.setMinimumWidth(120)
        self.set_status(status)

    def set_status(self, status):
        status = status.upper()

        if status not in self.STATUS_STYLES:
            status = "DISCONNECTED"

        background, foreground = self.STATUS_STYLES[status]

        self.setText(status)
        self.setStyleSheet(f"""
            QLabel {{
                background-color: {background};
                color: {foreground};
                border-radius: 8px;
                padding: 6px 12px;
                font-weight: bold;
            }}
        """)
