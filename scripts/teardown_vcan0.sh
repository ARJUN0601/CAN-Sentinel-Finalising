#!/usr/bin/env bash
# ==============================================================================
# Project CAN-Sentinel: Week 1 - Member 1 Deliverable
# File: scripts/teardown_vcan0.sh
# Description: Clean teardown and removal of SocketCAN vcan0 interface
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

INTERFACE_NAME="${1:-vcan0}"

if [[ "$EUID" -ne 0 ]]; then
    echo -e "${RED}[CAN-SENTINEL ERROR]${NC} Must run as root (sudo)." >&2
    exit 1
fi

echo -e "${CYAN}[CAN-SENTINEL INFO]${NC} Tearing down SocketCAN interface: ${INTERFACE_NAME}..."

if ip link show "${INTERFACE_NAME}" &> /dev/null; then
    # Bring link down
    ip link set down "${INTERFACE_NAME}" 2>/dev/null || true
    # Delete virtual network device
    ip link delete "${INTERFACE_NAME}"
    echo -e "${GREEN}[CAN-SENTINEL SUCCESS]${NC} Interface ${INTERFACE_NAME} deleted."
else
    echo -e "${CYAN}[CAN-SENTINEL INFO]${NC} Interface ${INTERFACE_NAME} was not active."
fi

# Optional: unload vcan module if no other vcan devices exist
if ! ip link show type vcan &>/dev/null; then
    if lsmod | grep -q "^vcan"; then
        echo -e "${CYAN}[CAN-SENTINEL INFO]${NC} Unloading kernel module 'vcan'..."
        modprobe -r vcan 2>/dev/null || true
        echo -e "${GREEN}[CAN-SENTINEL SUCCESS]${NC} Kernel module 'vcan' unloaded."
    fi
fi

echo -e "${GREEN}[CAN-SENTINEL SUCCESS]${NC} Teardown complete."
