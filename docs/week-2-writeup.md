# CAN-Sentinel — Week 2 Progress Write-up

## 1. Project Overview

CAN-Sentinel is an Automotive ECU Intrusion Detection System project that uses simulated Controller Area Network (CAN) traffic to demonstrate basic traffic monitoring and anomaly detection.

## 2. Work Completed

During this phase, the following components were implemented and tested:

- Set up a Linux WSL2 environment with a virtual CAN interface (`vcan0`).
- Implemented a Python traffic monitoring script using `python-can`.
- Captured CAN message IDs, payloads, timestamps, and data length.
- Stored captured traffic in a CSV log for further analysis.
- Implemented a rule-based detector that checks CAN message frequency within a configurable time window.
- Tested the detector against recorded simulated CAN traffic.
- Documented the test procedure, observed results, and system limitations.

## 3. Detection Test Results

- Environment: Linux WSL2 with virtual CAN (`vcan0`)
- Test CAN ID: `0x123`
- Detection window: 2 seconds
- Configured threshold: 5 messages
- Messages analysed: 23
- Alerts generated: 1
- Observed alert: CAN ID `0x123` sent 20 messages within 2 seconds.

The test demonstrated that the rule-based detector could identify high-frequency activity in the recorded simulation log.

## 4. Current Limitations

The current detector uses a basic rule-based approach. Its threshold is intended for demonstration and has not been validated for real automotive systems. The test does not establish detection accuracy against a labelled dataset.

Machine-learning-based anomaly detection and dashboard integration remain separate tasks requiring implementation and testing.

## 5. Next Steps

- Improve and test detection logic with additional simulated traffic scenarios.
- Investigate machine-learning-based anomaly detection.
- Integrate detection results and logs into a diagnostic dashboard.
- Perform additional tests and document the results.

## 6. Conclusion

The project has established a working foundation for simulated CAN traffic capture, CSV logging, and rule-based high-frequency detection. Further implementation and testing are needed to develop and evaluate the planned machine-learning and dashboard components.
