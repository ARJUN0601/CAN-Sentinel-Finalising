#!/usr/bin/env bash
set -euo pipefail

INTERFACE="${1:-vcan0}"
PASS=0
FAIL=0

run_test() {
    local description="$1"
    shift

    if "$@"; then
        echo "[PASS] $description"
        PASS=$((PASS + 1))
    else
        echo "[FAIL] $description"
        FAIL=$((FAIL + 1))
    fi
}

echo "CAN-Sentinel Test Suite"
echo "Interface: $INTERFACE"
echo

if ! ip link show "$INTERFACE" >/dev/null 2>&1; then
    echo "ERROR: Interface '$INTERFACE' does not exist."
    echo "Run: make setup"
    exit 1
fi

if ! ip link show "$INTERFACE" | grep -q "UP"; then
    echo "ERROR: Interface '$INTERFACE' is not UP."
    echo "Run: make setup"
    exit 1
fi

echo "[INFO] Checking required binaries..."

for program in \
    bin/vcan_checker \
    bin/steering_ecu \
    bin/rpm_ecu \
    bin/speed_ecu \
    bin/temperature_ecu \
    bin/speed_ecu_week2 \
    bin/temperature_ecu_week2
do
    if [[ -x "$program" ]]; then
        echo "[PASS] $program exists and is executable"
        PASS=$((PASS + 1))
    else
        echo "[FAIL] $program is missing or not executable"
        FAIL=$((FAIL + 1))
    fi
done

echo
echo "[INFO] Checking ECU input validation..."

run_test "Steering ECU rejects an out-of-range angle" \
    bash -c '"$1" "$2" 999 >/dev/null 2>&1; test $? -ne 0' _ \
    "$(pwd)/bin/steering_ecu" "$INTERFACE"

run_test "RPM ECU rejects an out-of-range value" \
    bash -c '"$1" "$2" 9000 >/dev/null 2>&1; test $? -ne 0' _ \
    "$(pwd)/bin/rpm_ecu" "$INTERFACE"

run_test "Speed ECU rejects a negative value" \
    bash -c '"$1" "$2" -1 >/dev/null 2>&1; test $? -ne 0' _ \
    "$(pwd)/bin/speed_ecu" "$INTERFACE"

run_test "Temperature ECU rejects an out-of-range value" \
    bash -c '"$1" "$2" 200 >/dev/null 2>&1; test $? -ne 0' _ \
    "$(pwd)/bin/temperature_ecu" "$INTERFACE"

echo
echo "=============================="
echo "Tests passed: $PASS"
echo "Tests failed: $FAIL"
echo "=============================="

if (( FAIL > 0 )); then
    exit 1
fi

exit 0
