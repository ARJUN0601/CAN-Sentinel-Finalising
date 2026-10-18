# CAN-Sentinel Detection Test Results

## Test 1: Simulated High-Frequency CAN Traffic

- **Environment:** Linux WSL2 with virtual CAN interface (`vcan0`)
- **CAN ID tested:** `0x123`
- **Detection window:** 2 seconds
- **Configured threshold:** 5 messages
- **Messages analysed:** 23
- **Alerts generated:** 1
- **Observed alert:** CAN ID `0x123` sent 20 messages within 2 seconds.
- **Result:** The detector successfully generated an alert for simulated high-frequency traffic.

## Test Procedure

1. Generated simulated CAN messages on the virtual CAN interface.
2. Recorded traffic with timestamps in the CSV log.
3. Ran the detection script against the recorded log.
4. Checked the alert output and detection summary.

## Limitations

- This is a basic rule-based demonstration using simulated CAN traffic.
- The threshold is a demonstration setting and is not validated for real automotive systems.
- The test does not establish detection accuracy against a labelled dataset of normal and malicious traffic.
- Machine-learning detection and dashboard integration require separate implementation and testing.

## Conclusion

The initial test demonstrates that the rule-based detector can identify high-frequency CAN traffic in the recorded simulation log. Further testing is required before evaluating overall detection performance.
