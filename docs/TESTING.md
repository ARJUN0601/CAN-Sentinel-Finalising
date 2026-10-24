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
