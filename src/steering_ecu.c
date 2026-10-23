/*
 * CAN-Sentinel — Member 2
 * Mock Steering ECU
 *
 * CAN ID: 0x120
 * Payload: IEEE 754 float32, little-endian
 * Range: -540.0 to +540.0 degrees
 * Transmission interval: 20 ms
 */

#include <errno.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <net/if.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define STEERING_CAN_ID 0x120
#define STEERING_MIN (-540.0f)
#define STEERING_MAX (540.0f)
#define PERIOD_NS 20000000L

static void sleep_until_next_frame(void)
{
    struct timespec delay = { .tv_sec = 0, .tv_nsec = PERIOD_NS };

    while (nanosleep(&delay, &delay) == -1 && errno == EINTR) {
    }
}

int main(int argc, char *argv[])
{
    const char *interface = "vcan0";
    float steering_degrees = 0.0f;
    char *end = NULL;

    if (argc > 3) {
        fprintf(stderr, "Usage: %s [interface] [degrees]\n", argv[0]);
        return EXIT_FAILURE;
    }

    if (argc >= 2) {
        interface = argv[1];
    }

    if (argc == 3) {
        errno = 0;
        steering_degrees = strtof(argv[2], &end);

        if (errno != 0 || end == argv[2] || *end != '\0'
            || !isfinite(steering_degrees)) {
            fprintf(stderr, "Invalid steering angle: %s\n", argv[2]);
            return EXIT_FAILURE;
        }
    }

    if (steering_degrees < STEERING_MIN ||
        steering_degrees > STEERING_MAX) {
        fprintf(stderr, "Angle must be between -540 and +540 degrees.\n");
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

    frame.can_id = STEERING_CAN_ID;
    frame.can_dlc = 4;

    uint32_t bits;
    memcpy(&bits, &steering_degrees, sizeof(bits));

    frame.data[0] = (uint8_t)(bits & 0xffU);
    frame.data[1] = (uint8_t)((bits >> 8) & 0xffU);
    frame.data[2] = (uint8_t)((bits >> 16) & 0xffU);
    frame.data[3] = (uint8_t)((bits >> 24) & 0xffU);

    printf("CAN-Sentinel Steering ECU\n");
    printf("Interface: %s | CAN ID: 0x%03X\n",
           interface, STEERING_CAN_ID);
    printf("Angle: %.2f degrees | Interval: 20 ms\n",
           steering_degrees);
    printf("Press Ctrl+C to stop.\n");
    fflush(stdout);

    for (;;) {
        if (write(socket_fd, &frame, sizeof(frame)) != sizeof(frame)) {
            perror("CAN frame write");
            close(socket_fd);
            return EXIT_FAILURE;
        }

        printf("TX ID=0x%03X DLC=%u Angle=%.2f deg Data=",
               frame.can_id, frame.can_dlc, steering_degrees);

        for (int i = 0; i < frame.can_dlc; i++) {
            printf("%02X%s", frame.data[i],
                   i + 1 < frame.can_dlc ? " " : "");
        }

        putchar('\n');
        fflush(stdout);

        sleep_until_next_frame();
    }

    close(socket_fd);
    return EXIT_SUCCESS;
}
