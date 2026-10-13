#!/usr/bin/env bash
# ==============================================================================
# Project CAN-Sentinel: Week 1 - Member 1 Deliverable
# File: scripts/setup_vcan0.sh
# Description: Automated configuration and bring-up script for Linux SocketCAN (vcan0)
# Target Architecture: Linux x86_64 / aarch64 (Ubuntu, Debian, Kali, Raspberry Pi OS)
# License: MIT
# ==============================================================================

set -euo pipefail

# ANSI Color Codes for terminal diagnostics
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

INTERFACE_NAME="${1:-vcan0}"
ENABLE_CANFD="${2:-false}"
TXQUEUELEN=1000

log_info() {
    echo -e "${CYAN}[CAN-SENTINEL INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[CAN-SENTINEL SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[CAN-SENTINEL WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[CAN-SENTINEL ERROR]${NC} $1" >&2
}

# 1. Verify root / sudo privileges
verify_privileges() {
    if [[ "$EUID" -ne 0 ]]; then
        log_error "This script requires root privileges to configure network interfaces."
        echo -e "Please execute with sudo: ${BOLD}sudo $0 [interface_name] [enable_canfd]${NC}"
        exit 1
    fi
    log_info "Root permissions verified."
}

# 2. Check for required kernel and tooling dependencies
check_dependencies() {
    log_info "Checking required Linux networking utilities..."
    
    local missing_tools=()
    for tool in ip modprobe lsmod; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required utilities: ${missing_tools[*]}"
        log_error "Install iproute2 and kmod packages using: apt-get install iproute2 kmod"
        exit 1
    fi

    # Optional check for can-utils (candump, cansend)
    if ! command -v cansend &> /dev/null || ! command -v candump &> /dev/null; then
        log_warn "can-utils is not detected. Recommended for Member 2-5 testing."
        log_warn "Install via: sudo apt-get update && sudo apt-get install -y can-utils"
    else
        log_info "can-utils detected on system."
    fi
}

# 3. Load Linux Kernel CAN Modules
load_kernel_modules() {
    log_info "Loading Linux SocketCAN kernel modules (can, vcan)..."
    
    # Load generic CAN subsystem
    if ! modprobe can; then
        log_error "Failed to load 'can' kernel module. Verify kernel CAN support."
        exit 1
    fi

    # Load Virtual CAN (vcan) driver
    if ! modprobe vcan; then
        log_error "Failed to load 'vcan' kernel module. Please check /lib/modules/$(uname -r)/."
        exit 1
    fi

    # Confirm loaded modules
    if lsmod | grep -q "^vcan"; then
        log_success "Kernel module 'vcan' is actively loaded."
    else
        log_error "'vcan' module was not found in active module list."
        exit 1
    fi
}

# 4. Create and Configure SocketCAN Virtual Interface
configure_interface() {
    log_info "Configuring interface '${INTERFACE_NAME}'..."

    # Check if interface already exists
    if ip link show "${INTERFACE_NAME}" &> /dev/null; then
        log_warn "Interface '${INTERFACE_NAME}' already exists. Resetting state..."
        ip link set down "${INTERFACE_NAME}" 2>/dev/null || true
        ip link delete "${INTERFACE_NAME}" 2>/dev/null || true
    fi

    # Add virtual CAN interface
    log_info "Creating '${INTERFACE_NAME}' of type 'vcan'..."
    ip link add dev "${INTERFACE_NAME}" type vcan

    # Optional CAN-FD (Flexible Data-rate) MTU configuration
    if [[ "${ENABLE_CANFD}" == "true" ]]; then
        log_info "Enabling CAN-FD (MTU 72) on ${INTERFACE_NAME}..."
        ip link set "${INTERFACE_NAME}" mtu 72
    else
        # Standard Classic CAN 2.0A/B MTU is 16 bytes
        ip link set "${INTERFACE_NAME}" mtu 16
    fi

    # Configure transmit queue length to prevent frame drops under heavy ECU simulation
    ip link set "${INTERFACE_NAME}" txqueuelen "${TXQUEUELEN}"

    # Bring the virtual CAN link UP
    log_info "Bringing interface '${INTERFACE_NAME}' UP..."
    ip link set up "${INTERFACE_NAME}"

    log_success "Interface '${INTERFACE_NAME}' brought UP successfully."
}

# 5. Verify Operational Status and Print Deliverable Evidence
verify_operational() {
    log_info "Verifying operational link state..."

    # Check link flags
    local if_info
    if_info=$(ip -details link show "${INTERFACE_NAME}")

    if echo "$if_info" | grep -q "UP"; then
        log_success "=========================================================="
        log_success " MEMBER 1 DELIVERABLE: OPERATIONAL ${INTERFACE_NAME} CONFIRMED! "
        log_success "=========================================================="
        echo -e "${BOLD}Interface Details:${NC}"
        echo "$if_info"
        echo ""
        log_info "SocketCAN is now ready for Member 2 & 3 (C Mock ECUs) and Member 4 (Python Capture)!"
        echo -e "Quick test with can-utils:"
        echo -e "  Terminal A: ${BOLD}candump ${INTERFACE_NAME}${NC}"
        echo -e "  Terminal B: ${BOLD}cansend ${INTERFACE_NAME} 120#0102030405060708${NC}"
    else
        log_error "Interface '${INTERFACE_NAME}' exists but is NOT in UP state."
        exit 1
    fi
}

main() {
    echo -e "${BOLD}${CYAN}"
    echo "=========================================================="
    echo "   CAN-SENTINEL: MEMBER 1 LINUX SOCKETCAN SETUP SCRIPT    "
    echo "=========================================================="
    echo -e "${NC}"
    
    verify_privileges
    check_dependencies
    load_kernel_modules
    configure_interface
    verify_operational
}

main "$@"
