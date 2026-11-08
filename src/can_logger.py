
import can
import csv
import os
from datetime import datetime

INTERFACE = "socketcan"
CHANNEL = "vcan0"
LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "samples", "can_log.csv")
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

def main():
    print("===================================")
    print("   CAN-Sentinel Data Logger")
    print("===================================")
    print(f"Interface: {CHANNEL}")
    print(f"Log file:  {LOG_FILE}")
    print("Listening for CAN frames...")
    print("Press Ctrl+C to stop.\n")

    try:
        bus = can.Bus(
            interface=INTERFACE,
            channel=CHANNEL
        )

        file_exists = os.path.exists(LOG_FILE)

        with open(LOG_FILE, "a", newline="") as csvfile:
            writer = csv.writer(csvfile)

            if not file_exists or os.path.getsize(LOG_FILE) == 0:
                writer.writerow([
                    "timestamp",
                    "can_id",
                    "extended_id",
                    "dlc",
                    "data"
                ])

            while True:
                message = bus.recv(timeout=1.0)

                if message is None:
                    continue

                timestamp = datetime.now().isoformat(
                    timespec="milliseconds"
                )
                data = message.data.hex(" ").upper()

                writer.writerow([
                    timestamp,
                    f"0x{message.arbitration_id:X}",
                    message.is_extended_id,
                    message.dlc,
                    data
                ])
                csvfile.flush()

                print(
                    f"[{timestamp}] "
                    f"ID=0x{message.arbitration_id:X} "
                    f"DLC={message.dlc} "
                    f"DATA={data}"
                )

    except KeyboardInterrupt:
        print("\nCapture stopped.")

    except (can.CanError, OSError) as error:
        print(f"CAN error: {error}")
        print("Check that vcan0 is configured and running.")

    finally:
        if "bus" in locals():
            bus.shutdown()

if __name__ == "__main__":
    main()
