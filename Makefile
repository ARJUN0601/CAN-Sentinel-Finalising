# ==============================================================================
# CAN-Sentinel: Member 1, Member 2, Member 3 and Week 2 ECU targets
# ==============================================================================

CC ?= gcc
CFLAGS ?= -Wall -Wextra -O2 -std=gnu11
INTERFACE ?= vcan0

BIN_DIR = bin
SRC_DIR = src

TARGET = $(BIN_DIR)/vcan_checker
STEERING_TARGET = $(BIN_DIR)/steering_ecu
RPM_TARGET = $(BIN_DIR)/rpm_ecu
SPEED_TARGET = $(BIN_DIR)/speed_ecu
TEMP_TARGET = $(BIN_DIR)/temperature_ecu
SPEED_WEEK2_TARGET = $(BIN_DIR)/speed_ecu_week2
TEMP_WEEK2_TARGET = $(BIN_DIR)/temperature_ecu_week2

.PHONY: all setup test teardown clean status deps install-service

all: $(TARGET) $(STEERING_TARGET) $(RPM_TARGET) $(SPEED_TARGET) $(TEMP_TARGET) $(SPEED_WEEK2_TARGET) $(TEMP_WEEK2_TARGET)

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

$(TARGET): $(SRC_DIR)/vcan_checker.c | $(BIN_DIR)
	@echo ">> Compiling SocketCAN verification program..."
	$(CC) $(CFLAGS) $< -o $@

$(STEERING_TARGET): $(SRC_DIR)/steering_ecu.c | $(BIN_DIR)
	@echo ">> Compiling Steering ECU..."
	$(CC) $(CFLAGS) $< -o $@

$(RPM_TARGET): $(SRC_DIR)/rpm_ecu.c | $(BIN_DIR)
	@echo ">> Compiling Engine RPM ECU..."
	$(CC) $(CFLAGS) $< -o $@

$(SPEED_TARGET): $(SRC_DIR)/speed_ecu.c | $(BIN_DIR)
	@echo ">> Compiling Vehicle Speed ECU..."
	$(CC) $(CFLAGS) $< -o $@

$(TEMP_TARGET): $(SRC_DIR)/temperature_ecu.c | $(BIN_DIR)
	@echo ">> Compiling Engine Temperature ECU..."
	$(CC) $(CFLAGS) $< -o $@

$(SPEED_WEEK2_TARGET): $(SRC_DIR)/speed_ecu_week2.c | $(BIN_DIR)
	@echo ">> Compiling Week 2 Speed ECU..."
	$(CC) $(CFLAGS) $< -o $@

$(TEMP_WEEK2_TARGET): $(SRC_DIR)/temperature_ecu_week2.c | $(BIN_DIR)
	@echo ">> Compiling Week 2 Temperature ECU..."
	$(CC) $(CFLAGS) $< -o $@

setup:
	@echo ">> Setting up virtual CAN interface..."
	sudo bash scripts/setup_vcan0.sh $(INTERFACE)

test: all
	@echo ">> Running CAN-Sentinel integration test suite..."
	bash tests/test_suite.sh $(INTERFACE)

status:
	@bash scripts/check_vcan0.sh $(INTERFACE)

teardown:
	@echo ">> Tearing down virtual CAN interface..."
	sudo bash scripts/teardown_vcan0.sh $(INTERFACE)

deps:
	@echo ">> Installing build and CAN dependencies..."
	sudo apt-get update
	sudo apt-get install -y can-utils iproute2 build-essential kmod

install-service:
	@echo ">> Installing persistent vcan0 systemd service..."
	sudo cp systemd/vcan0.service /etc/systemd/system/
	sudo systemctl daemon-reload
	sudo systemctl enable --now vcan0.service

clean:
	rm -rf $(BIN_DIR)
