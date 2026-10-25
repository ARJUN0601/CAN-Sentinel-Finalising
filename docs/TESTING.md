# CAN-Sentinel — ECU Testing Report

## 1. Test Environment

* Operating System: Ubuntu Linux
* CAN Interface: `vcan0` (Virtual CAN)
* Testing Tool: `candump` from `can-utils`
* Test Type: Simulated CAN message transmission and reception

## 2. Vehicle Speed ECU

* Source File: `src/speed_ecu.c`
* CAN ID: `0x240`
* DLC: 2 bytes
* Transmission Interval: 50 ms
* Test Command: `./bin/speed_ecu vcan0 45`

**Observed Result:**

* The ECU transmitted CAN frames successfully.
* `candump` received frames with CAN ID `0x240`.
* Received data: `94 11`
* Decoded value: `0x1194` = 4500, representing **45.00 km/h**.

**Status: PASS**

## 3. Engine Temperature ECU

* Source File: `src/temperature_ecu.c`
* CAN ID: `0x250`
* DLC: 1 byte
* Transmission Interval: 100 ms
* Test Command: `./bin/temperature_ecu vcan0 90`

**Observed Result:**

* The ECU transmitted CAN frames successfully.
* `candump` received frames with CAN ID `0x250`.
* Received data: `5A` (hexadecimal), representing **90°C**.

**Status: PASS**

## 4. Conclusion

Both Member 3 ECU programs successfully transmitted their expected CAN frames over the virtual `vcan0` interface, and the received CAN IDs and payloads matched the expected values.

**Note:** These tests used a virtual CAN interface and do not represent testing on a physical vehicle CAN bus.

## Week 2: Dynamic ECU Testing

### 1. Dynamic Vehicle Speed ECU
- **Source file:** `src/speed_ecu_week2.c`
- **CAN ID:** `0x240`
- **Payload length:** 2 bytes
- **Transmission interval:** 50 ms
- **Test result:** Successfully transmitted and received changing speed values using the virtual CAN interface `vcan0`.
- **Observed behavior:** Speed increased from 0 to 80 km/h and then decreased back toward 0, repeating continuously.
- **Encoding:** Speed is represented as km/h multiplied by 100 and stored in a two-byte little-endian value.

### 2. Dynamic Engine Temperature ECU
- **Source file:** `src/temperature_ecu_week2.c`
- **CAN ID:** `0x250`
- **Payload length:** 1 byte
- **Transmission interval:** 100 ms
- **Test result:** Successfully transmitted and received changing temperature values using `candump -tz vcan0`.
- **Observed behavior:** Temperature varied between 80°C and 100°C, increasing and decreasing continuously.
- **Encoding:** Temperature is represented as a single byte.

### Testing Environment
- Operating system: Ubuntu Linux
- CAN interface: `vcan0`
- Monitoring tool: `candump` from `can-utils`
- **Conclusion:** Both dynamic ECUs were compiled and tested successfully. Their CAN frames were received on the virtual CAN interface. These tests used simulated traffic, not a physical vehicle.

## Automated Build and Test Results

### Build Verification

* Updated the root `Makefile` to include the Week 2 dynamic speed and temperature ECUs.
* Successfully compiled all seven project programs using `make clean && make`.
* No compilation errors or warnings were reported.

### Test Suite Verification

* Updated `tests/test_suite.sh` to check all seven required executable programs.
* Preserved the existing ECU input-validation checks.
* Executed the test suite using `make test`.

**Results:**

* Tests passed: 11
* Tests failed: 0

**Note:** The automated suite checks executable availability and input validation. Dynamic CAN transmissions from the Week 2 ECUs were verified separately through manual testing.

**Overall status: PASS**
