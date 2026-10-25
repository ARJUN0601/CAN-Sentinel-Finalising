# CAN-Sentinel: Build Member 1, Member 2, and Member 3 programs

CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=gnu11
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

.PHONY: all setup test clean

all: $(TARGET) $(STEERING_TARGET) $(RPM_TARGET) $(SPEED_TARGET) $(TEMP_TARGET) $(SPEED_WEEK2_TARGET) $(TEMP_WEEK2_TARGET)

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

$(TARGET): $(SRC_DIR)/vcan_checker.c | $(BIN_DIR)
	$(CC) $(CFLAGS) $< -o $@

$(STEERING_TARGET): $(SRC_DIR)/steering_ecu.c | $(BIN_DIR)
	$(CC) $(CFLAGS) $< -o $@

$(RPM_TARGET): $(SRC_DIR)/rpm_ecu.c | $(BIN_DIR)
	$(CC) $(CFLAGS) $< -o $@

$(SPEED_TARGET): $(SRC_DIR)/speed_ecu.c | $(BIN_DIR)
	$(CC) $(CFLAGS) $< -o $@

$(TEMP_TARGET): $(SRC_DIR)/temperature_ecu.c | $(BIN_DIR)
	$(CC) $(CFLAGS) $< -o $@

$(SPEED_WEEK2_TARGET): $(SRC_DIR)/speed_ecu_week2.c | $(BIN_DIR)
	$(CC) $(CFLAGS) $< -o $@

$(TEMP_WEEK2_TARGET): $(SRC_DIR)/temperature_ecu_week2.c | $(BIN_DIR)
	$(CC) $(CFLAGS) $< -o $@

setup:
	sudo bash scripts/setup_vcan0.sh $(INTERFACE)

test: all
	bash tests/test_suite.sh $(INTERFACE)

clean:
	rm -rf $(BIN_DIR)
