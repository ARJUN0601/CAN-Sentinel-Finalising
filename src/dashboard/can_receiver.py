import can


class CANReceiver:
    """Receive vehicle speed and engine temperature from CAN."""

    def __init__(self, interface="vcan0"):
        self.bus = can.interface.Bus(
            channel=interface,
            interface="socketcan"
        )

    def receive_telemetry(self, timeout=1.0):
        message = self.bus.recv(timeout)

        if message is None:
            return None

        if message.arbitration_id == 0x240 and len(message.data) >= 2:
            raw_speed = int.from_bytes(
                message.data[0:2],
                byteorder="little",
                signed=False
            )
            return {"speed": raw_speed / 100.0}

        if message.arbitration_id == 0x250 and len(message.data) >= 1:
            temperature = int.from_bytes(
                message.data[0:1],
                byteorder="little",
                signed=True
            )
            return {"temperature": temperature}

        return None

    def close(self):
        self.bus.shutdown()
