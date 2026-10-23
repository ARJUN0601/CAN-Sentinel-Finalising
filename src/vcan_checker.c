
/*
 * ============================================================================
 * Project CAN-Sentinel: Week 1
 * Member 1 - SocketCAN Interface Checker
 *
 * Description:
 * Checks whether a Linux SocketCAN interface is available and operational.
 * Sends a test frame with CAN ID 0x101 and verifies local loopback reception.
 *
 * Compilation:
 * gcc -Wall -Wextra -O2 -std=gnu11 src/vcan_checker.c -o vcan_checker
 *
 * Usage:
 * ./vcan_checker [interface_name]
 * ============================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>

#include <sys/types.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <sys/time.h>

#include <net/if.h>
#include <linux/can.h>
#include <linux/can/raw.h>

#define DEFAULT_CAN_IF "vcan0"
#define SENTINEL_TEST_ID 0x101
#define TIMEOUT_SECONDS 2

#define COLOR_GREEN  "\033[0;32m"
#define COLOR_RED    "\033[0;31m"
#define COLOR_YELLOW "\033[1;33m"
#define COLOR_CYAN   "\033[0;36m"
#define COLOR_RESET  "\033[0m"

static void print_banner(const char *ifname)
{
    printf("%s==============================================================%s\n",
           COLOR_CYAN, COLOR_RESET);
    printf("%s   CAN-SENTINEL: MEMBER 1 SOCKETCAN INTERFACE CHECKER         %s\n",
           COLOR_CYAN, COLOR_RESET);
    printf("%s==============================================================%s\n",
           COLOR_CYAN, COLOR_RESET);
    printf("Target interface: %s%s%s\n\n",
           COLOR_YELLOW, ifname, COLOR_RESET);
}

static void print_can_frame(const char *prefix,
                            const struct can_frame *frame)
{
    printf("%s [ID: 0x%03X, DLC: %u] Data: ",
           prefix, frame->can_id, frame->can_dlc);

    for (int i = 0; i < frame->can_dlc; i++) {
        printf("%02X ", frame->data[i]);
    }

    printf("(ASCII: '");

    for (int i = 0; i < frame->can_dlc; i++) {
        unsigned char byte = frame->data[i];
        char c = (byte >= 32 && byte <= 126) ? (char)byte : '.';
        putchar(c);
    }

    printf("')\n");
}

int main(int argc, char *argv[])
{
    const char *ifname = DEFAULT_CAN_IF;
    int sock_fd = -1;
    int loopback_val = 1;
    int recv_own_msgs = 1;

    struct sockaddr_can addr;
    struct ifreq ifr;
    struct can_frame tx_frame;
    struct can_frame rx_frame;
    struct timeval tv;

    if (argc > 2) {
        fprintf(stderr, "Usage: %s [interface_name]\n", argv[0]);
        return EXIT_FAILURE;
    }

    if (argc == 2) {
        ifname = argv[1];
    }

    if (ifname[0] == '\0' || strlen(ifname) >= IFNAMSIZ) {
        fprintf(stderr, "%s[ERROR] Invalid interface name.%s\n",
                COLOR_RED, COLOR_RESET);
        return EXIT_FAILURE;
    }

    print_banner(ifname);

    /* Step 1: Create a raw CAN socket. */
    printf("[1/5] Creating raw SocketCAN socket...\n");

    sock_fd = socket(PF_CAN, SOCK_RAW, CAN_RAW);

    if (sock_fd < 0) {
        fprintf(stderr, "%s[ERROR] Cannot create CAN socket: %s%s\n",
                COLOR_RED, strerror(errno), COLOR_RESET);
        fprintf(stderr, "Hint: Ensure SocketCAN kernel support is available.\n");
        return EXIT_FAILURE;
    }

    printf("      %s[SUCCESS] Socket created (fd = %d).%s\n",
           COLOR_GREEN, sock_fd, COLOR_RESET);

    /* Step 2: Find the interface index. */
    printf("[2/5] Looking up interface '%s'...\n", ifname);

    memset(&ifr, 0, sizeof(ifr));
    memcpy(ifr.ifr_name, ifname, strlen(ifname) + 1);

    if (ioctl(sock_fd, SIOCGIFINDEX, &ifr) < 0) {
        fprintf(stderr, "%s[ERROR] Interface lookup failed: %s%s\n",
                COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    int ifindex = ifr.ifr_ifindex;

    printf("      %s[SUCCESS] Interface index: %d.%s\n",
           COLOR_GREEN, ifindex, COLOR_RESET);

    /* Step 3: Check whether the interface is up. */
    printf("[3/5] Checking interface status...\n");

    if (ioctl(sock_fd, SIOCGIFFLAGS, &ifr) < 0) {
        fprintf(stderr, "%s[ERROR] Cannot read interface flags: %s%s\n",
                COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    if (!(ifr.ifr_flags & IFF_UP)) {
        fprintf(stderr, "%s[ERROR] Interface '%s' is DOWN.%s\n",
                COLOR_RED, ifname, COLOR_RESET);
        fprintf(stderr, "Hint: sudo ip link set %s up\n", ifname);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    printf("      %s[SUCCESS] Interface is UP (flags: 0x%04X).%s\n",
           COLOR_GREEN, (unsigned int)ifr.ifr_flags, COLOR_RESET);

    /* Step 4: Configure the socket and bind it to the interface. */
    printf("[4/5] Configuring and binding CAN socket...\n");

    if (setsockopt(sock_fd, SOL_CAN_RAW, CAN_RAW_LOOPBACK,
                   &loopback_val, sizeof(loopback_val)) < 0) {
        fprintf(stderr, "%s[ERROR] Cannot enable CAN loopback: %s%s\n",
                COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    if (setsockopt(sock_fd, SOL_CAN_RAW, CAN_RAW_RECV_OWN_MSGS,
                   &recv_own_msgs, sizeof(recv_own_msgs)) < 0) {
        fprintf(stderr, "%s[ERROR] Cannot enable reception of own messages: %s%s\n",
                COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    tv.tv_sec = TIMEOUT_SECONDS;
    tv.tv_usec = 0;

    if (setsockopt(sock_fd, SOL_SOCKET, SO_RCVTIMEO,
                   &tv, sizeof(tv)) < 0) {
        fprintf(stderr, "%s[ERROR] Cannot set receive timeout: %s%s\n",
                COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    memset(&addr, 0, sizeof(addr));
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifindex;

    if (bind(sock_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        fprintf(stderr, "%s[ERROR] Cannot bind to '%s': %s%s\n",
                COLOR_RED, ifname, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    printf("      %s[SUCCESS] Socket bound to %s.%s\n",
           COLOR_GREEN, ifname, COLOR_RESET);

    /* Step 5: Send the Member 1 SENTINEL test frame. */
    printf("[5/5] Sending test frame and checking loopback...\n");

    memset(&tx_frame, 0, sizeof(tx_frame));
    tx_frame.can_id = SENTINEL_TEST_ID;
    tx_frame.can_dlc = 8;

    memcpy(tx_frame.data, "SENTINEL", 8);

    print_can_frame("      TX ->", &tx_frame);

    ssize_t nbytes = write(sock_fd, &tx_frame, sizeof(tx_frame));

    if (nbytes != (ssize_t)sizeof(tx_frame)) {
        if (nbytes < 0) {
            fprintf(stderr, "%s[ERROR] CAN write failed: %s%s\n",
                    COLOR_RED, strerror(errno), COLOR_RESET);
        } else {
            fprintf(stderr, "%s[ERROR] Incomplete CAN frame write.%s\n",
                    COLOR_RED, COLOR_RESET);
        }

        close(sock_fd);
        return EXIT_FAILURE;
    }

    printf("      %s[SUCCESS] Test frame sent (%zd bytes).%s\n",
           COLOR_GREEN, nbytes, COLOR_RESET);

    memset(&rx_frame, 0, sizeof(rx_frame));

    ssize_t rbytes = read(sock_fd, &rx_frame, sizeof(rx_frame));

    if (rbytes < 0) {
        fprintf(stderr, "%s[ERROR] No loopback frame received: %s%s\n",
                COLOR_RED, strerror(errno), COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    if (rbytes != (ssize_t)sizeof(rx_frame)) {
        fprintf(stderr, "%s[ERROR] Incomplete received CAN frame.%s\n",
                COLOR_RED, COLOR_RESET);
        close(sock_fd);
        return EXIT_FAILURE;
    }

    print_can_frame("      RX <-", &rx_frame);

    /* Verify the received frame matches the transmitted frame. */
    if (rx_frame.can_id == tx_frame.can_id &&
        rx_frame.can_dlc == tx_frame.can_dlc &&
        memcmp(rx_frame.data, tx_frame.data, tx_frame.can_dlc) == 0) {

        printf("\n%s==============================================================%s\n",
               COLOR_GREEN, COLOR_RESET);
        printf("%s[SUCCESS] Interface '%s' passed the loopback test.%s\n",
               COLOR_GREEN, ifname, COLOR_RESET);
        printf("%sSocketCAN is ready for CAN-Sentinel testing.%s\n",
               COLOR_GREEN, COLOR_RESET);
        printf("%s==============================================================%s\n",
               COLOR_GREEN, COLOR_RESET);

        close(sock_fd);
        return EXIT_SUCCESS;
    }

    fprintf(stderr, "%s[ERROR] Received frame does not match transmitted frame.%s\n",
            COLOR_RED, COLOR_RESET);

    close(sock_fd);
    return EXIT_FAILURE;
}

