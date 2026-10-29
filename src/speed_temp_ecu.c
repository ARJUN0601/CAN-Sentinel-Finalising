#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <errno.h>
#include <linux/can.h>
#include <linux/can/raw.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <arpa/inet.h>

int main(int argc, char *argv[]) {
    const char *iface = argc > 1 ? argv[1] : "vcan0";
    int s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0) { perror("socket"); return 1; }

    struct ifreq ifr = {0};
    strncpy(ifr.ifr_name, iface, IFNAMSIZ - 1);
    if (ioctl(s, SIOCGIFINDEX, &ifr) < 0) {
        perror("ioctl"); close(s); return 1;
    }

    struct sockaddr_can addr = {0};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("bind"); close(s); return 1;
    }

    srand((unsigned)time(NULL));
    double speed = 40.0;
    int temp = 85;
    puts("Member 3: dynamic Speed (0x240) and Temperature (0x250). Ctrl+C to stop.");

    while (1) {
        speed += (rand() % 11 - 5);
        if (speed < 0) speed = 0;
        if (speed > 180) speed = 180;
        temp += rand() % 5 - 2;
        if (temp < 60) temp = 60;
        if (temp > 120) temp = 120;

        struct can_frame f = {0};
        f.can_id = 0x240;
        f.can_dlc = 2;
        uint16_t speed_x100 = (uint16_t)(speed * 100);
        f.data[0] = speed_x100 & 0xFF;
        f.data[1] = (speed_x100 >> 8) & 0xFF;
        if (write(s, &f, sizeof(f)) != sizeof(f)) perror("speed write");
        else printf("TX ID=0x240 Speed=%.1f km/h\n", speed);

        memset(&f, 0, sizeof(f));
        f.can_id = 0x250;
        f.can_dlc = 1;
        f.data[0] = (uint8_t)(int8_t)temp;
        if (write(s, &f, sizeof(f)) != sizeof(f)) perror("temperature write");
        else printf("TX ID=0x250 Temp=%d C\n", temp);

        usleep(50000);
    }

    close(s);
    return 0;
}
