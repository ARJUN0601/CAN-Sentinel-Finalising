# CAN-Sentinel: CAN Logger Testing

## Objective

Verify that the Python CAN logger captures CAN frames and saves them to a CSV file.

## Test Environment

* Operating System: Ubuntu Linux running in VirtualBox
* CAN Interface: `vcan0` (virtual CAN interface)
* Python Library: `python-can`
* Test Tool: `can-utils`

## Test Procedure

1. Created and activated the virtual CAN interface `vcan0`.
2. Started the `can_logger.py` script.
3. Sent a test CAN frame using `cansend vcan0 123#DEADBEEF`.
4. Verified that the logger displayed the received frame.
5. Checked `data/samples/can_log.csv` for the captured data.

## Test Results

* CAN ID: `0x123`
* Extended ID: `False`
* DLC: `4`
* Data: `DE AD BE EF`
* CSV logging: Successful

## Additional Test Summary

* **Additional frames captured:** 30
* **CAN IDs tested:** `0x101` to `0x11E`
* **Result:** All 30 additional simulated CAN frames were captured by the logger.
* **Output file:** `data/samples/can_log.csv`

## Updated Logger Verification — 20 October 2026

* **Script tested:** `can_logger_updated.py`
* **Interface:** `vcan0`
* **Test frame:** `0x123`
* **Payload:** `DE AD BE EF`
* **Result:** Successfully captured the simulated CAN frame.
* **CSV verification:** Confirmed the timestamp, CAN ID, extended ID, DLC, and payload were saved correctly.

## Test Coverage and Next Steps

### Verified

* CAN frame reception through the virtual interface `vcan0`.
* Logging of timestamps, CAN IDs, extended-ID status, DLC, and payload.
* CSV output creation and data persistence.
* Capture of additional simulated CAN frames.

### Planned

* Test frames with different payload lengths and CAN IDs.
* Verify logger behavior when no frames are received.
* Test integration with the project's traffic detection components.
* Document the results of additional test cases.

## Conclusion

The CAN logger successfully captured simulated CAN frames and saved their details to a CSV file. Testing confirmed basic frame reception and CSV logging using a virtual CAN interface. Further testing and integration are planned to improve test coverage.
