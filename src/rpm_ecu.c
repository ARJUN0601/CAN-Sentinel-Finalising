/*
 * CAN-Sentinel — Member 2
 * Mock Engine RPM ECU
 *
 * CAN ID: 0x130
 * Payload: Unsigned 16-bit RPM, little-endian
 * Range: 0 to 8000 RPM
 * Transmission interval: 10 ms
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
#define RPM_MAX 8000
#define PERIOD_NS 10000000L

static void sleep_until_next_frame(void)
{
    struct timespec delay = { .tv_sec = 0, .tv_nsec = PERIOD_NS };

    while (nanosleep(&delay, &delay) == -1 && errno == EINTR) {
    }
}

int main(int argc, char *argv[])
{
    const char *interface = "vcan0";
    long rpm = 1000;
    char *end = NULL;

    if (argc > 3) {
        fprintf(stderr, "Usage: %s [interface] [rpm]\n", argv[0]);
        return EXIT_FAILURE;
    }

    if (argc >= 2) {
        interface = argv[1];
    }

    if (argc == 3) {
        errno = 0;
        rpm = strtol(argv[2], &end, 10);

        if (errno != 0 || end == argv[2] || *end != '\0') {
            fprintf(stderr, "Invalid RPM value: %s\n", argv[2]);
            return EXIT_FAILURE;
        }
    }

    if (rpm < 0 || rpm > RPM_MAX) {
        fprintf(stderr, "RPM must be between 0 and %d.\n", RPM_MAX);
        return EXIT_FAILURE;
    }

    if (strlen(interface) >= IFNAMSIZ) {
        fprintf(stderr, "Interface name is too long.\n");
        return EXIT_FAILURE;
    }

    int socket_fd = socket(PF_CAN, SOCK_RAW, CAN_RAW);

    if (socket_fd < 0) {
        perror("socket");
        return EXIT_FAILURE;
    }

    struct ifreq ifr;
    memset(&ifr, 0, sizeof(ifr));
    snprintf(ifr.ifr_name, sizeof(ifr.ifr_name), "%s", interface);

    if (ioctl(socket_fd, SIOCGIFINDEX, &ifr) < 0) {
        perror("SIOCGIFINDEX");
        close(socket_fd);
        return EXIT_FAILURE;
    }

    struct sockaddr_can address;
    memset(&address, 0, sizeof(address));
    address.can_family = AF_CAN;
    address.can_ifindex = ifr.ifr_ifindex;

    if (bind(socket_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        perror("bind");
        close(socket_fd);
        return EXIT_FAILURE;
    }

    struct can_frame frame;
    memset(&frame, 0, sizeof(frame));

    frame.can_id = RPM_CAN_ID;
    frame.can_dlc = 2;
    frame.data[0] = (uint8_t)(rpm & 0xff);
    frame.data[1] = (uint8_t)((rpm >> 8) & 0xff);

    printf("CAN-Sentinel Engine RPM ECU\n");
    printf("Interface: %s | CAN ID: 0x%03X\n",
           interface, RPM_CAN_ID);
    printf("RPM: %ld | Interval: 10 ms\n", rpm);
    printf("Press Ctrl+C to stop.\n");
    fflush(stdout);

    for (;;) {
        if (write(socket_fd, &frame, sizeof(frame)) != sizeof(frame)) {
            perror("CAN frame write");
            close(socket_fd);
            return EXIT_FAILURE;
        }

        printf("TX ID=0x%03X DLC=%u RPM=%ld Data=%02X %02X\n",
               frame.can_id, frame.can_dlc, rpm,
               frame.data[0], frame.data[1]);
        fflush(stdout);

        sleep_until_next_frame();
    }

    close(socket_fd);
    return EXIT_SUCCESS;
}
