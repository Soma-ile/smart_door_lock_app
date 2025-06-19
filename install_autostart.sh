#!/bin/bash

# Smart Door Lock Auto-Start Installation Script
# Run this script on your Raspberry Pi to set up auto-start

echo "🚀 Smart Door Lock Auto-Start Setup"
echo "=================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please do not run this script as root. Run as 'raspberrypi' user."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "face_recognition_system_optimized.py" ]; then
    echo "❌ face_recognition_system_optimized.py not found in current directory"
    echo "Please run this script from your smart door lock project directory"
    exit 1
fi

PROJECT_DIR=$(pwd)
echo "📁 Project directory: $PROJECT_DIR"

# Check if virtual environment exists
if [ ! -d "smart_door_env" ]; then
    echo "❌ Virtual environment 'smart_door_env' not found"
    echo "Please create a virtual environment first:"
    echo "python -m venv smart_door_env"
    echo "source smart_door_env/bin/activate"
    echo "pip install opencv-python face-recognition websockets RPi.GPIO"
    exit 1
fi

echo "✅ Virtual environment found"

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x startup_script.sh
chmod +x face_recognition_system_optimized.py

# Update service file with correct paths
echo "📝 Updating service file with project directory..."
sed -i "s|/home/pi/smart_door_lock|$PROJECT_DIR|g" smart-door-lock.service

# Install systemd service
echo "🛠️  Installing systemd service..."
sudo cp smart-door-lock.service /etc/systemd/system/
sudo systemctl daemon-reload

# Set up permissions
echo "🔑 Setting up permissions..."
sudo usermod -a -G video raspberrypi
sudo usermod -a -G gpio raspberrypi

# Set up udev rules for camera
echo "📷 Setting up camera permissions..."
echo 'SUBSYSTEM=="video4linux", GROUP="video", MODE="0664"' | sudo tee /etc/udev/rules.d/99-camera.rules

# Set up udev rules for GPIO
echo "⚡ Setting up GPIO permissions..."
echo 'SUBSYSTEM=="gpio", GROUP="gpio", MODE="0664"' | sudo tee /etc/udev/rules.d/99-gpio.rules

# Create required directories
echo "📂 Creating required directories..."
mkdir -p faces logs captures

# Enable the service
echo "🚀 Enabling auto-start service..."
sudo systemctl enable smart-door-lock.service

echo ""
echo "✅ Installation Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Test the service: sudo systemctl start smart-door-lock.service"
echo "2. Check status: sudo systemctl status smart-door-lock.service"
echo "3. View logs: sudo journalctl -u smart-door-lock.service -f"
echo "4. Reboot to test auto-start: sudo reboot"
echo ""
echo "🔧 Service Management:"
echo "• Start:   sudo systemctl start smart-door-lock.service"
echo "• Stop:    sudo systemctl stop smart-door-lock.service"
echo "• Restart: sudo systemctl restart smart-door-lock.service"
echo "• Disable: sudo systemctl disable smart-door-lock.service"
echo ""
echo "📋 Log Files:"
echo "• Startup logs: $PROJECT_DIR/startup.log"
echo "• Service logs: sudo journalctl -u smart-door-lock.service"
echo ""
echo "🎉 Your smart door lock will now start automatically on boot!"
