import socket
import struct

import pytest

from python_receiver.uds_receiver import (
    PACKET_FORMAT,
    PACKET_SIZE,
    CanPacket,
    read_exact,
)
from python_receiver.anomaly_detector import (
    IsolationForestDetector,
    packet_features,
)


def make_packet(timestamp=1000, can_id=0x123, data=b"\x10\x01"):
    return CanPacket(timestamp, can_id, len(data), data)


def test_packet_format_is_21_bytes():
    assert PACKET_SIZE == 21


def test_packet_decoding():
    raw = struct.pack(
        PACKET_FORMAT,
        123456,
        0x123,
        3,
        bytes([0x02, 0x10, 0x01, 0, 0, 0, 0, 0]),
    )
    packet = CanPacket.from_bytes(raw)
    assert packet.timestamp_us == 123456
    assert packet.can_id == 0x123
    assert packet.dlc == 3
    assert packet.payload == bytes([0x02, 0x10, 0x01])


def test_invalid_packet_length_rejected():
    with pytest.raises(ValueError):
        CanPacket.from_bytes(b"\x00")


def test_invalid_dlc_rejected():
    raw = struct.pack(PACKET_FORMAT, 1, 0x123, 9, bytes(8))
    with pytest.raises(ValueError, match="DLC"):
        CanPacket.from_bytes(raw)


def test_fragmented_socket_read():
    left, right = socket.socketpair()
    try:
        left.sendall(b"\x01\x02")
        left.sendall(b"\x03\x04")
        assert read_exact(right, 4) == b"\x01\x02\x03\x04"
    finally:
        left.close()
        right.close()


def test_packet_features_have_expected_length():
    assert len(packet_features(make_packet())) == 15


def test_detector_fit_and_score():
    baseline = [
        make_packet(i * 10000, data=bytes([0x10, i % 4]))
        for i in range(20)
    ]
    detector = IsolationForestDetector(contamination=0.1)
    detector.fit(baseline)

    result = detector.score(make_packet(210000))
    assert detector.is_fitted
    assert isinstance(result.anomaly, bool)
    assert isinstance(result.score, float)


def test_baseline_training_completes_once():
    detector = IsolationForestDetector(contamination=0.1)
    baseline = [
        make_packet(i * 10000, data=bytes([0x10, i % 4]))
        for i in range(20)
    ]

    flags = [
        detector.observe_baseline(packet, required=20)
        for packet in baseline
    ]

    assert detector.is_fitted
    assert detector.baseline_size == 20
    assert sum(flags) == 1


def test_detector_rejects_scoring_before_training():
    detector = IsolationForestDetector()
    with pytest.raises(RuntimeError, match="Train"):
        detector.score(make_packet())
