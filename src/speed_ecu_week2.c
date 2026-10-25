/*
 * CAN-Sentinel — Member 3 — Week 2
 * Dynamic Vehicle Speed ECU
 *
 * CAN ID: 0x240
 * Payload: Unsigned 16-bit speed in km/h * 100
 * Range: 0 to 80 km/h
 * Transmission interval: 50 ms
 *
 * Speed gradually increases and decreases to simulate
 * a vehicle accelerating and slowing down.
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

#define SPEED_CAN_ID 0x240
#define SPEED_MAX 80.0
#define SPEED_STEP 0.25
#define PERIOD_NS 50000000L

int main(int argc, char *argv[])
{
    const char *interface;
    double speed_kmh = 0.0;
    int accelerating = 1;

    if (argc != 2) {
        fprintf(stderr, "Usage: %s <interface>\n", argv[0]);
        return EXIT_FAILURE;
    }

    interface = argv[1];

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

    if (bind(socket_fd, (struct sockaddr *)&address,
             sizeof(address)) < 0) {
        perror("bind");
        close(socket_fd);
        return EXIT_FAILURE;
    }

    struct can_frame frame;
    memset(&frame, 0, sizeof(frame));

    frame.can_id = SPEED_CAN_ID;
    frame.can_dlc = 2;

    printf("CAN-Sentinel Week 2: Dynamic Speed ECU\n");
    printf("Interface: %s | CAN ID: 0x%03X\n",
           interface, SPEED_CAN_ID);
    printf("Speed range: 0-80 km/h | Interval: 50 ms\n");
    printf("Press Ctrl+C to stop.\n");
    fflush(stdout);

    for (;;) {
        uint16_t encoded_speed =
            (uint16_t)(speed_kmh * 100.0 + 0.5);

        frame.data[0] = (uint8_t)(encoded_speed & 0xFF);
        frame.data[1] = (uint8_t)((encoded_speed >> 8) & 0xFF);

        if (write(socket_fd, &frame, sizeof(frame))
            != sizeof(frame)) {
            perror("CAN frame write");
            close(socket_fd);
            return EXIT_FAILURE;
        }

        printf("TX ID=0x%03X Speed=%.2f km/h Data=%02X %02X\n",
               frame.can_id, speed_kmh,
               frame.data[0], frame.data[1]);
        fflush(stdout);

        if (accelerating) {
            speed_kmh += SPEED_STEP;

            if (speed_kmh >= SPEED_MAX) {
                speed_kmh = SPEED_MAX;
                accelerating = 0;
            }
        } else {
            speed_kmh -= SPEED_STEP;

            if (speed_kmh <= 0.0) {
                speed_kmh = 0.0;
                accelerating = 1;
            }
        }

        struct timespec delay = {
            .tv_sec = 0,
            .tv_nsec = PERIOD_NS
        };

        while (nanosleep(&delay, &delay) == -1
               && errno == EINTR) {
            /* Resume the remaining delay. */
        }
    }

    close(socket_fd);
    return EXIT_SUCCESS;
}
