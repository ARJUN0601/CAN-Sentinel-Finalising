```c
/*
 * CAN-Sentinel — Member 3
 * Mock Engine Temperature ECU
 *
 * CAN ID: 0x250
 * Payload: signed 8-bit temperature in Celsius
 * Range: -40 to 150 degrees Celsius
 * Nominal transmission interval: 100 ms
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
#define TEMP_MIN (-40)
#define TEMP_MAX 150
#define PERIOD_NS 100000000L

int main(int argc, char *argv[])
{
    const char *interface;
    long temperature = 90;
    char *end = NULL;

    if (argc < 2 || argc > 3) {
        fprintf(stderr, "Usage: %s <interface> [temperature_c]\n",
                argv[0]);
        return EXIT_FAILURE;
    }

    interface = argv[1];

    if (argc == 3) {
        errno = 0;
        temperature = strtol(argv[2], &end, 10);

        if (errno != 0 || end == argv[2] || *end != '\0') {
            fprintf(stderr, "Invalid temperature: %s\n", argv[2]);
            return EXIT_FAILURE;
        }
    }

    if (temperature < TEMP_MIN || temperature > TEMP_MAX) {
        fprintf(stderr, "Temperature must be between -40 and 150 C.\n");
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

    /* Store the signed temperature as an 8-bit two's-complement value. */
    frame.data[0] = (uint8_t)(int8_t)temperature;

    printf("CAN-Sentinel Engine Temperature ECU\n");
    printf("Interface: %s | CAN ID: 0x%03X\n",
           interface, TEMP_CAN_ID);
    printf("Temperature: %ld C | Interval: 100 ms\n", temperature);
    printf("Press Ctrl+C to stop.\n");
    fflush(stdout);

    for (;;) {
        if (write(socket_fd, &frame, sizeof(frame)) != sizeof(frame)) {
            perror("CAN frame write");
            close(socket_fd);
            return EXIT_FAILURE;
        }

        printf("TX ID=0x%03X DLC=%u Temperature=%ld C Data=%02X\n",
               frame.can_id, frame.can_dlc, temperature, frame.data[0]);
        fflush(stdout);

        struct timespec delay = {
            .tv_sec = 0,
            .tv_nsec = PERIOD_NS
        };

        while (nanosleep(&delay, &delay) == -1 && errno == EINTR) {
            /* Resume sleeping if interrupted. */
        }
    }

    close(socket_fd);
    return EXIT_SUCCESS;
}
```
