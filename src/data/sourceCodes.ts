export interface CodeFile {
  id: string;
  filename: string;
  path: string;
  language: string;
  role: string;
  description: string;
  content: string;
}

export const CODE_FILES: CodeFile[] = [
  {
    id: 'can_packet_h',
    filename: 'can_packet.h',
    path: 'c_client/can_packet.h',
    language: 'c',
    role: 'Member 1 (Low-Level Systems / C)',
    description: 'Byte-aligned (#pragma pack(1)) 21-byte binary wire struct definition matching Python struct unpack format <QIB8s.',
    content: `/**
 * @file can_packet.h
 * @brief Byte-aligned binary protocol packet definition for CAN-Sentinel IPC.
 *
 * Project: CAN-Sentinel (Automotive IDS / ML Pipeline)
 * Author: Member 1 (Low-Level Systems & Embedded C Engineer)
 * Target: Linux SocketCAN to Unix Domain Socket (UDS) streaming client
 *
 * Python struct equivalent:
 *   Format: "<QIB8s" (Little-Endian, uint64, uint32, uint8, 8-byte char[])
 *   Total Size: 21 bytes (Zero compiler padding holes, #pragma pack(1))
 */

#ifndef CAN_PACKET_H
#define CAN_PACKET_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define DEFAULT_UDS_PATH "/tmp/can_sentinel.sock"
#define DEFAULT_CAN_IFACE "vcan0"

#define CAN_MAX_DLC         8
#define CAN_PACKET_PAYLOAD  8

#define CAN_PACKET_EFF_FLAG 0x80000000U /* Bit 31: Extended Frame */
#define CAN_PACKET_RTR_FLAG 0x40000000U /* Bit 30: Remote Transmission Request */
#define CAN_PACKET_ERR_FLAG 0x20000000U /* Bit 29: Error frame */

#define CAN_PACKET_SFF_MASK 0x000007FFU /* Standard frame ID mask (11 bits) */
#define CAN_PACKET_EFF_MASK 0x1FFFFFFFU /* Extended frame ID mask (29 bits) */

#pragma pack(push, 1)
/**
 * @struct can_uds_packet_t
 * @brief High-density byte-aligned packet streamed across the Unix Domain Socket.
 *
 * Total Size: Exactly 21 Bytes (Zero compiler padding holes)
 */
typedef struct __attribute__((packed)) {
    uint64_t timestamp_us;            /**< Monotonic microsecond timestamp: (sec * 1e6) + (nsec / 1e3) */
    uint32_t can_id;                  /**< 32-bit CAN Identifier (Includes EFF/RTR/ERR bit flags)      */
    uint8_t  dlc;                     /**< Data Length Code: 0 to 8                                   */
    uint8_t  data[CAN_PACKET_PAYLOAD];/**< Raw 8-byte CAN payload (zero-padded if dlc < 8)   */
} can_uds_packet_t;
#pragma pack(pop)

#if defined(__STDC_VERSION__) && (__STDC_VERSION__ >= 201112L)
_Static_assert(sizeof(can_uds_packet_t) == 21, "CRITICAL: can_uds_packet_t must be exactly 21 bytes!");
#endif

#define CAN_UDS_PACKET_SIZE sizeof(can_uds_packet_t)

#ifdef __cplusplus
}
#endif

#endif /* CAN_PACKET_H */`
  },
  {
    id: 'can_uds_forwarder_c',
    filename: 'can_uds_forwarder.c',
    path: 'c_client/can_uds_forwarder.c',
    language: 'c',
    role: 'Member 1 (Low-Level Systems / C)',
    description: 'Production C forwarder with SocketCAN binding, SO_RCVBUF tuning, zero-allocation hot loop, monotonic clock, and auto-reconnecting UDS client.',
    content: `/**
 * @file can_uds_forwarder.c
 * @brief High-performance SocketCAN to Unix Domain Socket (UDS) forwarding client.
 *
 * Project: CAN-Sentinel (Automotive IDS & ML Threat Detection)
 * Component: Member 1 (Low-Level Systems & Embedded C Engineering)
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <unistd.h>
#include <errno.h>
#include <signal.h>
#include <time.h>
#include <getopt.h>

#include <sys/types.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <sys/un.h>
#include <net/if.h>

/* Linux SocketCAN headers */
#include <linux/can.h>
#include <linux/can/raw.h>

#include "can_packet.h"

typedef struct {
    char can_iface[IFNAMSIZ];
    char uds_path[sizeof(((struct sockaddr_un *)0)->sun_path)];
    int  rcvbuf_kb;
    bool verbose;
} config_t;

static volatile sig_atomic_t g_running = 1;

typedef struct {
    uint64_t frames_received;
    uint64_t frames_forwarded;
    uint64_t frames_dropped_uds;
    uint64_t reconnect_attempts;
    uint64_t bytes_transmitted;
} stats_t;

static stats_t g_stats = {0};

static void handle_signal(int sig) {
    (void)sig;
    g_running = 0;
}

static void setup_signal_traps(void) {
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = handle_signal;
    sigemptyset(&sa.sa_mask);

    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    /*
     * Ignore SIGPIPE: Ensures send() returns -1 with EPIPE instead of
     * terminating the process when the downstream Python server restarts.
     */
    signal(SIGPIPE, SIG_IGN);
}

static inline uint64_t get_monotonic_timestamp_us(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ((uint64_t)ts.tv_sec * 1000000ULL) + ((uint64_t)ts.tv_nsec / 1000ULL);
}

static int open_socketcan(const char *iface_name, int rcvbuf_kb) {
    int s;
    struct sockaddr_can addr;
    struct ifreq ifr;

    s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0) {
        perror("[ERROR] socket(PF_CAN) failed");
        return -1;
    }

    memset(&ifr, 0, sizeof(ifr));
    strncpy(ifr.ifr_name, iface_name, IFNAMSIZ - 1);
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0) {
        fprintf(stderr, "[ERROR] Interface '%s' not found: %s\\n", iface_name, strerror(errno));
        close(s);
        return -1;
    }

    if (rcvbuf_kb > 0) {
        int bufsize = rcvbuf_kb * 1024;
        setsockopt(s, SOL_SOCKET, SO_RCVBUF, &bufsize, sizeof(bufsize));
    }

    memset(&addr, 0, sizeof(addr));
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;

    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("[ERROR] bind(AF_CAN) failed");
        close(s);
        return -1;
    }

    printf("[CAN] Bound to '%s' (ifindex: %d, RCVBUF: %d KB)\\n", iface_name, ifr.ifr_ifindex, rcvbuf_kb);
    return s;
}

static int connect_to_uds(const char *uds_path) {
    int uds_fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (uds_fd < 0) return -1;

    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, uds_path, sizeof(addr.sun_path) - 1);

    if (connect(uds_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        close(uds_fd);
        return -1;
    }
    return uds_fd;
}

static bool send_all(int fd, const void *buf, size_t total_bytes) {
    size_t sent = 0;
    const uint8_t *ptr = (const uint8_t *)buf;

    while (sent < total_bytes && g_running) {
        ssize_t n = send(fd, ptr + sent, total_bytes - sent, MSG_NOSIGNAL);
        if (n > 0) {
            sent += (size_t)n;
        } else if (n < 0) {
            if (errno == EINTR) continue;
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                usleep(100);
                continue;
            }
            return false;
        } else {
            return false;
        }
    }
    return (sent == total_bytes);
}

int main(int argc, char *argv[]) {
    config_t config;
    memset(&config, 0, sizeof(config));
    strncpy(config.can_iface, DEFAULT_CAN_IFACE, IFNAMSIZ - 1);
    strncpy(config.uds_path, DEFAULT_UDS_PATH, sizeof(config.uds_path) - 1);
    config.rcvbuf_kb = 512;

    int opt;
    while ((opt = getopt(argc, argv, "i:s:b:vh")) != -1) {
        switch (opt) {
            case 'i': strncpy(config.can_iface, optarg, IFNAMSIZ - 1); break;
            case 's': strncpy(config.uds_path, optarg, sizeof(config.uds_path) - 1); break;
            case 'b': config.rcvbuf_kb = atoi(optarg); break;
            case 'v': config.verbose = true; break;
            case 'h':
            default:
                printf("Usage: %s [-i iface] [-s uds_path] [-b rcvbuf_kb] [-v]\\n", argv[0]);
                return 0;
        }
    }

    setup_signal_traps();

    int can_fd = open_socketcan(config.can_iface, config.rcvbuf_kb);
    if (can_fd < 0) return EXIT_FAILURE;

    int uds_fd = -1;
    time_t last_reconnect = 0;

    /* Hot Loop: Stack-allocated frame & packet (ZERO HEAP MALLOC) */
    struct can_frame frame;
    can_uds_packet_t packet;

    while (g_running) {
        if (uds_fd < 0) {
            time_t now = time(NULL);
            if (now - last_reconnect >= 1) {
                last_reconnect = now;
                g_stats.reconnect_attempts++;
                uds_fd = connect_to_uds(config.uds_path);
                if (uds_fd >= 0) {
                    printf("[UDS] Connected to Python receiver at '%s'\\n", config.uds_path);
                }
            }
        }

        ssize_t nbytes = read(can_fd, &frame, sizeof(struct can_frame));
        if (nbytes < 0) {
            if (errno == EINTR) continue;
            break;
        }

        g_stats.frames_received++;

        packet.timestamp_us = get_monotonic_timestamp_us();
        packet.can_id       = frame.can_id;
        packet.dlc          = (frame.can_dlc > CAN_MAX_DLC) ? CAN_MAX_DLC : frame.can_dlc;

        memset(packet.data, 0, CAN_PACKET_PAYLOAD);
        if (packet.dlc > 0) {
            memcpy(packet.data, frame.data, packet.dlc);
        }

        if (uds_fd >= 0) {
            if (send_all(uds_fd, &packet, CAN_UDS_PACKET_SIZE)) {
                g_stats.frames_forwarded++;
                g_stats.bytes_transmitted += CAN_UDS_PACKET_SIZE;
            } else {
                printf("[UDS] Connection lost. Triggering auto-reconnect.\\n");
                close(uds_fd);
                uds_fd = -1;
                g_stats.frames_dropped_uds++;
            }
        } else {
            g_stats.frames_dropped_uds++;
        }

        if (config.verbose) {
            printf("[FRAME] ID: 0x%03X [%u] TS: %lu us\\n",
                   packet.can_id & CAN_PACKET_EFF_MASK, packet.dlc, (unsigned long)packet.timestamp_us);
        }
    }

    if (uds_fd >= 0) close(uds_fd);
    if (can_fd >= 0) close(can_fd);

    printf("\\n[SHUTDOWN] Frames Read: %lu, Forwarded: %lu, Bytes: %lu\\n",
           (unsigned long)g_stats.frames_received,
           (unsigned long)g_stats.frames_forwarded,
           (unsigned long)g_stats.bytes_transmitted);

    return EXIT_SUCCESS;
}`
  },
  {
    id: 'makefile',
    filename: 'Makefile',
    path: 'c_client/Makefile',
    language: 'makefile',
    role: 'Member 1 (Low-Level Systems / C)',
    description: 'GCC Makefile configured with -O3 optimization, -Wall -Wextra -pthread -pedantic -std=gnu11, debug and install targets.',
    content: `# ==============================================================================
# Makefile: CAN-Sentinel SocketCAN to UDS Forwarder
# Project: CAN-Sentinel (Automotive Cybersecurity IDS - Week 3 Sprint)
# Author: Member 1 (Low-Level Systems & Embedded C Engineer)
# ==============================================================================

CC ?= gcc
CFLAGS ?= -O3 -Wall -Wextra -pedantic -std=gnu11 -pthread -D_GNU_SOURCE
CFLAGS_DEBUG ?= -g3 -O0 -Wall -Wextra -pedantic -std=gnu11 -pthread -D_GNU_SOURCE -DDEBUG
LDFLAGS ?=

TARGET = can_uds_forwarder
SRCS = can_uds_forwarder.c
OBJS = $(SRCS:.c=.o)
HEADERS = can_packet.h

PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin

.PHONY: all debug clean install uninstall check help test-env

all: $(TARGET)

$(TARGET): $(OBJS)
	@echo "[LD] Linking $@"
	$(CC) $(OBJS) $(LDFLAGS) -o $@
	@echo "Build complete: ./$(TARGET)"

%.o: %.c $(HEADERS)
	@echo "[CC] Compiling $<"
	$(CC) $(CFLAGS) -c $< -o $@

debug: CFLAGS = $(CFLAGS_DEBUG)
debug: clean $(TARGET)

clean:
	rm -f $(OBJS) $(TARGET)

check:
	$(CC) $(CFLAGS) -fsyntax-only $(SRCS)

install: $(TARGET)
	install -d $(DESTDIR)$(BINDIR)
	install -m 755 $(TARGET) $(DESTDIR)$(BINDIR)/$(TARGET)

help:
	@echo "Targets: all, debug, clean, check, install"`
  },
  {
    id: 'uds_receiver_py',
    filename: 'uds_receiver.py',
    path: 'python_receiver/uds_receiver.py',
    language: 'python',
    role: 'Member 2 (Python ML Ingestion Engine)',
    description: 'Python UDS stream server unpacking 21-byte packets via struct.unpack("<QIB8s"), computing throughput/latency, and yielding frames for ML models.',
    content: `#!/usr/bin/env python3
"""
uds_receiver.py - CAN-Sentinel Downstream ML Ingestion Listener
Role: Member 2 (Python ML Ingestion & Anomaly Detection Interface)
Hand-off from: Member 1 (Low-Level Systems & Embedded C Engineer)
"""

import os
import sys
import time
import socket
import struct
import signal
import argparse
from typing import Generator, Optional

PACKET_FORMAT = "<QIB8s"
PACKET_SIZE = struct.calcsize(PACKET_FORMAT)  # 21 bytes
DEFAULT_SOCKET_PATH = "/tmp/can_sentinel.sock"

CAN_EFF_FLAG = 0x80000000
CAN_RTR_FLAG = 0x40000000
CAN_ERR_FLAG = 0x20000000
CAN_SFF_MASK = 0x000007FF
CAN_EFF_MASK = 0x1FFFFFFF

class CanPacket:
    __slots__ = ('timestamp_us', 'raw_can_id', 'can_id', 'is_extended',
                 'is_rtr', 'is_error', 'dlc', 'payload')

    def __init__(self, timestamp_us: int, raw_can_id: int, dlc: int, raw_payload: bytes):
        self.timestamp_us = timestamp_us
        self.raw_can_id = raw_can_id
        self.is_extended = bool(raw_can_id & CAN_EFF_FLAG)
        self.is_rtr = bool(raw_can_id & CAN_RTR_FLAG)
        self.is_error = bool(raw_can_id & CAN_ERR_FLAG)
        mask = CAN_EFF_MASK if self.is_extended else CAN_SFF_MASK
        self.can_id = raw_can_id & mask
        self.dlc = min(dlc, 8)
        self.payload = raw_payload[:self.dlc]

    def hex_payload(self) -> str:
        return self.payload.hex().upper()

def read_exact(sock: socket.socket, num_bytes: int) -> Optional[bytes]:
    buf = bytearray()
    while len(buf) < num_bytes:
        chunk = sock.recv(num_bytes - len(buf))
        if not chunk:
            return None
        buf.extend(chunk)
    return bytes(buf)

def stream_can_packets(sock_path: str = DEFAULT_SOCKET_PATH) -> Generator[CanPacket, None, None]:
    if os.path.exists(sock_path):
        os.unlink(sock_path)

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(sock_path)
    server.listen(1)
    print(f"[ML-INGEST] Listening on UDS: {sock_path}")

    try:
        while True:
            conn, _ = server.accept()
            print("[ML-INGEST] C Client connected! Ingesting binary stream...")
            try:
                while True:
                    raw_data = read_exact(conn, PACKET_SIZE)
                    if raw_data is None:
                        break
                    ts_us, raw_id, dlc, raw_payload = struct.unpack(PACKET_FORMAT, raw_data)
                    yield CanPacket(ts_us, raw_id, dlc, raw_payload)
            finally:
                conn.close()
    finally:
        server.close()
        if os.path.exists(sock_path):
            os.unlink(sock_path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-s", "--socket", default=DEFAULT_SOCKET_PATH)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    total_frames = 0
    start_time = time.time()
    last_print = start_time

    for packet in stream_can_packets(args.socket):
        total_frames += 1
        if args.verbose:
            print(f"[RECV] ID: 0x{packet.can_id:03X} DLC:{packet.dlc} DATA:{packet.hex_payload()} TS:{packet.timestamp_us}us")

        now = time.time()
        if now - last_print >= 1.0:
            elapsed = now - start_time
            print(f"[STATS] Total frames: {total_frames:,} | Rate: {total_frames / elapsed:,.1f} fps")
            last_print = now

if __name__ == "__main__":
    main()`
  },
  {
    id: 'setup_vcan_sh',
    filename: 'setup_vcan.sh',
    path: 'scripts/setup_vcan.sh',
    language: 'bash',
    role: 'DevOps & Test Harness',
    description: 'Bash automation to load the vcan kernel module, create virtual device vcan0, and configure interface link up.',
    content: `#!/usr/bin/env bash
set -euo pipefail

INTERFACE="vcan0"

if [[ $EUID -ne 0 ]]; then
   echo "[ERROR] This script must be run as root (use: sudo ./scripts/setup_vcan.sh)"
   exit 1
fi

echo "[1/3] Loading Linux kernel 'vcan' module..."
modprobe vcan

echo "[2/3] Initializing network device '\${INTERFACE}'..."
ip link add dev "\${INTERFACE}" type vcan 2>/dev/null || true
ip link set up "\${INTERFACE}"

echo "[3/3] Interface '\${INTERFACE}' is UP and READY for CAN-Sentinel."
ip -details link show "\${INTERFACE}"`
  },
  {
    id: 'benchmark_sh',
    filename: 'benchmark.sh',
    path: 'scripts/benchmark.sh',
    language: 'bash',
    role: 'Performance Benchmarking',
    description: 'Traffic injection and throughput benchmarking harness using cangen with zero inter-frame gap.',
    content: `#!/usr/bin/env bash
set -euo pipefail

INTERFACE="\${1:-vcan0}"
COUNT="\${2:-50000}"
GAP_MS="\${3:-0}"

echo "=================================================================="
echo " CAN-Sentinel Benchmark & Flood Injector"
echo " Interface: \${INTERFACE} | Frames: \${COUNT} | Gap: \${GAP_MS}ms"
echo "=================================================================="

cangen "\${INTERFACE}" -n "\${COUNT}" -g "\${GAP_MS}" -e -D i -v`
  }
];
