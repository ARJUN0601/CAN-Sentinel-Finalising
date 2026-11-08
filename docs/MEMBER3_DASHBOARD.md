# CAN-Sentinel: Member 3 Dashboard Documentation

## 1. Overview

Member 3 is responsible for the vehicle telemetry and PyQt desktop dashboard components of the CAN-Sentinel project.

The dashboard provides a graphical interface for displaying vehicle speed and engine temperature received through the Controller Area Network (CAN).

## 2. Dashboard Architecture

The dashboard is developed using Python and PyQt5.

Main components:

| File | Responsibility |
|---|---|
| `main_window.py` | Main dashboard window, UI layout and telemetry updates |
| `can_receiver.py` | Receives and decodes vehicle telemetry CAN messages |
| `status_badge.py` | Displays connection and monitoring status |
| `section_header.py` | Provides reusable dashboard section headers |

The dashboard contains three main panels:

- **CAN Traffic:** CAN traffic monitoring panel.
- **Threat Level:** Security threat monitoring panel.
- **ECU Telemetry:** Displays vehicle speed and engine temperature.

## 3. CAN Telemetry Message Format

The dashboard receives two ECU telemetry messages.

### Vehicle Speed

| Property | Value |
|---|---|
| CAN ID | `0x240` |
| Data length | 2 bytes |
| Data type | Unsigned 16-bit integer |
| Byte order | Little-endian |
| Unit | km/h |
| Scaling | Raw value / 100 |

Example: A raw value of `2000` represents `20.00 km/h`.

### Engine Temperature

| Property | Value |
|---|---|
| CAN ID | `0x250` |
| Data length | 1 byte |
| Data type | Signed 8-bit integer |
| Unit | °C |

Example: A received value of `90` represents `90°C`.

## 4. Live CAN Reception

The `CANReceiver` class uses the Python CAN library with the SocketCAN interface.

The receiver:

1. Connects to the `vcan0` virtual CAN interface.
2. Receives incoming CAN messages.
3. Identifies vehicle speed and engine temperature messages.
4. Decodes their payloads.
5. Returns the decoded telemetry to the dashboard.

A PyQt timer polls for CAN messages every 20 milliseconds.

The telemetry cards update when valid messages are received.

## 5. Telemetry Status Indicators

The ECU Telemetry panel displays four status states.

| Status | Meaning |
|---|---|
| CONNECTED | CAN receiver successfully opened the interface |
| MONITORING | Valid telemetry messages are being received |
| WARNING | No telemetry has arrived for more than 2 seconds |
| DISCONNECTED | CAN receiver initialization or reception failed |

When telemetry resumes after a WARNING state, the dashboard returns to MONITORING.

## 6. Running the Dashboard

### Step 1: Set up the virtual CAN interface

```bash
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

If `vcan0` already exists, it may only need to be brought up.

### Step 2: Start the vehicle speed ECU

```bash
cd ~/CAN-Sentinel
./bin/speed_ecu_week2 vcan0
```

### Step 3: Start the engine temperature ECU

Open another terminal:

```bash
cd ~/CAN-Sentinel
./bin/temperature_ecu_week2 vcan0
```

### Step 4: Launch the dashboard

Open another terminal:

```bash
cd ~/CAN-Sentinel/src/dashboard
python3 main_window.py
```

The ECU Telemetry panel should display changing vehicle speed and engine temperature values.

## 7. Testing and Verification

The following functionality has been tested:

- CAN receiver connection to `vcan0`.
- Vehicle speed message decoding.
- Engine temperature message decoding.
- Live telemetry card updates.
- CONNECTED and MONITORING status changes.
- WARNING status when telemetry stops for more than 2 seconds.
- Recovery from WARNING to MONITORING when telemetry resumes.
- Python syntax verification of dashboard components.

## 8. Technologies Used

- Python
- PyQt5
- Python-CAN
- SocketCAN
- Linux Virtual CAN (`vcan0`)
- C-based ECU simulation programs

## 9. Scope of Contribution

This documentation covers Member 3's vehicle telemetry and desktop dashboard responsibilities.

The CAN traffic logging and threat detection implementations are separate project responsibilities.

---

**Project:** CAN-Sentinel  
**Component:** Vehicle Telemetry and PyQt Dashboard  
**Contributor:** Member 3
