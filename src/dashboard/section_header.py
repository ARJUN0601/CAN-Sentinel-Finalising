from PyQt5.QtWidgets import QLabel, QHBoxLayout
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont


class SectionHeader(QHBoxLayout):
    """Reusable header for dashboard sections."""

    def __init__(self, title, subtitle=""):
        super().__init__()

        self.setSpacing(10)

        heading = QLabel(title)
        heading.setFont(QFont("Arial", 14, QFont.Bold))

        self.addWidget(heading)

        if subtitle:
            description = QLabel(subtitle)
            description.setStyleSheet("color: #9CA3AF;")
            self.addWidget(description)

        self.addStretch()
