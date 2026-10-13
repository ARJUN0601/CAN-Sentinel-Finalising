# CAN-Sentinel: Automotive Security / CPS Project
## Week 1 — Member 1 Deliverables & Low-Level SocketCAN Setup

**Role**: Member 1 — Low-Level Engineering (C, SocketCAN)  
**Assigned Task**: Configure Linux SocketCAN interface (`vcan0`) and write setup automation scripts.  
**Key Deliverables**: Operational `vcan0` interface & automated setup script.

---

### 1. Overview & Architecture

In automotive cyber-physical systems (CPS), the **Controller Area Network (CAN)** bus links Engine Control Units (ECUs), steering, transmission, and body controllers.

Linux **SocketCAN** is the official Linux kernel network stack implementation for CAN. By implementing a virtual CAN device (`vcan0`), our team can develop, test, and inject real-time automotive telemetry without requiring physical automotive hardware or expensive OBD-II dongles.

```
+------------------------------------------------------------------------+
|                      MEMBER 1 DELIVERABLE: vcan0 BUS                  |
|                   Linux Kernel Virtual CAN Interface                   |
+------------------------------------------------------------------------+
         ^                        ^                     |
         | (ID 0x120, 0x130)      | (ID 0x240, 0x250)   | (Raw Frames)
+------------------+    +------------------+    +-----------------------+
|     MEMBER 2     |    |     MEMBER 3     |    |       MEMBER 4        |
| Mock ECU Script  |    | Extended Telemetry|    | Python Raw Socket /   |
| (Steering & RPM) |    | (Speed & Temp)   |    | python-can Capture    |
+------------------+    +------------------+    +-----------------------+
                                                            |
                                                            v
                                                +-----------------------+
                                                |       MEMBER 5        |
                                                | CSV Dataset Parser    |
                                                | for ML Training       |
                                                +-----------------------+
```

---

### 2. Team Arbitration ID Specification Table

To ensure seamless integration across all 5 team members:

| CAN ID (Hex) | Message Name | DLC | Frequency | Assigned Member | Payload Description |
|:---|:---|:---:|:---:|:---|:---|
| `0x101` | Heartbeat / Ping | 8 | On Demand | **Member 1** | ASCII "SENTINEL" loopback check |
| `0x120` | Steering Angle | 4 | 20 ms | **Member 2** | Float32 angle (-540.0° to +540.0°) |
| `0x130` | Engine RPM | 2 | 10 ms | **Member 2** | UInt16 engine RPM (0 - 8000 RPM) |
| `0x240` | Vehicle Speed | 2 | 50 ms | **Member 3** | UInt16 km/h * 100 |
| `0x250` | Engine Temperature| 1 | 100 ms | **Member 3** | Int8 degrees Celsius (-40 to 150) |

---

### 3. Quick Start Guide for Team Members

#### Step 1: Run Member 1 Automated Setup Script
```bash
# Grants root access, loads kernel modules (can, vcan), creates vcan0, configures MTU
sudo ./scripts/setup_vcan0.sh
```

#### Step 2: Compile & Execute Member 1 C Verification Tool
```bash
make
./bin/vcan_checker vcan0
```

#### Step 3: Run Full Automated Test Suite
```bash
make test
```

#### Step 4: Verify with can-utils
```bash
# In Terminal 1 (Listen to all bus traffic):
candump -tz vcan0

# In Terminal 2 (Send test steering frame):
cansend vcan0 120#01201020
```

---

### 4. Making vcan0 Persistent on System Boot
To keep `vcan0` active across reboots so you don't need to re-run the setup script:
```bash
make install-service
```
