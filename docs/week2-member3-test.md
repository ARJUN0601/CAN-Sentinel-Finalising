# CAN-Sentinel — Week 2, Member 3 Test

## Objective
Generate dynamic Speed and Temperature telemetry using a C-based mock ECU.

## CAN IDs
- 0x240: Speed telemetry
- 0x250: Temperature telemetry

## Test Environment
- Linux WSL Ubuntu
- Virtual CAN interface: vcan0
- Language: C
- Build: GCC / Makefile

## Test Results
- Compiled speed_temp_ecu successfully.
- Received CAN frames for ID 0x240 using candump.
- Received CAN frames for ID 0x250 using candump.
- Speed and temperature values changed during simulation.
- Both CAN IDs were observed on vcan0.

## Status
Telemetry generation and virtual CAN transmission test passed.

## Limitation
This is a virtual simulation, not testing on a physical vehicle.
