/*
 * CAN-Sentinel — Member 3 — Week 2
 * Dynamic Engine Temperature ECU
 *
 * CAN ID: 0x250
 * Payload: Signed 8-bit temperature in Celsius
 * Range: 80 to 100 degrees Celsius
 * Transmission interval: 100 ms
 *
 * Temperature gradually rises and falls to simulate
 * changing engine temperature.
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

#define TEMP_CAN_ID 0x250
#define TEMP_MIN 80
#define TEMP_MAX 100
#define TEMP_STEP 1
#define PERIOD_NS 100000000L

int main(int argc, char *argv[])
{
    const char *interface;
    int temperature = 90;
    int heating = 1;

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

    frame.can_id = TEMP_CAN_ID;
    frame.can_dlc = 1;

    printf("CAN-Sentinel Week 2: Dynamic Temperature ECU\n");
    printf("Interface: %s | CAN ID: 0x%03X\n",
           interface, TEMP_CAN_ID);
    printf("Temperature range: %d-%d C | Interval: 100 ms\n",
           TEMP_MIN, TEMP_MAX);
    printf("Press Ctrl+C to stop.\n");
    fflush(stdout);

    for (;;) {
        frame.data[0] = (uint8_t)(int8_t)temperature;

        if (write(socket_fd, &frame, sizeof(frame))
            != sizeof(frame)) {
            perror("CAN frame write");
            close(socket_fd);
            return EXIT_FAILURE;
        }

        printf("TX ID=0x%03X Temperature=%d C Data=%02X\n",
               frame.can_id, temperature, frame.data[0]);
        fflush(stdout);

        if (heating) {
            temperature += TEMP_STEP;

            if (temperature >= TEMP_MAX) {
                temperature = TEMP_MAX;
                heating = 0;
            }
        } else {
            temperature -= TEMP_STEP;

            if (temperature <= TEMP_MIN) {
                temperature = TEMP_MIN;
                heating = 1;
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
