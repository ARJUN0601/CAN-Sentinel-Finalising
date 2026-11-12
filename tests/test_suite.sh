#!/usr/bin/env bash

set -uo pipefail

# CAN-Sentinel integrated test suite
# Safety: all CAN operations are restricted to vcan0.

INTERFACE="${1:-vcan0}"
PASS=0
FAIL=0
SKIP=0
TEMP_FILES=()
PIDS=()

pass() {
    printf '[PASS] %s\n' "$1"
    PASS=$((PASS + 1))
}

fail() {
    printf '[FAIL] %s\n' "$1"
    FAIL=$((FAIL + 1))
}

skip() {
    printf '[SKIP] %s\n' "$1"
    SKIP=$((SKIP + 1))
}

cleanup() {
    local pid file

    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
        done

        for file in "${TEMP_FILES[@]}"; do
            rm -f -- "$file"
            done
}

trap cleanup EXIT INT TERM

echo "=================================="
echo " CAN-Sentinel Integration Tests"
echo "=================================="

# Safety validation before any CAN operation.
if [[ "$INTERFACE" != "vcan0" ]]; then
    echo "[ERROR] Only vcan0 is permitted."
    exit 1
    fi

    if ! command -v ip >/dev/null 2>&1; then
        echo "[ERROR] ip command is unavailable."
        exit 1
        fi

        if ! ip link show vcan0 >/dev/null 2>&1; then
            echo "[ERROR] vcan0 does not exist. Run make setup."
            exit 1
            fi

            if ! ip -o link show vcan0 | grep -q '<[^>]*UP'; then
                echo "[ERROR] vcan0 is not UP."
                exit 1
                fi

                pass "vcan0 exists and is UP"

                # Required binary checks.
                echo
                echo "=== Binary Availability ==="

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
                            pass "$program available"
                            else
                                fail "$program missing or not executable"
                                fi
                                done

                                # SocketCAN loopback verification.
                                echo
                                echo "=== SocketCAN Verification ==="

                                if [[ -x bin/vcan_checker ]]; then
                                    if bin/vcan_checker vcan0; then
                                        pass "SocketCAN loopback verification"
                                        else
                                            fail "SocketCAN loopback verification"
                                            fi
                                            else
                                                skip "vcan_checker unavailable"
                                                fi

                                                # ECU input validation.
                                                echo
                                                echo "=== ECU Input Validation ==="

                                                check_invalid_input() {
                                                    local name="$1"
                                                    local binary="$2"
                                                    local value="$3"

                                                    if [[ ! -x "$binary" ]]; then
                                                        skip "$name binary unavailable"
                                                        return
                                                        fi

                                                        if "$binary" vcan0 "$value" >/dev/null 2>&1; then
                                                            fail "$name accepted invalid input: $value"
                                                            else
                                                                pass "$name rejected invalid input: $value"
                                                                fi
                                                }

                                                check_invalid_input "Steering ECU" bin/steering_ecu 999
                                                check_invalid_input "RPM ECU" bin/rpm_ecu 9000
                                                check_invalid_input "Speed ECU" bin/speed_ecu -1
                                                check_invalid_input "Temperature ECU" bin/temperature_ecu 200

                                                # ECU transmission verification.
                                                echo
                                                echo "=== ECU Transmission Tests ==="

                                                test_ecu() {
                                                    local name="$1"
                                                    local binary="$2"
                                                    local argument="$3"
                                                    local can_id="$4"
                                                    local expected="$5"

                                                    local capture pid

                                                    if [[ ! -x "$binary" ]]; then
                                                        skip "$name binary unavailable"
                                                        return
                                                        fi

                                                        if ! command -v candump >/dev/null 2>&1; then
                                                            skip "$name requires can-utils"
                                                            return
                                                            fi

                                                            capture=$(mktemp) || {
                                                                fail "$name could not create capture file"
                                                                return
                                                            }

                                                            TEMP_FILES+=("$capture")

                                                            timeout 3s candump -n 1 "vcan0,${can_id}:7FF" \
                                                            >"$capture" 2>&1 &
                                                            pid=$!
                                                            PIDS+=("$pid")

                                                            sleep 0.2

                                                            "$binary" vcan0 "$argument" >/dev/null 2>&1 &
                                                            local ecu_pid=$!
                                                            PIDS+=("$ecu_pid")

                                                            wait "$pid" 2>/dev/null || true

                                                            kill "$ecu_pid" 2>/dev/null || true
                                                            wait "$ecu_pid" 2>/dev/null || true

                                                            if grep -Eiq "$can_id[[:space:]]+\[[0-9]+\][[:space:]]+$expected" "$capture"; then
                                                                pass "$name transmitted expected CAN payload"
                                                                else
                                                                    fail "$name did not transmit expected CAN payload"
                                                                    echo "Captured output:"
                                                                    cat "$capture"
                                                                    fi
                                                }

                                                if command -v candump >/dev/null 2>&1; then
                                                    test_ecu "Steering ECU (45 degrees)" \
                                                    bin/steering_ecu 45 120 "00 00 34 42"

                                                    test_ecu "RPM ECU (3000 RPM)" \
                                                    bin/rpm_ecu 3000 130 "B8 0B"
                                                    else
                                                        skip "ECU transmission tests require can-utils"
                                                        fi

                                                        # Final report.
                                                        echo
                                                        echo "=================================="
                                                        echo " Integration Test Summary"
                                                        echo "=================================="
                                                        echo "Passed : $PASS"
                                                        echo "Failed : $FAIL"
                                                        echo "Skipped: $SKIP"
                                                        echo "=================================="

                                                        if (( FAIL > 0 || SKIP > 0 )); then
                                                            echo "Integration tests incomplete or failed."
                                                            exit 1
                                                            fi

                                                            echo "All integration tests passed."
                                                            exit 0
