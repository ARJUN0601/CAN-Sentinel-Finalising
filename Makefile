# ==============================================================================
# Project CAN-Sentinel: Week 1 - Member 1 Automation Makefile
# ==============================================================================

CC ?= gcc
CFLAGS ?= -Wall -Wextra -O2 -std=gnu11
INTERFACE ?= vcan0

BIN_DIR = bin
SRC_DIR = src
TARGET = $(BIN_DIR)/vcan_checker

.PHONY: all setup test teardown clean status deps install-service

all: $(TARGET)

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

$(TARGET): $(SRC_DIR)/vcan_checker.c | $(BIN_DIR)
	@echo ">> Compiling Member 1 C low-level SocketCAN verification program..."
	$(CC) $(CFLAGS) $< -o $@
	@echo ">> Build complete: $@"

# Automated setup of vcan0
setup:
	@echo ">> Running Member 1 automated vcan0 setup script..."
	sudo ./scripts/setup_vcan0.sh $(INTERFACE)

# Run verification test
test: $(TARGET)
	@echo ">> Running low-level C SocketCAN validation suite..."
	./$(TARGET) $(INTERFACE)

# Quick health status check
status:
	@./scripts/check_vcan0.sh $(INTERFACE)

# Teardown interface
teardown:
	@echo ">> Tearing down vcan0 interface..."
	sudo ./scripts/teardown_vcan0.sh $(INTERFACE)

# Install system dependencies on Ubuntu/Debian/Raspberry Pi
deps:
	@echo ">> Installing can-utils, iproute2, and build-essential..."
	sudo apt-get update && sudo apt-get install -y can-utils iproute2 build-essential kmod

# Install persistent systemd service
install-service:
	@echo ">> Installing persistent systemd service for vcan0..."
	sudo cp systemd/vcan0.service /etc/systemd/system/
	sudo systemctl daemon-reload
	sudo systemctl enable --now vcan0.service
	@echo ">> vcan0 service enabled and started!"

clean:
	rm -rf $(BIN_DIR)
