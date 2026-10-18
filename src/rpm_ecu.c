
/*
 * CAN-Sentinel — Member 2
 * Mock Engine RPM ECU
 *
 * CAN ID: 0x130
 * Payload: unsigned 16-bit RPM, little-endian
 * Range: 0–8000 RPM
 * Nominal transmission interval: 10 ms
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
#define RPM_MIN    0
#define RPM_MAX    8000
#define PERIOD_NS  10000000L

int main(int argc, char *argv[])
{
	const char *interface = "vcan0";
	unsigned long rpm = 0;
	char *end = NULL;

	if (argc < 2 || argc > 3) {
		fprintf(stderr, "Usage: %s <interface> [rpm]\n", argv[0]);
		return EXIT_FAILURE;
	}

	interface = argv[1];

	if (argc == 3) {
		errno = 0;
		rpm = strtoul(argv[2], &end, 10);

		if (errno != 0 || end == argv[2] || *end != '\0') {
			fprintf(stderr, "Invalid RPM value: %s\n", argv[2]);
			return EXIT_FAILURE;
		}
	}

	if (rpm > RPM_MAX) {
		fprintf(stderr, "RPM must be between 0 and 8000.\n");
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

	/* Serialize the RPM value explicitly in little-endian order. */
	frame.data[0] = (uint8_t)(rpm & 0xffUL);
	frame.data[1] = (uint8_t)((rpm >> 8) & 0xffUL);

	printf("CAN-Sentinel Engine RPM ECU\n");
	printf("Interface: %s | CAN ID: 0x%03X\n",
		   interface, RPM_CAN_ID);
	printf("RPM: %lu | Interval: 10 ms\n", rpm);
	printf("Press Ctrl+C to stop.\n");
	fflush(stdout);

	for (;;) {
		if (write(socket_fd, &frame, sizeof(frame)) != sizeof(frame)) {
			perror("CAN frame write");
			close(socket_fd);
			return EXIT_FAILURE;
		}

		printf("TX ID=0x%03X DLC=%u RPM=%lu Data=%02X %02X\n",
			   frame.can_id, frame.can_dlc, rpm,
		 frame.data[0], frame.data[1]);
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
