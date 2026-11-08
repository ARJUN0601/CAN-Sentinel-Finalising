/*
 * CAN-Sentinel — Member 2
 * Mock Engine RPM ECU
 *
 * CAN ID: 0x130
 * Payload: Unsigned 16-bit RPM, little-endian
 * Range: 0 to 8000 RPM
 * Transmission interval: 10 ms
 *
 * Attacked mode is a simulated anomaly and is restricted to vcan0.
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
#define DEFAULT_RPM 1000UL
#define PERIOD_NS 10000000L

static void sleep_until_next_frame(void)
{
    struct timespec delay = {
        .tv_sec = 0,
        .tv_nsec = PERIOD_NS
    };

    while (nanosleep(&delay, &delay) == -1 && errno == EINTR) {
    }
}

static int parse_rpm(const char *input, unsigned long *rpm)
{
    char *end = NULL;

    if (input == NULL || input[0] == '\0' || input[0] == '-') {
        return -1;
    }

    errno = 0;
    unsigned long value = strtoul(input, &end, 10);

    if (errno != 0 || end == input || *end != '\0' || value > RPM_MAX) {
        return -1;
    }

    *rpm = value;
    return 0;
}

int main(int argc, char *argv[])
{
    const char *interface = "vcan0";
    const char *mode = "normal";
    unsigned long rpm = DEFAULT_RPM;

    if (argc > 4) {
        fprintf(stderr,
                "Usage: %s [interface] [rpm] [normal|attacked]\n",
                argv[0]);
        return EXIT_FAILURE;
    }

    if (argc >= 2) {
        interface = argv[1];
    }

    if (argc >= 3 && parse_rpm(argv[2], &rpm) != 0) {
        fprintf(stderr, "RPM must be a valid integer between 0 and %lu.\n",
                RPM_MAX);
        return EXIT_FAILURE;
    }

    if (argc == 4) {
        mode = argv[3];
    }

    if (strcmp(mode, "normal") != 0 &&
        strcmp(mode, "attacked") != 0) {
        fprintf(stderr, "Mode must be normal or attacked.\n");
        return EXIT_FAILURE;
    }

    if (strlen(interface) >= IFNAMSIZ) {
        fprintf(stderr, "Interface name is too long.\n");
        return EXIT_FAILURE;
    }

    if (strcmp(mode, "attacked") == 0 &&
        strcmp(interface, "vcan0") != 0) {
        fprintf(stderr,
                "Attacked simulation is restricted to vcan0.\n");
        return EXIT_FAILURE;
    }

    int socket_fd = socket(PF_CAN, SOCK_RAW, CAN_RAW);

    if (socket_fd < 0) {
        perror("socket");
        return EXIT_FAILURE;
    }

    struct ifreq ifr = {0};
    snprintf(ifr.ifr_name, sizeof(ifr.ifr_name), "%s", interface);

    if (ioctl(socket_fd, SIOCGIFINDEX, &ifr) < 0) {
        perror("SIOCGIFINDEX");
        close(socket_fd);
        return EXIT_FAILURE;
    }

    struct sockaddr_can address = {0};
    address.can_family = AF_CAN;
    address.can_ifindex = ifr.ifr_ifindex;

    if (bind(socket_fd, (struct sockaddr *)&address,
             sizeof(address)) < 0) {
        perror("bind");
        close(socket_fd);
        return EXIT_FAILURE;
    }

    printf("CAN-Sentinel Engine RPM ECU\n");
    printf("Interface: %s | CAN ID: 0x%03X\n",
           interface, RPM_CAN_ID);
    printf("Base RPM: %lu | Mode: %s | Interval: 10 ms\n",
           rpm, mode);
    printf("Press Ctrl+C to stop.\n");
    fflush(stdout);

    unsigned int tick = 0;

    for (;;) {
        unsigned long value = rpm;

        if (strcmp(mode, "attacked") == 0 && tick % 2 != 0) {
            value = 7500;
        }

        struct can_frame frame = {0};
        frame.can_id = RPM_CAN_ID;
        frame.can_dlc = 2;
        frame.data[0] = (uint8_t)(value & 0xff);
        frame.data[1] = (uint8_t)((value >> 8) & 0xff);

        if (write(socket_fd, &frame, sizeof(frame)) != sizeof(frame)) {
            perror("CAN frame write");
            close(socket_fd);
            return EXIT_FAILURE;
        }

        printf("TX mode=%s rpm=%lu data=%02X %02X\n",
               mode, value, frame.data[0], frame.data[1]);
        fflush(stdout);

        tick++;
        sleep_until_next_frame();
    }

    close(socket_fd);
    return EXIT_SUCCESS;
}
