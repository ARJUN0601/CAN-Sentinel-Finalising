#!/usr/bin/env bash
# CAN-Sentinel: Safe SocketCAN virtual interface setup

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

INTERFACE_NAME="${1:-vcan0}"
ENABLE_CANFD="${2:-false}"
TXQUEUELEN=1000

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }

verify_privileges() {
    if [[ "$EUID" -ne 0 ]]; then
        log_error "Root privileges required."
        echo "Run: sudo $0 [interface_name] [enable_canfd]"
        exit 1
    fi
}

validate_interface_name() {
    if [[ ! "$INTERFACE_NAME" =~ ^[a-zA-Z0-9_.-]{1,15}$ ]]; then
        log_error "Invalid interface name: $INTERFACE_NAME"
        exit 1
    fi

    if [[ "$ENABLE_CANFD" != "true" && "$ENABLE_CANFD" != "false" ]]; then
        log_error "CAN-FD option must be true or false."
        exit 1
    fi
}

check_dependencies() {
    local missing=()

    for tool in ip modprobe grep; do
        command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
    done

    if (( ${#missing[@]} > 0 )); then
        log_error "Missing utilities: ${missing[*]}"
        log_error "Install iproute2 and kmod."
        exit 1
    fi

    if ! command -v cansend >/dev/null 2>&1 ||
       ! command -v candump >/dev/null 2>&1; then
        log_warn "can-utils is missing. Install it for CAN testing."
    fi
}

load_kernel_modules() {
    log_info "Loading SocketCAN modules..."
    modprobe can
    modprobe vcan
    log_success "CAN and vcan modules loaded."
}

configure_interface() {
    if ip link show "$INTERFACE_NAME" >/dev/null 2>&1; then
        if ! ip -details link show "$INTERFACE_NAME" | grep -q "vcan"; then
            log_error "$INTERFACE_NAME exists but is not a vcan interface."
            log_error "Refusing to modify an existing non-vcan interface."
            exit 1
        fi

        log_info "Existing vcan interface found; reusing it."
        ip link set dev "$INTERFACE_NAME" down || true
    else
        log_info "Creating virtual CAN interface: $INTERFACE_NAME"
        ip link add dev "$INTERFACE_NAME" type vcan
    fi

    if [[ "$ENABLE_CANFD" == "true" ]]; then
        ip link set dev "$INTERFACE_NAME" mtu 72
    else
        ip link set dev "$INTERFACE_NAME" mtu 16
    fi

    ip link set dev "$INTERFACE_NAME" txqueuelen "$TXQUEUELEN"
    ip link set dev "$INTERFACE_NAME" up

    log_success "Interface $INTERFACE_NAME configured."
}

verify_operational() {
    if ! ip link show "$INTERFACE_NAME" | grep -q "UP"; then
        log_error "Interface is not UP."
        exit 1
    fi

    log_success "SocketCAN interface is operational."
    ip -details link show "$INTERFACE_NAME"

    echo
    echo "Test commands:"
    echo "  Terminal A: candump $INTERFACE_NAME"
    echo "  Terminal B: cansend $INTERFACE_NAME 120#0102030405060708"
}

main() {
    verify_privileges
    validate_interface_name
    check_dependencies
    load_kernel_modules
    configure_interface
    verify_operational
}

main "$@"
