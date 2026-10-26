# ==============================================================================
# Project CAN-Sentinel: Member 1 + Member 2
# ==============================================================================

CC ?= gcc
CFLAGS ?= -Wall -Wextra -O2 -std=gnu11
INTERFACE ?= vcan0

BIN_DIR = bin
SRC_DIR = src

TARGET = $(BIN_DIR)/vcan_checker
STEERING_TARGET = $(BIN_DIR)/steering_ecu
RPM_TARGET = $(BIN_DIR)/rpm_ecu
SPEED_TEMP_TARGET = $(BIN_DIR)/speed_temp_ecu

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

$(TARGET): $(SRC_DIR)/vcan_checker.c | $(BIN_DIR)
	@echo ">> Compiling Member 1 SocketCAN verification program..."
	$(CC) $(CFLAGS) $< -o $@
	@echo ">> Build complete: $@"

$(STEERING_TARGET): $(SRC_DIR)/steering_ecu.c | $(BIN_DIR)
	@echo ">> Compiling Member 2 Steering ECU..."
	$(CC) $(CFLAGS) $< -o $@

$(RPM_TARGET): $(SRC_DIR)/rpm_ecu.c | $(BIN_DIR)
	@echo ">> Compiling Member 2 Engine RPM ECU..."
	$(CC) $(CFLAGS) $< -o $@

$(SPEED_TEMP_TARGET): $(SRC_DIR)/speed_temp_ecu.c | $(BIN_DIR)
	@echo ">> Compiling Member 3 Speed & Temperature ECU..."
	$(CC) $(CFLAGS) $< -o $@

.PHONY: all setup test teardown clean status deps install-service

all: $(TARGET) $(STEERING_TARGET) $(RPM_TARGET) $(SPEED_TEMP_TARGET)

setup:
	@echo ">> Running vcan0 setup script..."
	sudo bash scripts/setup_vcan0.sh $(INTERFACE)

test: all
	@echo ">> Running CAN-Sentinel integration test suite..."
	bash tests/test_suite.sh $(INTERFACE)

status:
	@bash scripts/check_vcan0.sh $(INTERFACE)

teardown:
	@echo ">> Tearing down vcan0 interface..."
	sudo bash scripts/teardown_vcan0.sh $(INTERFACE)

deps:
	@echo ">> Installing can-utils, iproute2, and build-essential..."
	sudo apt-get update
	sudo apt-get install -y can-utils iproute2 build-essential kmod

install-service:
	@echo ">> Installing persistent systemd service for vcan0..."
	sudo cp systemd/vcan0.service /etc/systemd/system/
	sudo systemctl daemon-reload
	sudo systemctl enable --now vcan0.service
	@echo ">> vcan0 service enabled and started!"

clean:
	rm -rf $(BIN_DIR)
