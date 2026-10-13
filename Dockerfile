# ==============================================================================
# Project CAN-Sentinel: Containerized SocketCAN Environment
# ==============================================================================
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install low-level networking, SocketCAN tools, and C compiler
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    make \
    iproute2 \
    kmod \
    can-utils \
    python3 \
    python3-pip \
    python3-can \
    net-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy Member 1 source code and scripts
COPY . /workspace/

RUN chmod +x scripts/*.sh tests/*.sh

# Note: Running virtual CAN inside Docker requires container capabilities:
# docker run --cap-add=NET_ADMIN --network=host -it can-sentinel-dev
CMD ["/bin/bash"]
