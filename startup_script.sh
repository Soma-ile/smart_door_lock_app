#!/bin/bash

# Smart Door Lock Startup Script
# This script prepares the environment and starts the face recognition system

# Set up logging
LOG_FILE="/home/raspberrypi/smart_door_lock/startup.log"
exec > >(tee -a $LOG_FILE)
exec 2>&1

echo "$(date): Starting Smart Door Lock System..."

# Wait for network to be ready
echo "$(date): Waiting for network..."
while ! ping -c 1 google.com &> /dev/null; do
    echo "$(date): Network not ready, waiting..."
    sleep 5
done
echo "$(date): Network is ready"

# Navigate to project directory
cd /home/raspberrypi/smart_door_lock

# Activate virtual environment
echo "$(date): Activating virtual environment..."
source smart_door_env/bin/activate

# Check if camera is available
echo "$(date): Checking camera availability..."
if ! ls /dev/video* &> /dev/null; then
    echo "$(date): Warning: No camera devices found"
fi

# Set camera permissions
echo "$(date): Setting camera permissions..."
sudo chmod 666 /dev/video* 2>/dev/null || echo "$(date): Warning: Could not set camera permissions"

# Add user to video group (if not already)
sudo usermod -a -G video raspberrypi

# Check GPIO permissions
echo "$(date): Setting GPIO permissions..."
sudo chmod 666 /dev/gpiomem 2>/dev/null || echo "$(date): Warning: Could not set GPIO permissions"

# Install/update dependencies if needed
echo "$(date): Checking Python dependencies..."
pip install --quiet opencv-python face-recognition websockets asyncio RPi.GPIO

# Create required directories
mkdir -p /home/raspberrypi/smart_door_lock/faces
mkdir -p /home/raspberrypi/smart_door_lock/logs
mkdir -p /home/raspberrypi/smart_door_lock/captures

# Set proper permissions
chmod +x /home/raspberrypi/smart_door_lock/face_recognition_system_optimized.py

# Wait a bit more to ensure everything is ready
echo "$(date): Waiting for system to stabilize..."
sleep 10

# Start the face recognition system
echo "$(date): Starting face recognition system..."
python face_recognition_system_optimized.py

echo "$(date): Face recognition system stopped"
