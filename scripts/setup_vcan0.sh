#!/usr/bin/env bash
set -euo pipefail

INTERFACE="${1:-vcan0}"

if [[ "$INTERFACE" =~ [^a-zA-Z0-9_.-] ]] || [[ ${#INTERFACE} -ge 16 ]]; then
    echo "Error: Invalid network interface name: $INTERFACE" >&2
    exit 1
fi

echo "Setting up virtual CAN interface: $INTERFACE"

if ! command -v ip >/dev/null 2>&1; then
    echo "Error: The 'ip' command is missing. Install iproute2 first." >&2
    exit 1
fi

if ! sudo modprobe vcan; then
    echo "Error: Could not load the vcan kernel module." >&2
    exit 1
fi

if ip link show "$INTERFACE" >/dev/null 2>&1; then
    echo "Interface $INTERFACE already exists."
else
    sudo ip link add dev "$INTERFACE" type vcan
fi

sudo ip link set "$INTERFACE" up

echo "Virtual CAN interface $INTERFACE is ready."
ip -details link show "$INTERFACE"
