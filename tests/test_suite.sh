#!/usr/bin/env bash
# ==============================================================================
# Project CAN-Sentinel: Week 1 - Member 1 Deliverable
# File: tests/test_suite.sh
# Description: Automated test harness verifying end-to-end CAN communication
# ==============================================================================

set -euo pipefail

INTERFACE="${1:-vcan0}"
PASS_COUNT=0
FAIL_COUNT=0

pass() {
    echo -e "\033[0;32m[PASS]\033[0m $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo -e "\033[0;31m[FAIL]\033[0m $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

echo "=== Running CAN-Sentinel Member 1 Integration Tests ==="

# Test 1: Interface Existence
if ip link show "$INTERFACE" &>/dev/null; then
    pass "Interface $INTERFACE exists"
else
    fail "Interface $INTERFACE does not exist (run sudo ./scripts/setup_vcan0.sh first)"
fi

# Test 2: Interface is UP
if ip link show "$INTERFACE" | grep -q "UP"; then
    pass "Interface $INTERFACE is UP"
else
    fail "Interface $INTERFACE is DOWN"
fi

# Test 3: can-utils compatibility check
if command -v cansend &>/dev/null && command -v candump &>/dev/null; then
    pass "can-utils (cansend, candump) is installed"
    
    # Test 4: Transmit & Receive loopback
    TEMP_LOG=$(mktemp)
    # Start background capture with 1 frame limit
    timeout 2 candump -n 1 "$INTERFACE" > "$TEMP_LOG" &
    DUMP_PID=$!
    sleep 0.1

    # Send mock ECU frame (Member 2 Steering ID 0x120)
    cansend "$INTERFACE" 120#0102030405060708

    wait "$DUMP_PID" || true

    if grep -q "120" "$TEMP_LOG"; then
        pass "Loopback capture confirmed frame ID 0x120"
    else
        fail "Failed to capture loopback frame on $INTERFACE"
    fi
    rm -f "$TEMP_LOG"
else
    echo -e "\033[1;33m[SKIP]\033[0m can-utils not installed; skipping live loopback transmission test"
fi

echo ""
echo "=== Summary: ${PASS_COUNT} Passed, ${FAIL_COUNT} Failed ==="
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "\033[0;32mAll Member 1 deliverables validated successfully!\033[0m"
    exit 0
else
    echo -e "\033[0;31mSome tests failed. Check setup script output.\033[0m"
    exit 1
fi
