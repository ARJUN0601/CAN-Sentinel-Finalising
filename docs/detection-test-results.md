# CAN-Sentinel Detection Test Results

## Test 1: Simulated High-Frequency CAN Traffic

- Environment: Linux WSL2 with virtual CAN interface (vcan0)
- CAN ID tested: 0x123
- Detection window: 2 seconds
- Configured threshold: 5 messages
- Messages analysed: 23
- Alerts generated: 1
- Result: Alert successfully generated for high-frequency traffic.

## Limitation

This is a basic rule-based demonstration using simulated CAN traffic.
The threshold is not validated for real automotive systems.
