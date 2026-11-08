/*
 * CAN-Sentinel — Member 2
 * Mock Steering ECU
 *
 * CAN ID: 0x120
 * Payload: IEEE-754 float32, little-endian
 * Range: -540.0 to +540.0 degrees
 * Transmission interval: 20 ms
 *
 * Attacked mode is simulated and restricted to vcan0.
 */

#include <errno.h>
#include <math.h>
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

#define STEERING_CAN_ID 0x120
#define STEERING_MIN (-540.0f)
#define STEERING_MAX (540.0f)
#define PERIOD_NS 20000000L

_Static_assert(sizeof(float) == sizeof(uint32_t),
               "32-bit float is required");

static void sleep_until_next_frame(void)
{
    struct timespec delay = {
        .tv_sec = 0,
        .tv_nsec = PERIOD_NS
    };

    while (nanosleep(&delay, &delay) == -1 && errno == EINTR) {
    }
}

static int parse_angle(const char *input, float *angle)
{
    char *end = NULL;

    if (input == NULL || input[0] == '\0') {
        return -1;
    }

    errno = 0;
    float value = strtof(input, &end);

    if (errno != 0 || end == input || *end != '\0' ||
        !isfinite(value) ||
        value < STEERING_MIN || value > STEERING_MAX) {
        return -1;
    }

    *angle = value;
    return 0;
}

int main(int argc, char *argv[])
{
    const char *interface = "vcan0";
    const char *mode = "normal";
    float angle = 0.0f;
    int arg = 1;

    if (arg < argc && argv[arg][0] != '-') {
        interface = argv[arg++];
    }

    if (arg < argc && argv[arg][0] != '\0') {
        if (parse_angle(argv[arg], &angle) != 0) {
            fprintf(stderr, "Invalid steering angle. Range: -540 to +540.\n");
            return EXIT_FAILURE;
        }
        arg++;
    }

    if (arg < argc) {
        mode = argv[arg++];
    }

    if (arg != argc ||
        (strcmp(mode, "normal") != 0 &&
         strcmp(mode, "attacked") != 0)) {
        fprintf(stderr,
                "Usage: %s [interface] [degrees] [normal|attacked]\n",
                argv[0]);
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

    printf("CAN-Sentinel Steering ECU\n");
    printf("Interface: %s | CAN ID: 0x%03X\n",
           interface, STEERING_CAN_ID);
    printf("Base angle: %.2f degrees | Mode: %s | Interval: 20 ms\n",
           angle, mode);
    printf("Press Ctrl+C to stop.\n");
    fflush(stdout);

    unsigned int tick = 0;

    for (;;) {
        float value = angle;

        if (strcmp(mode, "attacked") == 0 && tick % 2 != 0) {
            value = 180.0f;
        }

        uint32_t bits;
        memcpy(&bits, &value, sizeof(bits));

        struct can_frame frame = {0};
        frame.can_id = STEERING_CAN_ID;
        frame.can_dlc = 4;

        frame.data[0] = (uint8_t)(bits & 0xffU);
        frame.data[1] = (uint8_t)((bits >> 8) & 0xffU);
        frame.data[2] = (uint8_t)((bits >> 16) & 0xffU);
        frame.data[3] = (uint8_t)((bits >> 24) & 0xffU);

        if (write(socket_fd, &frame, sizeof(frame)) != sizeof(frame)) {
            perror("CAN frame write");
            close(socket_fd);
            return EXIT_FAILURE;
        }

        printf("TX mode=%s angle=%.2f data=%02X %02X %02X %02X\n",
               mode, value,
               frame.data[0], frame.data[1],
               frame.data[2], frame.data[3]);
        fflush(stdout);

        tick++;
        sleep_until_next_frame();
    }

    close(socket_fd);
    return EXIT_SUCCESS;
}
