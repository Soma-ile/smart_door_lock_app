#!/usr/bin/env python3
"""
Face Recognition System for Raspberry Pi with WebSocket Support and Door Lock Control
Captures faces, trains recognition model, performs real-time identification, and controls door lock
"""

import cv2
import face_recognition
import numpy as np
import os
import pickle
import json
import asyncio
import websockets
import base64
from datetime import datetime, timedelta
from aiohttp import web
from typing import Dict, List, Optional, Set
import traceback
import RPi.GPIO as GPIO
import threading
import time

class DoorLockController:
    def __init__(self, relay_pin=12, lock_duration=5):
        """
        Initialize door lock controller
        relay_pin: GPIO pin connected to relay module (default: 12)
        lock_duration: How long to keep door unlocked in seconds (default: 5)
        """
        self.relay_pin = relay_pin
        self.lock_duration = lock_duration
        self.is_unlocked = False
        self.unlock_timer = None
        
        # Setup GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.relay_pin, GPIO.OUT)
        GPIO.output(self.relay_pin, GPIO.LOW)  # Start with door locked (relay OFF)
        
        print(f"Door lock controller initialized on pin {self.relay_pin}")
    
    def unlock_door(self, duration=None):
        """
        Unlock door for specified duration
        duration: Override default lock duration
        """
        if duration is None:
            duration = self.lock_duration
            
        try:
            # Cancel existing timer if running
            if self.unlock_timer and self.unlock_timer.is_alive():
                self.unlock_timer.cancel()
            
            # Activate relay (unlock door)
            GPIO.output(self.relay_pin, GPIO.HIGH)
            self.is_unlocked = True
            print(f"Door unlocked for {duration} seconds")
            
            # Set timer to lock door again
            self.unlock_timer = threading.Timer(duration, self._lock_door)
            self.unlock_timer.start()
            
            return True
            
        except Exception as e:
            print(f"Error unlocking door: {e}")
            return False
    
    def _lock_door(self):
        """Internal method to lock door (called by timer)"""
        try:
            GPIO.output(self.relay_pin, GPIO.LOW)
            self.is_unlocked = False
            print("Door locked automatically")
        except Exception as e:
            print(f"Error locking door: {e}")
    
    def force_lock(self):
        """Manually lock door immediately"""
        try:
            if self.unlock_timer and self.unlock_timer.is_alive():
                self.unlock_timer.cancel()
            
            GPIO.output(self.relay_pin, GPIO.LOW)
            self.is_unlocked = False
            print("Door force locked")
            return True
            
        except Exception as e:
            print(f"Error force locking door: {e}")
            return False
    
    def get_status(self):
        """Get current door lock status"""
        return {
            'is_unlocked': self.is_unlocked,
            'pin': self.relay_pin,
            'duration': self.lock_duration
        }
    
    def cleanup(self):
        """Cleanup GPIO resources"""
        try:
            if self.unlock_timer and self.unlock_timer.is_alive():
                self.unlock_timer.cancel()
            GPIO.output(self.relay_pin, GPIO.LOW)  # Ensure door is locked
            GPIO.cleanup()
            print("Door lock controller cleaned up")
        except Exception as e:
            print(f"Error cleaning up door lock controller: {e}")

class FaceRecognitionSystem:
    def __init__(self, tolerance=0.6, model='hog', auto_unlock=True, unlock_confidence=0.8):
        """
        Initialize face recognition system
        tolerance: Lower values = more strict matching
        model: 'hog' for CPU (faster on Pi), 'cnn' for GPU (more accurate)
        auto_unlock: Automatically unlock door when recognized face is detected
        unlock_confidence: Minimum confidence required for auto unlock
        """
        self.tolerance = tolerance
        self.model = model
        self.auto_unlock = auto_unlock
        self.unlock_confidence = unlock_confidence
        self.known_face_encodings = []
        self.known_face_names = []
        self.authorized_users = set()  # Users authorized to unlock door
        self.data_file = 'face_data.pkl'
        self.log_file = 'recognition_log.json'
        self.config_file = 'door_config.json'
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.camera = None
        self.running = False
        
        # Initialize door lock controller
        self.door_lock = DoorLockController()
        
        # Load existing face data and config
        self.load_face_data()
        self.load_config()
    
    def load_face_data(self) -> None:
        """Load previously saved face encodings and names"""
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'rb') as f:
                    data = pickle.load(f)
                    self.known_face_encodings = data['encodings']
                    self.known_face_names = data['names']
                    # Load authorized users if available
                    if 'authorized_users' in data:
                        self.authorized_users = set(data['authorized_users'])
                print(f"Loaded {len(self.known_face_names)} known faces")
                print(f"Authorized users: {list(self.authorized_users)}")
            except Exception as e:
                print(f"Error loading face data: {e}")
                self.known_face_encodings = []
                self.known_face_names = []
                self.authorized_users = set()
    
    def save_face_data(self) -> None:
        """Save face encodings and names to file"""
        try:
            data = {
                'encodings': self.known_face_encodings,
                'names': self.known_face_names,
                'authorized_users': list(self.authorized_users)
            }
            with open(self.data_file, 'wb') as f:
                pickle.dump(data, f)
            print(f"Saved {len(self.known_face_names)} faces to {self.data_file}")
        except Exception as e:
            print(f"Error saving face data: {e}")
    
    def load_config(self) -> None:
        """Load door configuration"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    self.auto_unlock = config.get('auto_unlock', True)
                    self.unlock_confidence = config.get('unlock_confidence', 0.8)
                    self.door_lock.lock_duration = config.get('lock_duration', 5)
                print(f"Loaded door configuration: auto_unlock={self.auto_unlock}, confidence={self.unlock_confidence}, duration={self.door_lock.lock_duration}")
            except Exception as e:
                print(f"Error loading config: {e}")
    
    def save_config(self) -> None:
        """Save door configuration"""
        try:
            config = {
                'auto_unlock': self.auto_unlock,
                'unlock_confidence': self.unlock_confidence,
                'lock_duration': self.door_lock.lock_duration
            }
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
            print("Door configuration saved")
        except Exception as e:
            print(f"Error saving config: {e}")
    
    async def broadcast_event(self, event_type: str, data: dict) -> None:
        """Broadcast event to all connected clients"""
        if not self.clients:
            return
            
        message = json.dumps({
            'type': event_type,
            'timestamp': datetime.now().isoformat(),
            'data': data
        })
        
        await asyncio.gather(
            *[client.send(message) for client in self.clients],
            return_exceptions=True
        )
    
    async def process_frame(self, frame) -> dict:
        """Process a single frame and return recognition results"""
        # Resize frame for faster processing
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        # Find faces and encodings
        face_locations = face_recognition.face_locations(rgb_small_frame, model=self.model)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)
        
        results = []
        for face_encoding, (top, right, bottom, left) in zip(face_encodings, face_locations):
            # Compare with known faces
            matches = face_recognition.compare_faces(
                self.known_face_encodings, 
                face_encoding, 
                tolerance=self.tolerance
            )
            name = "Unknown"
            confidence = 0.0
            is_authorized = False
            
            if len(self.known_face_encodings) > 0:
                face_distances = face_recognition.face_distance(
                    self.known_face_encodings, 
                    face_encoding
                )
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    name = self.known_face_names[best_match_index]
                    confidence = float(1 - face_distances[best_match_index])
                    is_authorized = name in self.authorized_users
                    
                    # Auto unlock door if conditions are met
                    if (self.auto_unlock and is_authorized and 
                        confidence >= self.unlock_confidence and 
                        not self.door_lock.is_unlocked):
                        
                        unlock_success = self.door_lock.unlock_door()
                        if unlock_success:
                            await self.broadcast_event('door_unlocked', {
                                'user': name,
                                'confidence': confidence,
                                'auto_unlock': True
                            })
                    
                    # Log recognition event
                    await self.log_recognition(name, confidence, is_authorized)
            
            # Scale coordinates back up
            results.append({
                'name': name,
                'confidence': confidence,
                'is_authorized': is_authorized,
                'location': {
                    'top': top * 4,
                    'right': right * 4,
                    'bottom': bottom * 4,
                    'left': left * 4
                }
            })
        
        return {
            'faces': results,
            'timestamp': datetime.now().isoformat(),
            'door_status': self.door_lock.get_status()
        }
    
    async def start_camera_stream(self) -> None:
        """Start camera stream and recognition"""
        if self.running:
            return
            
        try:
            # Try different camera indices
            for camera_index in [0, 1, 2]:
                self.camera = cv2.VideoCapture(camera_index)
                if self.camera.isOpened():
                    print(f"Successfully opened camera at index {camera_index}")
                    break
                else:
                    print(f"Failed to open camera at index {camera_index}")
                    self.camera.release()
            
            if not self.camera.isOpened():
                raise Exception("Failed to open any camera device")
            
            # Get camera properties
            width = self.camera.get(cv2.CAP_PROP_FRAME_WIDTH)
            height = self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT)
            fps = self.camera.get(cv2.CAP_PROP_FPS)
            print(f"Camera properties - Width: {width}, Height: {height}, FPS: {fps}")
            
            # Set camera properties
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            
            # Verify settings were applied
            new_width = self.camera.get(cv2.CAP_PROP_FRAME_WIDTH)
            new_height = self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT)
            new_fps = self.camera.get(cv2.CAP_PROP_FPS)
            print(f"New camera properties - Width: {new_width}, Height: {new_height}, FPS: {new_fps}")
            
            self.running = True
            print("Camera stream started successfully")
            
            frame_count = 0
            start_time = datetime.now()
            
            while self.running and self.clients:
                ret, frame = self.camera.read()
                if not ret:
                    print("Failed to read frame from camera")
                    # Try to reinitialize camera
                    self.camera.release()
                    self.camera = cv2.VideoCapture(0)
                    if not self.camera.isOpened():
                        raise Exception("Failed to reinitialize camera")
                    continue
                
                frame_count += 1
                elapsed_time = (datetime.now() - start_time).total_seconds()
                if elapsed_time >= 1.0:
                    print(f"Current FPS: {frame_count/elapsed_time:.2f}")
                    frame_count = 0
                    start_time = datetime.now()
                
                try:
                    # Process frame
                    results = await self.process_frame(frame)
                    
                    # Convert frame to JPEG with quality setting
                    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 85]
                    _, buffer = cv2.imencode('.jpg', frame, encode_param)
                    base64_frame = base64.b64encode(buffer).decode('utf-8')
                    
                    # Send frame and results to clients
                    await self.broadcast_event('frame', {
                        'image': base64_frame,
                        'results': results
                    })
                    
                except Exception as e:
                    print(f"Error processing frame: {e}")
                
                await asyncio.sleep(1/30)  # Cap at 30 FPS
                
        except Exception as e:
            print(f"Error in camera stream: {e}")
            print("Stack trace:", traceback.format_exc())
        finally:
            self.stop_camera_stream()
    
    def stop_camera_stream(self) -> None:
        """Stop camera stream"""
        self.running = False
        if self.camera:
            try:
                self.camera.release()
                print("Camera released successfully")
            except Exception as e:
                print(f"Error releasing camera: {e}")
            finally:
                self.camera = None
    
    async def add_client(self, websocket: websockets.WebSocketServerProtocol) -> None:
        """Add new WebSocket client"""
        self.clients.add(websocket)
        # Send current door status to new client
        await websocket.send(json.dumps({
            'type': 'door_status',
            'timestamp': datetime.now().isoformat(),
            'data': self.door_lock.get_status()
        }))
        
        if len(self.clients) == 1:
            # Start camera stream when first client connects
            asyncio.create_task(self.start_camera_stream())
    
    async def remove_client(self, websocket: websockets.WebSocketServerProtocol) -> None:
        """Remove WebSocket client"""
        self.clients.discard(websocket)
        if not self.clients:
            # Stop camera stream when last client disconnects
            self.stop_camera_stream()
    
    async def handle_websocket(self, websocket: websockets.WebSocketServerProtocol) -> None:
        """Handle WebSocket connection"""
        client_ip = websocket.remote_address[0]
        print(f"New WebSocket connection from {client_ip}")
        
        await self.add_client(websocket)
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    response = await self.handle_message(data)
                    if response:
                        await websocket.send(json.dumps(response))
                        
                except json.JSONDecodeError:
                    print(f"Invalid message format from {client_ip}")
                except Exception as e:
                    print(f"Error processing message from {client_ip}: {e}")
        except websockets.exceptions.ConnectionClosed as e:
            print(f"Connection closed for {client_ip}: {e}")
        except Exception as e:
            print(f"Unexpected error for {client_ip}: {e}")
        finally:
            await self.remove_client(websocket)
            print(f"Client {client_ip} disconnected")
    
    async def handle_message(self, data: dict) -> Optional[dict]:
        """Handle incoming WebSocket messages"""
        message_type = data.get('type')
        
        if message_type == 'add_user':
            result = await self.add_user(data['name'], data['image'], data.get('authorized', False))
            return {'type': 'user_add_response', 'data': result}
            
        elif message_type == 'remove_user':
            result = await self.remove_user(data['name'])
            return {'type': 'user_remove_response', 'data': result}
            
        elif message_type == 'unlock_door':
            duration = data.get('duration', None)
            success = self.door_lock.unlock_door(duration)
            if success:
                await self.broadcast_event('door_unlocked', {
                    'user': 'Manual',
                    'duration': duration or self.door_lock.lock_duration,
                    'auto_unlock': False
                })
            return {'type': 'unlock_response', 'data': {'success': success}}
            
        elif message_type == 'lock_door':
            success = self.door_lock.force_lock()
            if success:
                await self.broadcast_event('door_locked', {'manual': True})
            return {'type': 'lock_response', 'data': {'success': success}}
            
        elif message_type == 'get_door_status':
            return {'type': 'door_status', 'data': self.door_lock.get_status()}
            
        elif message_type == 'set_user_authorization':
            result = await self.set_user_authorization(data['name'], data['authorized'])
            return {'type': 'authorization_response', 'data': result}
            
        elif message_type == 'update_door_config':
            result = await self.update_door_config(data.get('config', {}))
            return {'type': 'config_response', 'data': result}
            
        elif message_type == 'get_users':
            users = [{'name': name, 'authorized': name in self.authorized_users} 
                    for name in self.known_face_names]
            return {'type': 'users_list', 'data': {'users': users}}
            
        elif message_type == 'ping':
            return {'type': 'pong'}
            
        return None
    
    async def add_user(self, name: str, image_data: str, authorized: bool = False) -> dict:
        """Add new user with base64 image data"""
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data.split(',')[1])
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Get face encoding
            face_locations = face_recognition.face_locations(rgb_image, model=self.model)
            if len(face_locations) != 1:
                return {'success': False, 'error': 'Expected one face, found none or multiple'}
            
            face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
            face_encoding = face_encodings[0]
            
            # Add to known faces
            self.known_face_encodings.append(face_encoding)
            self.known_face_names.append(name)
            
            if authorized:
                self.authorized_users.add(name)
            
            self.save_face_data()
            
            await self.broadcast_event('user_added', {
                'name': name, 
                'authorized': authorized
            })
            return {'success': True}
            
        except Exception as e:
            print(f"Error adding user: {e}")
            return {'success': False, 'error': str(e)}
    
    async def remove_user(self, name: str) -> dict:
        """Remove user from system"""
        try:
            if name in self.known_face_names:
                index = self.known_face_names.index(name)
                self.known_face_names.pop(index)
                self.known_face_encodings.pop(index)
                self.authorized_users.discard(name)
                self.save_face_data()
                
                await self.broadcast_event('user_removed', {'name': name})
                return {'success': True}
            return {'success': False, 'error': 'User not found'}
            
        except Exception as e:
            print(f"Error removing user: {e}")
            return {'success': False, 'error': str(e)}
    
    async def set_user_authorization(self, name: str, authorized: bool) -> dict:
        """Set user authorization status"""
        try:
            if name not in self.known_face_names:
                return {'success': False, 'error': 'User not found'}
            
            if authorized:
                self.authorized_users.add(name)
            else:
                self.authorized_users.discard(name)
            
            self.save_face_data()
            
            await self.broadcast_event('user_authorization_changed', {
                'name': name, 
                'authorized': authorized
            })
            return {'success': True}
            
        except Exception as e:
            print(f"Error setting user authorization: {e}")
            return {'success': False, 'error': str(e)}
    
    async def update_door_config(self, config: dict) -> dict:
        """Update door configuration"""
        try:
            if 'auto_unlock' in config:
                self.auto_unlock = bool(config['auto_unlock'])
            if 'unlock_confidence' in config:
                self.unlock_confidence = float(config['unlock_confidence'])
            if 'lock_duration' in config:
                self.door_lock.lock_duration = int(config['lock_duration'])
            
            self.save_config()
            
            await self.broadcast_event('config_updated', {
                'auto_unlock': self.auto_unlock,
                'unlock_confidence': self.unlock_confidence,
                'lock_duration': self.door_lock.lock_duration
            })
            return {'success': True}
            
        except Exception as e:
            print(f"Error updating config: {e}")
            return {'success': False, 'error': str(e)}
    
    async def log_recognition(self, name: str, confidence: float, is_authorized: bool) -> None:
        """Log recognition events"""
        try:
            log_entry = {
                'timestamp': datetime.now().isoformat(),
                'name': name,
                'confidence': confidence,
                'is_authorized': is_authorized,
                'door_unlocked': self.door_lock.is_unlocked
            }

            # Load existing logs
            logs = []
            if os.path.exists(self.log_file):
                try:
                    with open(self.log_file, 'r') as f:
                        # Check if file is empty before loading JSON
                        content = f.read()
                        if content:
                            logs = json.loads(content)
                        else:
                            print(f"Log file {self.log_file} is empty. Starting with empty log.")
                except json.JSONDecodeError:
                    print(f"Error decoding JSON from {self.log_file}. Starting with empty log.")
                    logs = [] # Initialize with empty list on error
                except Exception as e:
                    print(f"Unexpected error reading log file {self.log_file}: {e}")
                    logs = [] # Initialize with empty list on error

            # Add new entry and keep last 1000
            logs.append(log_entry)
            logs = logs[-1000:]

            # Save logs
            with open(self.log_file, 'w') as f:
                json.dump(logs, f, indent=2)

            # Broadcast recognition event
            await self.broadcast_event('recognition', log_entry)

        except Exception as e:
            # This catch is for errors *during* logging after initial load attempt
            print(f"Error logging recognition: {e}")
    
    def cleanup(self):
        """Cleanup resources"""
        print("Cleaning up resources...")
        self.stop_camera_stream()
        self.door_lock.cleanup()

async def main():
    """Main function to run the WebSocket server"""
    system = FaceRecognitionSystem()
    
    try:
        async with websockets.serve(
            system.handle_websocket,
            "0.0.0.0",
            8765,
            ping_interval=30,  # Add ping interval to keep connections alive
            ping_timeout=10
        ):
            print("WebSocket server started at ws://0.0.0.0:8765")
            print("Door lock system ready")
            print("Waiting for connections...")
            await asyncio.Future()  # run forever
    except Exception as e:
        print(f"Failed to start WebSocket server: {e}")
    finally:
        system.cleanup()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down...")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Ensure GPIO cleanup on exit
        try:
            GPIO.cleanup()
        except:
            pass 