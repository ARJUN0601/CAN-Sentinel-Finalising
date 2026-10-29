#!/usr/bin/env python3
"""CAN-Sentinel Member 2: Unix-domain-socket CAN packet receiver."""

from __future__ import annotations

import argparse
import os
import socket
import stat
import struct
from dataclasses import dataclass
from typing import Iterator, Optional

PACKET_FORMAT = "<QIB8s"
PACKET_SIZE = struct.calcsize(PACKET_FORMAT)  # 21 bytes
DEFAULT_SOCKET_PATH = "/tmp/can_sentinel.sock"

CAN_EFF_FLAG = 0x80000000
CAN_RTR_FLAG = 0x40000000
CAN_ERR_FLAG = 0x20000000
CAN_SFF_MASK = 0x7FF
CAN_EFF_MASK = 0x1FFFFFFF


@dataclass(frozen=True)
class CanPacket:
    timestamp_us: int
    raw_can_id: int
    dlc: int
    payload: bytes

    @classmethod
    def from_bytes(cls, raw: bytes) -> "CanPacket":
        if len(raw) != PACKET_SIZE:
            raise ValueError(
                f"Expected {PACKET_SIZE} bytes, received {len(raw)}"
            )

        timestamp_us, raw_can_id, dlc, data = struct.unpack(PACKET_FORMAT, raw)

        if dlc > 8:
            raise ValueError(f"Invalid CAN DLC: {dlc}")

        return cls(timestamp_us, raw_can_id, dlc, data[:dlc])

    @property
    def is_extended(self) -> bool:
        return bool(self.raw_can_id & CAN_EFF_FLAG)

    @property
    def is_rtr(self) -> bool:
        return bool(self.raw_can_id & CAN_RTR_FLAG)

    @property
    def is_error(self) -> bool:
        return bool(self.raw_can_id & CAN_ERR_FLAG)

    @property
    def can_id(self) -> int:
        mask = CAN_EFF_MASK if self.is_extended else CAN_SFF_MASK
        return self.raw_can_id & mask

    def hex_payload(self) -> str:
        return self.payload.hex(" ").upper()


def read_exact(conn: socket.socket, size: int) -> Optional[bytes]:
    """Read exactly size bytes; return None if the peer closes mid-packet."""
    chunks = bytearray()

    while len(chunks) < size:
        chunk = conn.recv(size - len(chunks))
        if not chunk:
            return None
        chunks.extend(chunk)

    return bytes(chunks)


def prepare_socket_path(path: str) -> None:
    """Remove a stale socket only; never delete a regular file or active socket."""
    if not os.path.lexists(path):
        return

    mode = os.lstat(path).st_mode
    if not stat.S_ISSOCK(mode):
        raise RuntimeError(f"Refusing to replace non-socket path: {path}")

    probe = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        try:
            probe.connect(path)
        except OSError:
            os.unlink(path)
        else:
            raise RuntimeError(f"Another receiver is using {path}")
    finally:
        probe.close()


def stream_can_packets(
    socket_path: str = DEFAULT_SOCKET_PATH,
) -> Iterator[CanPacket]:
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    bound = False

    try:
        prepare_socket_path(socket_path)
        server.bind(socket_path)
        bound = True
        server.listen(5)
        print(f"UDS receiver listening on {socket_path}", flush=True)

        while True:
            conn, _ = server.accept()
            with conn:
                while True:
                    raw = read_exact(conn, PACKET_SIZE)
                    if raw is None:
                        break

                    try:
                        yield CanPacket.from_bytes(raw)
                    except ValueError as exc:
                        print(f"Rejected malformed packet: {exc}", flush=True)
                        # The fixed-size frame has been consumed; continue.

    finally:
        server.close()
        if bound and os.path.exists(socket_path):
            try:
                if stat.S_ISSOCK(os.lstat(socket_path).st_mode):
                    os.unlink(socket_path)
            except FileNotFoundError:
                pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--socket",
        default=DEFAULT_SOCKET_PATH,
        help=f"Unix socket path (default: {DEFAULT_SOCKET_PATH})",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Print each decoded CAN packet",
    )
    parser.add_argument("--detect", action="store_true", help="Enable Isolation Forest anomaly detection")
    parser.add_argument("--train-samples", type=int, default=100, help="Normal baseline packets required before scoring")
    parser.add_argument("--contamination", type=float, default=0.01, help="Expected baseline outlier fraction (0, 0.5]")
    args = parser.parse_args()

    detector = None
    if args.detect:
        if args.train_samples < 2:
            parser.error("--train-samples must be at least 2")
        try:
            from anomaly_detector import IsolationForestDetector
            detector = IsolationForestDetector(contamination=args.contamination)
        except (ImportError, ValueError) as exc:
            parser.error(f"Cannot initialize anomaly detector: {exc}")

    count = 0
    try:
        for packet in stream_can_packets(args.socket):
            count += 1
            if detector is not None:
                if not detector.is_fitted:
                    trained = detector.observe_baseline(packet, required=args.train_samples)
                    status = " TRAINED" if trained else ""
                    print(f"BASELINE {detector.baseline_size}/{args.train_samples}{status}", flush=True)
                else:
                    result = detector.score(packet)
                    label = "ANOMALY" if result.anomaly else "NORMAL"
                    print(f"{label} id=0x{packet.can_id:X} score={result.score:.6f}", flush=True)
            if args.verbose:
                flags = []
                if packet.is_extended:
                    flags.append("EFF")
                if packet.is_rtr:
                    flags.append("RTR")
                if packet.is_error:
                    flags.append("ERR")
                flag_text = ",".join(flags) if flags else "-"
                print(
                    f"ts={packet.timestamp_us}us "
                    f"id=0x{packet.can_id:X} dlc={packet.dlc} "
                    f"flags={flag_text} data=[{packet.hex_payload()}]",
                    flush=True,
                )
    except KeyboardInterrupt:
        print(f"\nReceiver stopped; decoded {count} packets.", flush=True)


if __name__ == "__main__":
    main()
