/*
 * CAN-Sentinel — Member 2
 * Mock Engine RPM ECU
 * CAN ID: 0x130; uint16 little-endian; 10 ms period.
 */

#include <errno.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <net/if.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define RPM_CAN_ID 0x130
#define RPM_MAX 8000UL
#define PERIOD_NS 10000000L

int main(int argc, char *argv[])
{
    if (argc < 2 || argc > 4) {
        fprintf(stderr, "Usage: %s <interface> [rpm] [normal|attacked]\n", argv[0]);
        return EXIT_FAILURE;
    }

    const char *interface = argv[1];
    unsigned long rpm = 0;
    const char *mode = "normal";
    char *end = NULL;

    if (argc >= 3) {
        errno = 0;
        rpm = strtoul(argv[2], &end, 10);
        if (errno || end == argv[2] || *end != '\0') {
            fprintf(stderr, "Invalid RPM value: %s\n", argv[2]);
            return EXIT_FAILURE;
        }
    }

    if (argc == 4) mode = argv[3];

    if (rpm > RPM_MAX ||
        (strcmp(mode, "normal") && strcmp(mode, "attacked"))) {
        fprintf(stderr, "RPM must be 0-8000; mode must be normal or attacked.\n");
        return EXIT_FAILURE;
    }

    if (!strcmp(mode, "attacked") && strcmp(interface, "vcan0")) {
        fprintf(stderr, "Attacked simulation is restricted to vcan0.\n");
        return EXIT_FAILURE;
    }

    int fd = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (fd < 0) { perror("socket"); return EXIT_FAILURE; }

    struct ifreq ifr = {0};
    snprintf(ifr.ifr_name, sizeof(ifr.ifr_name), "%s", interface);
    if (ioctl(fd, SIOCGIFINDEX, &ifr) < 0) {
        perror("SIOCGIFINDEX"); close(fd); return EXIT_FAILURE;
    }

    struct sockaddr_can addr = {0};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("bind"); close(fd); return EXIT_FAILURE;
    }

    printf("RPM ECU | interface=%s | mode=%s | CAN ID=0x%03X\n",
           interface, mode, RPM_CAN_ID);
    fflush(stdout);

    unsigned int tick = 0;
    for (;;) {
        unsigned long value = rpm;
        if (!strcmp(mode, "attacked") && (tick % 2)) value = 7500;

        struct can_frame frame = {0};
        frame.can_id = RPM_CAN_ID;
        frame.can_dlc = 2;
        frame.data[0] = value & 0xffUL;
        frame.data[1] = (value >> 8) & 0xffUL;

        if (write(fd, &frame, sizeof(frame)) != sizeof(frame)) {
            perror("CAN frame write"); close(fd); return EXIT_FAILURE;
        }

        printf("TX mode=%s rpm=%lu\n", mode, value);
        fflush(stdout);
        tick++;

        struct timespec delay = { .tv_sec = 0, .tv_nsec = PERIOD_NS };
        while (nanosleep(&delay, &delay) == -1 && errno == EINTR) {}
    }
}
