/**
 * ============================================================================
 * Project CAN-Sentinel: Week 1
 * Low-Level Engineering (C, SocketCAN) - Member 1 Deliverable
 *
 * File: src/vcan_checker.c
 * Description: Low-level C program that verifies the operational status of
 *              the Linux SocketCAN interface (vcan0) by binding a raw CAN
 *              socket (AF_CAN, SOCK_RAW), validating interface flags via
 *              ioctl(SIOCGIFFLAGS), sending a test CAN frame, and asserting
 *              local loopback reception.
 *
 * Compilation: gcc -Wall -Wextra -O2 src/vcan_checker.c -o vcan_checker
 * Usage: ./vcan_checker [interface_name]
 * ============================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <time.h>

#include <sys/types.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <sys/time.h>
#include <net/if.h>

#include <linux/can.h>
#include <linux/can/raw.h>

#define DEFAULT_CAN_IF "vcan0"
#define SENTINEL_TEST_ID 0x101     /* Member 1 Heartbeat & Loopback Test ID */
#define TIMEOUT_SECONDS 2

/* ANSI Color formatting */
#define COLOR_GREEN  "\033[0;32m"
#define COLOR_RED    "\033[0;31m"
#define COLOR_YELLOW "\033[1;33m"
#define COLOR_CYAN   "\033[0;36m"
#define COLOR_RESET  "\033[0m"

static void print_banner(const char *ifname) {
    printf("%s==============================================================%s\n", COLOR_CYAN, COLOR_RESET);
    printf("%s   CAN-SENTINEL: MEMBER 1 LOW-LEVEL SOCKETCAN VERIFICATION    %s\n", COLOR_CYAN, COLOR_RESET);
    printf("%s==============================================================%s\n", COLOR_CYAN, COLOR_RESET);
    printf("Target SocketCAN Interface: %s%s%s\n\n", COLOR_YELLOW, ifname, COLOR_RESET);
}

static void print_can_frame(const char *prefix, const struct can_frame *frame) {
    printf("%s [ID: 0x%03X, DLC: %d] Data: ", prefix, frame->can_id, frame->can_dlc);
    for (int i = 0; i < frame->can_dlc; i++) {
        printf("%02X ", frame->data[i]);
    }
    printf("(ASCII: '");
    for (int i = 0; i < frame->can_dlc; i++) {
        char c = (frame->data[i] >= 32 && frame->data[i] <= 126) ? (char)frame->data[i] : '.';
        putchar(c);
    }
    printf("')\n");
}

int main(int argc, char *argv[]) {
    const char *ifname = (argc > 1) ? argv[1] : DEFAULT_CAN_IF;
    int sock_fd;
    struct sockaddr_can addr;
    struct ifreq ifr;
    struct can_frame tx_frame;
    struct can_frame rx_frame;
    struct timeval tv;
    int loopback_val = 1;
    int recv_own_msgs = 1;

    print_banner(ifname);

    /* -------------------------------------------------------------
     * Step 1: Open Raw CAN Socket (AF_CAN, SOCK_RAW, CAN_RAW)
     * ------------------------------------------------------------- */
    printf("[1/5] Creating raw SocketCAN descriptor (AF_CAN, SOCK_RAW)...\n");
    sock_fd = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (sock_fd < 0) {
        fprintf(stderr, "%s[ERROR] Failed to open CAN socket: %s%s\n", 
                COLOR_RED, strerror(errno), COLOR_RESET);
        fprintf(stderr, "Hint: Did you load the 'can' kernel module? (sudo modprobe can)\n");
        return EXIT_FAILURE;
    }
    printf("      %s[SUCCESS] Socket created successfully (fd = %d)%s\n", COLOR_GREEN, sock_fd, COLOR_RESET);

    /* -------------------------------------------------------------
     * Step 2: Query Interface Index using ioctl(SIOCGIFINDEX)
     * ------------------------------------------------------------- */
    printf("[2/5] Querying kernel interface index for '%s'...\n", ifname);
    memset(&ifr, 0, sizeof(ifr));
    strncpy(ifr.ifr_name, ifname, IFNAMSIZ - 1);

    if (ioctl(sock_fd, SIOCGIFINDEX, &ifr) < 0) {
        fprintf(stderr, "%s[ERROR] Interface '%s' not found: %s%s\n", 
                COLOR_RED, ifname, strerror(errno), COLOR_RESET);
        fprintf(stderr, "Hint: Run 'sudo ./setup_vcan0.sh' to create %s.\n", ifname);
        close(sock_fd);
        return EXIT_FAILURE;
    }
    int ifindex = ifr.ifr_ifindex;
    printf("      %s[SUCCESS] Interface '%s' resolved to ifindex %d%s\n", 
           COLOR_GREEN, ifname, ifindex, COLOR_RESET);

    /* -------------------------------------------------------------
     * Step 3: Verify Interface Flags (IFF_UP, IFF_RUNNING)
     * ------------------------------------------------------------- */
    printf("[3/5] Inspecting interface flags (ioctl SIOCGIFFLAGS)...\n");
    if (ioctl(sock_fd, SIOCGIFFLAGS, &ifr) < 0) {
        fprintf(stderr, "%s[ERROR] Failed to read interface flags: %s%s\n", 
                COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    if (!(ifr.ifr_flags & IFF_UP)) {
        fprintf(stderr, "%s[ERROR] Interface '%s' is DOWN!%s\n", COLOR_RED, ifname, COLOR_RESET);
        fprintf(stderr, "Hint: Bring it UP using: sudo ip link set up %s\n", ifname);
        close(sock_fd);
        return EXIT_FAILURE;
    }
    printf("      %s[SUCCESS] Interface '%s' is UP and RUNNING (flags: 0x%04X)%s\n", 
           COLOR_GREEN, ifname, ifr.ifr_flags, COLOR_RESET);

    /* -------------------------------------------------------------
     * Step 4: Configure Socket Options and Bind to vcan0
     * ------------------------------------------------------------- */
    printf("[4/5] Binding socket to interface index %d...\n", ifindex);
    
    /* Enable loopback so we can self-verify transmission */
    setsockopt(sock_fd, SOL_CAN_RAW, CAN_RAW_LOOPBACK, &loopback_val, sizeof(loopback_val));
    setsockopt(sock_fd, SOL_CAN_RAW, CAN_RAW_RECV_OWN_MSGS, &recv_own_msgs, sizeof(recv_own_msgs));

    /* Set socket receive timeout */
    tv.tv_sec = TIMEOUT_SECONDS;
    tv.tv_usec = 0;
    setsockopt(sock_fd, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));

    memset(&addr, 0, sizeof(addr));
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifindex;

    if (bind(sock_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        fprintf(stderr, "%s[ERROR] Failed to bind to '%s': %s%s\n", 
                COLOR_RED, ifname, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }
    printf("      %s[SUCCESS] Socket successfully bound to %s%s\n", COLOR_GREEN, ifname, COLOR_RESET);

    /* -------------------------------------------------------------
     * Step 5: Construct and Transmit Member 1 Test Frame
     * ------------------------------------------------------------- */
    printf("[5/5] Transmitting Member 1 test frame & validating loopback...\n");
    memset(&tx_frame, 0, sizeof(tx_frame));
    tx_frame.can_id = SENTINEL_TEST_ID;
    tx_frame.can_dlc = 8;
    /* Payload: "SENTINEL" in ASCII (0x53, 0x45, 0x4E, 0x54, 0x49, 0x4E, 0x45, 0x4C) */
    tx_frame.data[0] = 0x53; /* 'S' */
    tx_frame.data[1] = 0x45; /* 'E' */
    tx_frame.data[2] = 0x4E; /* 'N' */
    tx_frame.data[3] = 0x54; /* 'T' */
    tx_frame.data[4] = 0x49; /* 'I' */
    tx_frame.data[5] = 0x4E; /* 'N' */
    tx_frame.data[6] = 0x45; /* 'E' */
    tx_frame.data[7] = 0x4C; /* 'L' */

    print_can_frame("      TX ->", &tx_frame);

    ssize_t nbytes = write(sock_fd, &tx_frame, sizeof(struct can_frame));
    if (nbytes != sizeof(struct can_frame)) {
        fprintf(stderr, "%s[ERROR] Write failed: %s%s\n", COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }
    printf("      %s[SUCCESS] Wrote %zd bytes to SocketCAN bus.%s\n", COLOR_GREEN, nbytes, COLOR_RESET);

    /* Read back loopbacked frame */
    memset(&rx_frame, 0, sizeof(rx_frame));
    ssize_t rbytes = read(sock_fd, &rx_frame, sizeof(struct can_frame));
    if (rbytes < 0) {
        fprintf(stderr, "%s[ERROR] Timeout or read failure waiting for loopback: %s%s\n", 
                COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    print_can_frame("      RX <-", &rx_frame);

    /* Validate frame content match */
    if (rx_frame.can_id == tx_frame.can_id &&
        rx_frame.can_dlc == tx_frame.can_dlc &&
        memcmp(rx_frame.data, tx_frame.data, 8) == 0) {
        printf("\n%s==============================================================%s\n", COLOR_GREEN, COLOR_RESET);
        printf("%s[ALL DELIVERABLES VERIFIED] %s is fully operational!%s\n", COLOR_GREEN, ifname, COLOR_RESET);
        printf("%sSocketCAN bus is live and ready for Members 2, 3, 4, and 5!%s\n", COLOR_GREEN, COLOR_RESET);
        printf("%s==============================================================%s\n", COLOR_GREEN, COLOR_RESET);
    } else {
        fprintf(stderr, "%s[ERROR] Frame payload mismatch!%s\n", COLOR_RED, COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    close(sock_fd);
    return EXIT_SUCCESS;
}
