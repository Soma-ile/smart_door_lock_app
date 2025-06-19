# Smart Door Lock Auto-Start Setup Guide

This guide will help you set up your Python smart door lock application to run automatically when your Raspberry Pi boots up.

## 📋 Prerequisites

- Raspberry Pi with Raspberry Pi OS
- Python virtual environment set up in `/home/pi/smart_door_lock/smart_door_env`
- Your face recognition Python script: `face_recognition_system_optimized.py`
- Camera and GPIO hardware connected

## 🚀 Installation Steps

### Step 1: Copy Files to Raspberry Pi

Copy these files to your Raspberry Pi project directory:

```bash
# On your Raspberry Pi, navigate to your project directory
cd /home/pi/smart_door_lock

# Copy the service file and startup script (from your development machine)
# You can use scp, USB drive, or copy directly
```

### Step 2: Make Scripts Executable

```bash
# Make the startup script executable
chmod +x startup_script.sh
chmod +x face_recognition_system_optimized.py
```

### Step 3: Install the Systemd Service

```bash
# Copy the service file to systemd directory
sudo cp smart-door-lock.service /etc/systemd/system/

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start at boot
sudo systemctl enable smart-door-lock.service
```

### Step 4: Configure Permissions

```bash
# Add pi user to required groups
sudo usermod -a -G video pi
sudo usermod -a -G gpio pi

# Set up camera permissions
echo 'SUBSYSTEM=="video4linux", GROUP="video", MODE="0664"' | sudo tee /etc/udev/rules.d/99-camera.rules

# Set up GPIO permissions
echo 'SUBSYSTEM=="gpio", GROUP="gpio", MODE="0664"' | sudo tee /etc/udev/rules.d/99-gpio.rules
```

### Step 5: Test the Service

```bash
# Start the service manually to test
sudo systemctl start smart-door-lock.service

# Check service status
sudo systemctl status smart-door-lock.service

# View logs
sudo journalctl -u smart-door-lock.service -f

# Check startup script logs
tail -f /home/pi/smart_door_lock/startup.log
```

### Step 6: Reboot and Verify

```bash
# Reboot your Raspberry Pi
sudo reboot

# After reboot, check if service is running
sudo systemctl status smart-door-lock.service

# Check if your application is working
curl -I http://localhost:8765  # Should respond if WebSocket server is running
```

## 🔧 Service Management Commands

```bash
# Start the service
sudo systemctl start smart-door-lock.service

# Stop the service
sudo systemctl stop smart-door-lock.service

# Restart the service
sudo systemctl restart smart-door-lock.service

# Disable auto-start
sudo systemctl disable smart-door-lock.service

# Enable auto-start
sudo systemctl enable smart-door-lock.service

# View real-time logs
sudo journalctl -u smart-door-lock.service -f

# View startup script logs
tail -f /home/pi/smart_door_lock/startup.log
```

## 📁 File Structure

Your project directory should look like this:

```
/home/pi/smart_door_lock/
├── smart_door_env/                          # Python virtual environment
├── face_recognition_system_optimized.py    # Your main Python script
├── startup_script.sh                       # Startup preparation script
├── smart-door-lock.service                 # Systemd service file
├── startup.log                             # Startup logs
├── faces/                                   # Face recognition data
├── logs/                                    # Application logs
└── captures/                               # Camera captures
```

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check service status for errors
sudo systemctl status smart-door-lock.service

# Check detailed logs
sudo journalctl -u smart-door-lock.service --no-pager

# Check if virtual environment exists
ls -la /home/pi/smart_door_lock/smart_door_env/bin/python
```

### Camera Issues

```bash
# Check if camera is detected
ls -la /dev/video*

# Test camera manually
raspistill -o test.jpg

# Check camera permissions
groups pi  # Should include 'video'
```

### GPIO Issues

```bash
# Check GPIO permissions
ls -la /dev/gpiomem

# Check if pi user is in gpio group
groups pi  # Should include 'gpio'
```

### Network Issues

```bash
# Check network connectivity
ping google.com

# Check if port 8765 is available
netstat -tulpn | grep 8765
```

### Python Environment Issues

```bash
# Manually test virtual environment
cd /home/pi/smart_door_lock
source smart_door_env/bin/activate
python face_recognition_system_optimized.py

# Check Python dependencies
pip list | grep -E "(opencv|face-recognition|websockets)"
```

## 📝 Configuration Notes

### Service Configuration

The systemd service is configured to:
- Start after network is available
- Run as the `pi` user
- Restart automatically if it crashes
- Log output to system journal
- Wait up to 60 seconds for startup

### Startup Script Features

The startup script:
- Waits for network connectivity
- Sets up camera and GPIO permissions
- Activates the Python virtual environment
- Installs/updates required dependencies
- Creates necessary directories
- Logs all activities to `startup.log`

### Auto-Start Benefits

- ✅ Automatic startup after power on
- ✅ Automatic restart if application crashes
- ✅ Proper permission handling
- ✅ Network connectivity verification
- ✅ Comprehensive logging
- ✅ Clean shutdown handling

## 🔄 Making Changes

If you need to update your Python script:

```bash
# Stop the service
sudo systemctl stop smart-door-lock.service

# Update your Python script
# nano face_recognition_system_optimized.py

# Start the service again
sudo systemctl start smart-door-lock.service
```

## ✅ Verification

After setup, your smart door lock system should:
1. Start automatically when Raspberry Pi boots
2. Be accessible via WebSocket on port 8765
3. Handle camera and face recognition
4. Control GPIO for door lock mechanism
5. Log all activities for debugging

Your mobile app should now be able to connect to the Raspberry Pi immediately after it boots up!
