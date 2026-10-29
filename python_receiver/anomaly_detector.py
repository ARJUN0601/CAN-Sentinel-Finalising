#!/usr/bin/env python3
"""CAN-Sentinel Member 2: baseline-trained Isolation Forest detector."""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from typing import Sequence

import numpy as np
from sklearn.ensemble import IsolationForest

try:
    from python_receiver.uds_receiver import CanPacket
except ModuleNotFoundError:
    from uds_receiver import CanPacket


@dataclass(frozen=True)
class DetectionResult:
    packet: CanPacket
    anomaly: bool
    score: float


def packet_features(
    packet: CanPacket,
    previous_timestamp_us: int | None = None,
) -> list[float]:
    """Extract a fixed-length numeric feature vector from a CAN packet."""
    payload = list(packet.payload) + [0] * (8 - packet.dlc)
    byte_counts = [packet.payload.count(value) for value in set(packet.payload)]
    entropy = 0.0

    if packet.dlc:
        for count in byte_counts:
            probability = count / packet.dlc
            entropy -= probability * math.log2(probability)

    delta_us = (
        0
        if previous_timestamp_us is None
        else max(0, packet.timestamp_us - previous_timestamp_us)
    )

    return [
        float(packet.can_id),
        float(packet.dlc),
        float(packet.is_extended),
        float(packet.is_rtr),
        float(packet.is_error),
        *map(float, payload),
        float(entropy),
        float(delta_us),
    ]


class IsolationForestDetector:
    """Train on a known-normal baseline, then score incoming packets."""

    def __init__(
        self,
        contamination: float = 0.01,
        random_state: int = 42,
    ) -> None:
        if not 0.0 < contamination <= 0.5:
            raise ValueError("contamination must be in (0, 0.5]")

        self.model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=random_state,
        )
        self._previous_timestamp_us: int | None = None
        self._baseline: list[list[float]] = []
        self._fitted = False

    @property
    def is_fitted(self) -> bool:
        return self._fitted

    @property
    def baseline_size(self) -> int:
        return len(self._baseline)

    def fit(self, packets: Sequence[CanPacket]) -> None:
        if len(packets) < 2:
            raise ValueError("At least two baseline packets are required")

        previous: int | None = None
        features: list[list[float]] = []

        for packet in packets:
            features.append(packet_features(packet, previous))
            previous = packet.timestamp_us

        self.model.fit(np.asarray(features, dtype=float))
        self._previous_timestamp_us = previous
        self._fitted = True

    def observe_baseline(self, packet: CanPacket, required: int = 100) -> bool:
        """Collect baseline packets; return True once training completes."""
        if self._fitted:
            raise RuntimeError("Detector is already trained")
        if required < 2:
            raise ValueError("required must be at least 2")

        # Keep timestamp separately so feature extraction uses real timestamps.
        previous_timestamp = getattr(self, "_baseline_timestamp", None)
        features = packet_features(packet, previous_timestamp)
        self._baseline.append(features)
        self._baseline_timestamp = packet.timestamp_us

        if len(self._baseline) < required:
            return False

        self.model.fit(np.asarray(self._baseline, dtype=float))
        self._fitted = True
        self._previous_timestamp_us = packet.timestamp_us
        return True

    def score(self, packet: CanPacket) -> DetectionResult:
        if not self._fitted:
            raise RuntimeError("Train the detector before scoring packets")

        features = packet_features(packet, self._previous_timestamp_us)
        # sklearn: lower decision_function scores are more anomalous.
        decision_score = float(self.model.decision_function([features])[0])
        prediction = int(self.model.predict([features])[0])
        self._previous_timestamp_us = packet.timestamp_us

        return DetectionResult(
            packet=packet,
            anomaly=(prediction == -1),
            score=decision_score,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contamination", type=float, default=0.01)
    parser.add_argument("--train-samples", type=int, default=100)
    args = parser.parse_args()

    detector = IsolationForestDetector(contamination=args.contamination)
    print(
        "Detector initialized. Import IsolationForestDetector into the "
        "receiver pipeline to train and score live packets."
    )
    print(f"Baseline packets required: {args.train_samples}")
    print("Important: train only on representative, known-normal traffic.")


if __name__ == "__main__":
    main()
