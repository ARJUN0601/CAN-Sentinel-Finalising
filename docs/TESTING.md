# CAN-Sentinel: CAN Logger Testing

## Objective
Verify that the Python CAN logger captures CAN frames and saves them to a CSV file.

## Test Environment
- Operating System: Ubuntu Linux running in VirtualBox
- CAN Interface: vcan0 (virtual CAN interface)
- Python Library: python-can
- Test Tool: can-utils

## Test Procedure
1. Created and activated the virtual CAN interface `vcan0`.
2. Started the `can_logger.py` script.
3. Sent a test CAN frame using `cansend vcan0 123#DEADBEEF`.
4. Verified that the logger displayed the received frame.
5. Checked `can_log.csv` for the captured data.

## Test Results
- CAN ID: `0x123`
- Extended ID: `False`
- DLC: `4`
- Data: `DE AD BE EF`
- CSV logging: Successful

## Conclusion
The CAN logger successfully captured a simulated CAN frame and saved its details to a CSV file.

**Note:** Testing used a virtual CAN interface and simulated traffic, not a physical vehicle or CAN bus.

## Additional Test Summary

- **Additional frames captured:** 30
- **CAN IDs tested:** `0x101` to `0x11E`
- **Result:** All 30 additional simulated CAN frames were captured by the logger.
- **Output file:** `can_log.csv`
