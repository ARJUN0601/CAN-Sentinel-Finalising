/*
 * CAN-Sentinel — Member 2
 * Mock Steering ECU
 * CAN ID: 0x120; float32 little-endian; 20 ms period.
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

#define STEERING_CAN_ID 0x120
#define STEERING_MIN (-540.0f)
#define STEERING_MAX (540.0f)
#define PERIOD_NS 20000000L

static void pause_period(void)
{
    struct timespec delay = { .tv_sec = 0, .tv_nsec = PERIOD_NS };
    while (nanosleep(&delay, &delay) == -1 && errno == EINTR) {}
}

int main(int argc, char *argv[])
{
    const char *interface = "vcan0";
    const char *mode = "normal";
    float angle = 0.0f;
    char *end = NULL;
    int arg = 1;

    if (arg < argc && argv[arg][0] != '-') interface = argv[arg++];

    if (arg < argc) {
        errno = 0;
        angle = strtof(argv[arg], &end);
        if (errno || end == argv[arg] || *end != '\0') {
            fprintf(stderr, "Invalid steering angle: %s\n", argv[arg]);
            return EXIT_FAILURE;
        }
        arg++;
    }

    if (arg < argc) mode = argv[arg++];

    if (arg != argc || (strcmp(mode, "normal") && strcmp(mode, "attacked"))) {
        fprintf(stderr, "Usage: %s [interface] [degrees] [normal|attacked]\n", argv[0]);
        return EXIT_FAILURE;
    }

    if (angle < STEERING_MIN || angle > STEERING_MAX) {
        fprintf(stderr, "Angle must be between -540 and +540 degrees.\n");
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

    printf("Steering ECU | interface=%s | mode=%s | CAN ID=0x%03X\n",
           interface, mode, STEERING_CAN_ID);
    fflush(stdout);

    unsigned int tick = 0;
    for (;;) {
        float value = angle;
        if (!strcmp(mode, "attacked") && (tick % 2)) value = 180.0f;

        uint32_t bits;
        memcpy(&bits, &value, sizeof(bits));

        struct can_frame frame = {0};
        frame.can_id = STEERING_CAN_ID;
        frame.can_dlc = 4;
        frame.data[0] = bits & 0xffU;
        frame.data[1] = (bits >> 8) & 0xffU;
        frame.data[2] = (bits >> 16) & 0xffU;
        frame.data[3] = (bits >> 24) & 0xffU;

        if (write(fd, &frame, sizeof(frame)) != sizeof(frame)) {
            perror("CAN frame write"); close(fd); return EXIT_FAILURE;
        }

        printf("TX mode=%s angle=%.2f\n", mode, value);
        fflush(stdout);
        tick++;
        pause_period();
    }
}
