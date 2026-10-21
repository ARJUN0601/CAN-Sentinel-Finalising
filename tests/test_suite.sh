#!/usr/bin/env bash
# CAN-Sentinel integration tests: Member 1 + Member 2

set -uo pipefail

INTERFACE="${1:-vcan0}"
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TEMP_FILES=()

pass() {
    printf '[PASS] %s\n' "$1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    printf '[FAIL] %s\n' "$1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

skip() {
    printf '[SKIP] %s\n' "$1"
    SKIP_COUNT=$((SKIP_COUNT + 1))
}

cleanup() {
    for file in "${TEMP_FILES[@]}"; do
        rm -f "$file"
    done
}
trap cleanup EXIT

echo "=== CAN-Sentinel Integration Tests ==="
echo "Interface: $INTERFACE"
echo

# Member 1: interface and can-utils checks
if ip link show "$INTERFACE" >/dev/null 2>&1; then
    pass "Interface $INTERFACE exists"
else
    fail "Interface $INTERFACE does not exist"
fi

if ip link show "$INTERFACE" 2>/dev/null | grep -q '<[^>]*UP'; then
    pass "Interface $INTERFACE is UP"
else
    fail "Interface $INTERFACE is DOWN or unavailable"
fi

if command -v cansend >/dev/null 2>&1 &&
   command -v candump >/dev/null 2>&1; then
    pass "can-utils is installed"

    log=$(mktemp)
    TEMP_FILES+=("$log")
    timeout 2s candump -n 1 "$INTERFACE" >"$log" 2>&1 &
    dump_pid=$!
    sleep 0.2

    if cansend "$INTERFACE" 120#0102030405060708; then
        :
    else
        fail "Could not transmit the loopback test frame"
    fi

    wait "$dump_pid" || true

    if grep -Eiq '120[[:space:]]+\[8\][[:space:]]+01 02 03 04 05 06 07 08' "$log"; then
        pass "Generic loopback frame received correctly"
    else
        fail "Generic loopback frame not captured correctly"
    fi
else
    skip "can-utils missing; live CAN tests cannot run"
fi

# Member 2: verify actual ECU transmissions
test_ecu() {
    local name="$1" binary="$2" argument="$3"
    local can_id="$4" dlc="$5" expected="$6"
    local log capture pid

    if [[ ! -x "$binary" ]]; then
        fail "$name binary missing; run make"
        return
    fi

    if ! command -v candump >/dev/null 2>&1; then
        skip "$name requires candump"
        return
    fi

    log=$(mktemp)
    capture=$(mktemp)
    TEMP_FILES+=("$log" "$capture")

    "$binary" "$INTERFACE" "$argument" >"$log" 2>&1 &
    pid=$!
    sleep 0.2

    if ! kill -0 "$pid" 2>/dev/null; then
        fail "$name failed to start"
        return
    fi

    timeout 2s candump -n 1 "$INTERFACE,$can_id:7FF" >"$capture" 2>&1 || true
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true

    if grep -Eiq "$can_id[[:space:]]+\[$dlc\][[:space:]]+$expected" "$capture"; then
        pass "$name sends expected CAN ID and payload"
    else
        fail "$name did not send expected payload"
        echo "Captured frame:"
        cat "$capture"
        echo "ECU log:"
        head -n 5 "$log"
    fi
}

echo
echo "=== Member 2 ECU Tests ==="
test_ecu "Steering ECU (45 degrees)" "./bin/steering_ecu" "45" "120" "4" "00 00 34 42"
test_ecu "RPM ECU (3000 RPM)" "./bin/rpm_ecu" "3000" "130" "2" "B8 0B"

echo
echo "=== Summary: $PASS_COUNT Passed, $FAIL_COUNT Failed, $SKIP_COUNT Skipped ==="

if [[ "$FAIL_COUNT" -eq 0 && "$SKIP_COUNT" -eq 0 ]]; then
    echo "All integration tests passed."
    exit 0
    else
        echo "Integration tests failed or were skipped."
        exit 1
        fi
