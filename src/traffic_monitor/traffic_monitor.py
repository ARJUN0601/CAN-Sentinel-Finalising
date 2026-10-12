import can
import csv
from datetime import datetime, timezone

INTERFACE = "socketcan"
CHANNEL = "vcan0"
LOG_FILE = "can_log.csv"

def main():
    print(f"Listening on {CHANNEL}...")
    print("Press Ctrl+C to stop.")

    with can.Bus(
        interface=INTERFACE,
        channel=CHANNEL
    ) as bus, open(
        LOG_FILE, "a", newline="", encoding="utf-8"
    ) as file:

        writer = csv.writer(file)

        if file.tell() == 0:
            writer.writerow([
                "timestamp_utc",
                "can_id",
                "is_extended_id",
                "data_hex",
                "dlc"
            ])

        try:
            while True:
                message = bus.recv(timeout=1.0)

                if message is None:
                    continue

                timestamp = datetime.now(
                    timezone.utc
                ).isoformat()

                writer.writerow([
                    timestamp,
                    hex(message.arbitration_id),
                    message.is_extended_id,
                    message.data.hex(" "),
                    message.dlc
                ])
                file.flush()

                print(
                    f"ID={message.arbitration_id:03X} "
                    f"DATA={message.data.hex(' ')}"
                )

        except KeyboardInterrupt:
            print("\nMonitoring stopped.")

if __name__ == "__main__":
    main()
