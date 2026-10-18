import csv
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parents[2] / "data" / "can_log.csv"

WINDOW_SECONDS = 2.0
THRESHOLD = 5


def parse_timestamp(value):
    try:
        return datetime.fromisoformat(value).timestamp()
    except (ValueError, TypeError):
        return None


def main():
    if not LOG_FILE.exists():
        print(f"Log file not found: {LOG_FILE}")
        return

    windows = defaultdict(deque)
    alerted_ids = set()
    alerts = 0
    messages_read = 0

    with LOG_FILE.open("r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)

        for row in reader:
            can_id = row.get("can_id")
            timestamp = parse_timestamp(row.get("timestamp_utc"))

            if not can_id or timestamp is None:
                continue

            messages_read += 1
            recent = windows[can_id]
            recent.append(timestamp)

            while recent and timestamp - recent[0] > WINDOW_SECONDS:
                recent.popleft()

        if len(recent) >= THRESHOLD and can_id not in alerted_ids:
            alerts += 1
            alerted_ids.add(can_id)
            print(
            f"ALERT: CAN ID {can_id} sent "
            f"{len(recent)} messages within "
            f"{WINDOW_SECONDS:.0f} seconds"
       )

        elif len(recent) < THRESHOLD:
            alerted_ids.discard(can_id)

    print("\nTime-window detection summary")
    print(f"Messages analysed: {messages_read}")
    print(f"Alerts generated: {alerts}")

    if alerts == 0:
        print("No high-frequency activity detected in this log.")
    print("Note: This is a basic demo rule, not a validated vehicle threshold.")


if __name__ == "__main__":
    main()

