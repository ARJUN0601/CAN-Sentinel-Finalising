from PyQt5.QtWidgets import QLabel, QVBoxLayout
from PyQt5.QtGui import QFont


class SectionHeader(QVBoxLayout):
    """Reusable header for dashboard sections."""

    def __init__(self, title, subtitle=""):
        super().__init__()

        self.setSpacing(8)

        heading = QLabel(title)
        heading.setFont(QFont("Arial", 14, QFont.Bold))
        heading.setStyleSheet("""
            color: #F8FAFC;
            background: transparent;
        """)

        self.addWidget(heading)

        if subtitle:
            description = QLabel(subtitle)
            description.setWordWrap(True)
            description.setStyleSheet("""
                color: #94A3B8;
                background: transparent;
            """)
            self.addWidget(description)

        self.addStretch()
