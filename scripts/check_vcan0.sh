#!/usr/bin/env bash
# ==============================================================================
# Project CAN-Sentinel: Week 1 - Member 1 Deliverable
# File: scripts/check_vcan0.sh
# Description: Non-destructive health check and diagnostics for SocketCAN (vcan0)
# ==============================================================================

INTERFACE_NAME="${1:-vcan0}"

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}=== CAN-Sentinel: Member 1 Diagnostic Health Check ===${NC}"
echo "Checking interface: ${INTERFACE_NAME}"

# 1. Check if interface exists in kernel sysfs
if [ ! -d "/sys/class/net/${INTERFACE_NAME}" ]; then
    echo -e "${RED}[FAIL]${NC} Interface '${INTERFACE_NAME}' does not exist!"
    echo "Run 'sudo ./setup_vcan0.sh' to initialize it."
    exit 1
fi
echo -e "${GREEN}[PASS]${NC} Interface '${INTERFACE_NAME}' is registered in kernel sysfs."

# 2. Check operstate and flags
OPER_STATE=$(cat "/sys/class/net/${INTERFACE_NAME}/operstate" 2>/dev/null || echo "unknown")
MTU=$(cat "/sys/class/net/${INTERFACE_NAME}/mtu" 2>/dev/null || echo "0")
TX_PACKETS=$(cat "/sys/class/net/${INTERFACE_NAME}/statistics/tx_packets" 2>/dev/null || echo "0")
RX_PACKETS=$(cat "/sys/class/net/${INTERFACE_NAME}/statistics/rx_packets" 2>/dev/null || echo "0")
DROPPED=$(cat "/sys/class/net/${INTERFACE_NAME}/statistics/tx_dropped" 2>/dev/null || echo "0")

echo -e "  - Operational State : ${BOLD}${OPER_STATE}${NC}"
echo -e "  - Configured MTU    : ${BOLD}${MTU}${NC} (16 = Classic CAN, 72 = CAN-FD)"
echo -e "  - TX Packets        : ${TX_PACKETS}"
echo -e "  - RX Packets        : ${RX_PACKETS}"
echo -e "  - Dropped Packets   : ${DROPPED}"

# 3. Check can-utils installed
echo ""
echo "Tooling availability for team members:"
for bin in candump cansend cangen canplayer; do
    if command -v "$bin" &>/dev/null; then
        echo -e "  - $bin: ${GREEN}Installed ($(which $bin))${NC}"
    else
        echo -e "  - $bin: ${YELLOW}Not installed (sudo apt install can-utils)${NC}"
    fi
done

echo ""
echo -e "${GREEN}[READY]${NC} vcan0 is operational for Member 2 (Steering/RPM C scripts) & Member 4 (Python capture)!"
