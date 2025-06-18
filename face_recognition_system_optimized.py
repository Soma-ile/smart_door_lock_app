#!/usr/bin/env python3
"""
Face Recognition System for Raspberry Pi with WebSocket Support and Door Lock Control
Optimized version with improved performance for video streaming
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
import psutil  # For monitoring system resources

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
        self.user_photos = {}  # Store user profile photos
        self.data_file = 'face_data.pkl'
        self.log_file = 'recognition_log.json'
        self.config_file = 'door_config.json'
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.camera = None
        self.running = False
        
        # Performance settings
        self.target_fps = 10  # Lower target FPS to reduce CPU load
        self.frame_interval = 1.0 / self.target_fps
        self.recognition_interval = 20  # Only perform recognition every N frames (increased from 5)
        self.frame_count = 0
        self.last_frame_time = 0
        self.jpeg_quality = 60  # Lower quality for better network performance
        self.max_width = 320  # Smaller frame size for better performance
        self.adaptive_quality = True  # Dynamically adjust quality based on system load
        
        # Client bandwidth tracking
        self.client_bandwidth = {}  # Track bandwidth per client
        self.bandwidth_check_interval = 5  # Check bandwidth every 5 seconds
        self.last_bandwidth_check = time.time()
        
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

    def save_face_data_with_photos(self) -> None:
        """Save face encodings, names, and photos to file"""
        try:
            data = {
                'encodings': self.known_face_encodings,
                'names': self.known_face_names,
                'authorized_users': list(self.authorized_users),
                'photos': getattr(self, 'user_photos', {})
            }
            with open(self.data_file, 'wb') as f:
                pickle.dump(data, f)
            print(f"Saved {len(self.known_face_names)} faces with photos to {self.data_file}")
        except Exception as e:
            print(f"Error saving face data with photos: {e}")

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
                    # Load user photos if available
                    if 'photos' in data:
                        self.user_photos = data['photos']
                    else:
                        self.user_photos = {}
                print(f"Loaded {len(self.known_face_names)} known faces")
                print(f"Authorized users: {list(self.authorized_users)}")
            except Exception as e:
                print(f"Error loading face data: {e}")
                self.known_face_encodings = []
                self.known_face_names = []
                self.authorized_users = set()
                self.user_photos = {}
    
    def load_config(self) -> None:
        """Load door configuration"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    self.auto_unlock = config.get('auto_unlock', True)
                    self.unlock_confidence = config.get('unlock_confidence', 0.8)
                    self.door_lock.lock_duration = config.get('lock_duration', 5)
                    
                    # Load performance settings if available
                    self.target_fps = config.get('target_fps', self.target_fps)
                    self.recognition_interval = config.get('recognition_interval', self.recognition_interval)
                    self.jpeg_quality = config.get('jpeg_quality', self.jpeg_quality)
                    self.max_width = config.get('max_width', self.max_width)
                    self.adaptive_quality = config.get('adaptive_quality', self.adaptive_quality)
                    
                print(f"Loaded door configuration: auto_unlock={self.auto_unlock}, confidence={self.unlock_confidence}, duration={self.door_lock.lock_duration}")
                print(f"Performance settings: target_fps={self.target_fps}, recognition_interval={self.recognition_interval}, jpeg_quality={self.jpeg_quality}")
            except Exception as e:
                print(f"Error loading config: {e}")
    
    def save_config(self) -> None:
        """Save door configuration"""
        try:
            config = {
                'auto_unlock': self.auto_unlock,
                'unlock_confidence': self.unlock_confidence,
                'lock_duration': self.door_lock.lock_duration,
                'target_fps': self.target_fps,
                'recognition_interval': self.recognition_interval,
                'jpeg_quality': self.jpeg_quality,
                'max_width': self.max_width,
                'adaptive_quality': self.adaptive_quality
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
    
    def adjust_quality_based_on_load(self):
        """Dynamically adjust quality settings based on system load"""
        if not self.adaptive_quality:
            return self.jpeg_quality
            
        cpu_percent = psutil.cpu_percent()
        memory_percent = psutil.virtual_memory().percent
        
        # Adjust quality based on system load
        if cpu_percent > 90 or memory_percent > 90:
            # System under heavy load, reduce quality significantly
            return max(30, self.jpeg_quality - 20)
        elif cpu_percent > 75 or memory_percent > 75:
            # System under moderate load, reduce quality moderately
            return max(40, self.jpeg_quality - 10)
        elif cpu_percent < 50 and memory_percent < 50:
            # System under light load, can increase quality
            return min(85, self.jpeg_quality + 5)
        else:
            # System under normal load, use default quality
            return self.jpeg_quality
    
    async def process_frame(self, frame, force_recognition=False) -> dict:
        """Process a single frame and return recognition results"""
        loop = asyncio.get_event_loop()
        
        # Resize frame if needed (this is quick, can stay in main thread)
        height, width = frame.shape[:2]
        if width > self.max_width:
            scale = self.max_width / width
            frame = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
        
        # Only perform recognition on certain frames to reduce CPU load
        perform_recognition = force_recognition or (self.frame_count % self.recognition_interval == 0)
        results = []
        
        if perform_recognition:
            # Resize frame for faster processing (these operations are quick)
            small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
            rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            
            # Run CPU-intensive face detection in thread pool
            face_locations = await loop.run_in_executor(
                None,  # Uses default ThreadPoolExecutor
                lambda: face_recognition.face_locations(rgb_small_frame, model=self.model)
            )
            
            # Only run encodings if faces are found
            if face_locations:
                face_encodings = await loop.run_in_executor(
                    None,
                    lambda: face_recognition.face_encodings(rgb_small_frame, face_locations)
                )
            else:
                face_encodings = []
            
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
            
            # Set camera properties - use lower resolution
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, self.target_fps)
            
            # Set buffer size to 1 to avoid frame lag
            self.camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            # Verify settings were applied
            new_width = self.camera.get(cv2.CAP_PROP_FRAME_WIDTH)
            new_height = self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT)
            new_fps = self.camera.get(cv2.CAP_PROP_FPS)
            print(f"New camera properties - Width: {new_width}, Height: {new_height}, FPS: {new_fps}")
            
            self.running = True
            print("Camera stream started successfully")
            
            frame_count = 0
            start_time = datetime.now()
            last_frame_time = time.time()
            
            while self.running and self.clients:
                # Implement frame rate control
                current_time = time.time()
                elapsed = current_time - last_frame_time
                
                if elapsed < self.frame_interval:
                    # Wait until it's time for the next frame
                    await asyncio.sleep(self.frame_interval - elapsed)
                    continue
                
                last_frame_time = current_time
                
                # Read frame
                ret, frame = self.camera.read()
                if not ret:
                    print("Failed to read frame from camera")
                    # Try to reinitialize camera
                    self.camera.release()
                    await asyncio.sleep(1)  # Wait before retrying
                    self.camera = cv2.VideoCapture(0)
                    self.camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    if not self.camera.isOpened():
                        print("Failed to reinitialize camera, retrying in 5 seconds")
                        await asyncio.sleep(5)
                    continue
                
                # Update frame counter
                self.frame_count += 1
                frame_count += 1
                elapsed_time = (datetime.now() - start_time).total_seconds()
                if elapsed_time >= 1.0:
                    current_fps = frame_count/elapsed_time
                    print(f"Current FPS: {current_fps:.2f}")
                    frame_count = 0
                    start_time = datetime.now()
                
                try:
                    # Process frame
                    results = await self.process_frame(frame)
                    
                    # Check system load and adjust quality
                    quality = self.adjust_quality_based_on_load()
                    
                    # Convert frame to JPEG with quality setting - run in thread pool
                    loop = asyncio.get_event_loop()
                    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
                    
                    # Run JPEG encoding in thread pool
                    ret_encode, buffer = await loop.run_in_executor(
                        None, 
                        lambda: cv2.imencode('.jpg', frame, encode_param)
                    )
                    
                    if not ret_encode:
                        print("JPEG encoding failed")
                        continue
                    
                    # Run base64 encoding in thread pool
                    base64_bytes = await loop.run_in_executor(
                        None,
                        lambda: base64.b64encode(buffer)
                    )
                    
                    # Decode is fast, can stay in main thread
                    base64_frame = base64_bytes.decode('utf-8')
                    
                    # Check if we need to update bandwidth stats
                    current_time = time.time()
                    if current_time - self.last_bandwidth_check >= self.bandwidth_check_interval:
                        self.last_bandwidth_check = current_time
                        print(f"Current JPEG quality: {quality}, Frame size: {len(buffer)} bytes")
                    
                    # Draw face detection boxes and confidence on frame
                    annotated_frame = self.draw_face_annotations(frame, results)
                    
                    # Convert annotated frame to JPEG with quality setting - run in thread pool
                    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
                    
                    # Run JPEG encoding in thread pool for annotated frame
                    ret_encode_annotated, buffer_annotated = await loop.run_in_executor(
                        None, 
                        lambda: cv2.imencode('.jpg', annotated_frame, encode_param)
                    )
                    
                    if ret_encode_annotated:
                        # Use annotated frame if encoding succeeded
                        base64_bytes_annotated = await loop.run_in_executor(
                            None,
                            lambda: base64.b64encode(buffer_annotated)
                        )
                        base64_annotated_frame = base64_bytes_annotated.decode('utf-8')
                        
                        # Send annotated frame and results to clients
                        await self.broadcast_event('frame', {
                            'image': base64_annotated_frame,
                            'results': results
                        })
                    else:
                        # Fallback to original frame if annotation encoding failed
                        await self.broadcast_event('frame', {
                            'image': base64_frame,
                            'results': results
                        })
                    
                except Exception as e:
                    print(f"Error processing frame: {e}")
                
                # No need for additional sleep as we're already controlling frame rate
                
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
        client_ip = websocket.remote_address[0]
        self.client_bandwidth[client_ip] = {
            'bytes_sent': 0,
            'last_check': time.time()
        }
        
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
        client_ip = websocket.remote_address[0]
        if client_ip in self.client_bandwidth:
            del self.client_bandwidth[client_ip]
            
        if not self.clients:
            # Stop camera stream when last client disconnects
            self.stop_camera_stream()
    
    async def handle_websocket(self, websocket: websockets.WebSocketServerProtocol) -> None:
        """Handle WebSocket connection"""
        client_ip = websocket.remote_address[0]
        print(f"New WebSocket connection from {client_ip}")
        
        # Don't set max_size directly on the websocket as it can cause handshake issues
        
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
            result = await self.add_user(data['name'], data['image'], data.get('authorized', True))
            return {'type': 'user_added', 'data': result}
            
        elif message_type == 'remove_user':
            # Frontend sends either 'id' or 'name', backend remove_user expects name
            user_identifier = data.get('id') or data.get('name')
            result = await self.remove_user(user_identifier)
            return {'type': 'user_removed', 'data': result}
            
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
            users = [{'name': name, 'authorized': name in self.authorized_users, 'photo': self.user_photos.get(name, '')} 
                    for name in self.known_face_names]
            return {'type': 'users_list', 'data': {'users': users}}
            
        elif message_type == 'ping':
            return {'type': 'pong'}
            
        elif message_type == 'update_performance_settings':
            result = await self.update_performance_settings(data.get('settings', {}))
            return {'type': 'performance_settings_response', 'data': result}
            
        elif message_type == 'capture_webcam_photo':
            result = await self.capture_webcam_photo()
            return {'type': 'webcam_capture_response', 'data': result}
            
        elif message_type == 'add_user_from_webcam':
            result = await self.add_user_from_webcam(data['name'])
            return {'type': 'user_added_from_webcam', 'data': result}
            
        return None
    
    async def update_performance_settings(self, settings: dict) -> dict:
        """Update performance settings"""
        try:
            if 'target_fps' in settings:
                self.target_fps = float(settings['target_fps'])
                self.frame_interval = 1.0 / self.target_fps
            if 'recognition_interval' in settings:
                self.recognition_interval = int(settings['recognition_interval'])
            if 'jpeg_quality' in settings:
                self.jpeg_quality = int(settings['jpeg_quality'])
            if 'max_width' in settings:
                self.max_width = int(settings['max_width'])
            if 'adaptive_quality' in settings:
                self.adaptive_quality = bool(settings['adaptive_quality'])
            
            self.save_config()
            
            return {
                'success': True,
                'settings': {
                    'target_fps': self.target_fps,
                    'recognition_interval': self.recognition_interval,
                    'jpeg_quality': self.jpeg_quality,
                    'max_width': self.max_width,
                    'adaptive_quality': self.adaptive_quality
                }
            }
        except Exception as e:
            print(f"Error updating performance settings: {e}")
            return {'success': False, 'error': str(e)}
    
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
            print(f"Attempting to remove user: '{name}'")
            print(f"Known users: {self.known_face_names}")
            
            if name in self.known_face_names:
                index = self.known_face_names.index(name)
                print(f"Found user at index: {index}")
                
                self.known_face_names.pop(index)
                self.known_face_encodings.pop(index)
                self.authorized_users.discard(name)
                self.save_face_data()
                
                print(f"Successfully removed user: '{name}'")
                await self.broadcast_event('user_removed', {'name': name})
                return {'success': True}
            else:
                print(f"User '{name}' not found in known users")
                return {'success': False, 'error': 'User not found'}
            
        except Exception as e:
            print(f"Error removing user '{name}': {e}")
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
    
    async def capture_webcam_photo(self) -> dict:
        """Capture a single photo from the webcam"""
        try:
            if not self.camera or not self.camera.isOpened():
                # Try to open camera if not already open
                for camera_index in [0, 1, 2]:
                    self.camera = cv2.VideoCapture(camera_index)
                    if self.camera.isOpened():
                        print(f"Successfully opened camera at index {camera_index}")
                        break
                    else:
                        self.camera.release()
                
                if not self.camera or not self.camera.isOpened():
                    return {'success': False, 'error': 'Failed to open camera'}
                
                # Set camera properties
                self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            # Capture frame
            ret, frame = self.camera.read()
            if not ret:
                return {'success': False, 'error': 'Failed to capture frame'}
            
            # Convert frame to JPEG
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 85]
            ret_encode, buffer = cv2.imencode('.jpg', frame, encode_param)
            
            if not ret_encode:
                return {'success': False, 'error': 'Failed to encode image'}
            
            # Convert to base64
            base64_image = base64.b64encode(buffer).decode('utf-8')
            
            return {
                'success': True,
                'image': f'data:image/jpeg;base64,{base64_image}'
            }
            
        except Exception as e:
            print(f"Error capturing webcam photo: {e}")
            return {'success': False, 'error': str(e)}
    
    async def add_user_from_webcam(self, name: str, authorized: bool = True) -> dict:
        """Add user by capturing photo directly from webcam"""
        try:
            if not self.camera or not self.camera.isOpened():
                # Try to open camera if not already open
                for camera_index in [0, 1, 2]:
                    self.camera = cv2.VideoCapture(camera_index)
                    if self.camera.isOpened():
                        print(f"Successfully opened camera at index {camera_index}")
                        break
                    else:
                        self.camera.release()
                
                if not self.camera or not self.camera.isOpened():
                    return {'success': False, 'error': 'Failed to open camera'}
                
                # Set camera properties
                self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            # Capture frame
            ret, frame = self.camera.read()
            if not ret:
                return {'success': False, 'error': 'Failed to capture frame'}
            
            # Convert to RGB for face recognition
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Detect faces
            face_locations = face_recognition.face_locations(rgb_frame, model=self.model)
            if len(face_locations) != 1:
                return {'success': False, 'error': f'Expected one face, found {len(face_locations)}. Please ensure only one person is visible.'}
            
            # Get face encoding
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
            if not face_encodings:
                return {'success': False, 'error': 'Failed to encode face'}
            
            face_encoding = face_encodings[0]
            
            # Check if this face is already known
            if len(self.known_face_encodings) > 0:
                matches = face_recognition.compare_faces(
                    self.known_face_encodings, 
                    face_encoding, 
                    tolerance=self.tolerance
                )
                if any(matches):
                    # Find the best match
                    face_distances = face_recognition.face_distance(
                        self.known_face_encodings, 
                        face_encoding
                    )
                    best_match_index = np.argmin(face_distances)
                    existing_name = self.known_face_names[best_match_index]
                    return {'success': False, 'error': f'This face is already registered as "{existing_name}"'}
            
            # Extract and save face photo for profile
            top, right, bottom, left = face_locations[0]
            # Add some padding around the face
            padding = 30
            face_crop = frame[max(0, top-padding):min(frame.shape[0], bottom+padding), 
                             max(0, left-padding):min(frame.shape[1], right+padding)]
            
            # Convert face crop to base64 for storage
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 85]
            ret_encode, buffer = cv2.imencode('.jpg', face_crop, encode_param)
            
            face_photo_b64 = None
            if ret_encode:
                face_photo_b64 = base64.b64encode(buffer).decode('utf-8')
            
            # Add to known faces
            self.known_face_encodings.append(face_encoding)
            self.known_face_names.append(name)
            
            # Store face photo
            if face_photo_b64:
                self.user_photos[name] = f'data:image/jpeg;base64,{face_photo_b64}'
            
            # Set authorization
            if authorized:
                self.authorized_users.add(name)
            
            # Save face data with photo
            self.save_face_data_with_photos()
            
            # Broadcast event
            await self.broadcast_event('user_added', {
                'name': name, 
                'authorized': authorized,
                'method': 'webcam',
                'photo': face_photo_b64
            })
            
            print(f"Successfully added user '{name}' from webcam with profile photo")
            return {'success': True, 'message': f'User "{name}" added successfully'}
            
        except Exception as e:
            print(f"Error adding user from webcam: {e}")
            return {'success': False, 'error': str(e)}

    def draw_face_annotations(self, frame, results):
        """Draw face detection rectangles and confidence scores on frame"""
        annotated_frame = frame.copy()
        
        if not results or 'faces' not in results:
            return annotated_frame
            
        height, width = annotated_frame.shape[:2]
        
        for face in results['faces']:
            if 'location' not in face:
                continue
                
            location = face['location']
            name = face.get('name', 'Unknown')
            confidence = face.get('confidence', 0.0)
            is_authorized = face.get('is_authorized', False)
            
            # Get face coordinates
            top = max(0, int(location['top']))
            right = min(width, int(location['right']))
            bottom = min(height, int(location['bottom']))
            left = max(0, int(location['left']))
            
            # Choose colors based on authorization status
            if name == "Unknown":
                # Red for unknown faces
                box_color = (0, 0, 255)  # BGR format
                text_color = (255, 255, 255)
                text_bg_color = (0, 0, 255)
            elif is_authorized:
                # Green for authorized users
                box_color = (0, 255, 0)
                text_color = (0, 0, 0)
                text_bg_color = (0, 255, 0)
            else:
                # Orange for unauthorized users
                box_color = (0, 165, 255)
                text_color = (255, 255, 255)
                text_bg_color = (0, 165, 255)
            
            # Draw face rectangle with thicker border
            cv2.rectangle(annotated_frame, (left, top), (right, bottom), box_color, 3)
            
            # Prepare text with confidence percentage
            if confidence > 0:
                display_text = f"{name} ({confidence*100:.1f}%)"
            else:
                display_text = name
            
            # Calculate text size
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.7
            thickness = 2
            (text_width, text_height), baseline = cv2.getTextSize(display_text, font, font_scale, thickness)
            
            # Draw text background rectangle
            text_x = left
            text_y = top - 10
            
            # Ensure text stays within frame bounds
            if text_y < text_height + baseline:
                text_y = bottom + text_height + 10
            
            cv2.rectangle(annotated_frame, 
                         (text_x, text_y - text_height - baseline), 
                         (text_x + text_width, text_y + baseline), 
                         text_bg_color, -1)
            
            # Draw text
            cv2.putText(annotated_frame, display_text, (text_x, text_y), 
                       font, font_scale, text_color, thickness)
            
            # Add authorization status indicator (small circle in corner)
            if name != "Unknown":
                indicator_radius = 8
                indicator_x = right - indicator_radius - 5
                indicator_y = top + indicator_radius + 5
                
                if is_authorized:
                    # Green checkmark area
                    cv2.circle(annotated_frame, (indicator_x, indicator_y), indicator_radius, (0, 255, 0), -1)
                    cv2.circle(annotated_frame, (indicator_x, indicator_y), indicator_radius, (0, 0, 0), 2)
                else:
                    # Red X area
                    cv2.circle(annotated_frame, (indicator_x, indicator_y), indicator_radius, (0, 0, 255), -1)
                    cv2.circle(annotated_frame, (indicator_x, indicator_y), indicator_radius, (255, 255, 255), 2)
        
        # Add overall confidence display in bottom right corner
        if results['faces']:
            # Find the highest confidence face for overall display
            max_confidence = max(face.get('confidence', 0.0) for face in results['faces'])
            recognized_faces = [f for f in results['faces'] if f.get('name', 'Unknown') != 'Unknown']
            
            if max_confidence > 0 and recognized_faces:
                # Display overall accuracy in bottom right
                accuracy_text = f"Accuracy: {max_confidence*100:.1f}%"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.8
                thickness = 2
                
                (acc_text_width, acc_text_height), acc_baseline = cv2.getTextSize(
                    accuracy_text, font, font_scale, thickness)
                
                # Position in bottom right corner
                acc_x = width - acc_text_width - 15
                acc_y = height - 15
                
                # Background rectangle for better readability
                cv2.rectangle(annotated_frame,
                             (acc_x - 10, acc_y - acc_text_height - acc_baseline - 5),
                             (acc_x + acc_text_width + 10, acc_y + acc_baseline + 5),
                             (0, 0, 0), -1)
                
                # White text with black background
                cv2.putText(annotated_frame, accuracy_text, (acc_x, acc_y),
                           font, font_scale, (255, 255, 255), thickness)
        
        return annotated_frame

    def cleanup(self):
        """Cleanup resources"""
        print("Cleaning up resources...")
        self.stop_camera_stream()
        self.door_lock.cleanup()

async def main():
    """Main function to run the WebSocket server"""
    # Install psutil if not already installed
    try:
        import psutil
    except ImportError:
        import subprocess
        import sys
        print("Installing psutil package...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
        import psutil
    
    system = FaceRecognitionSystem()
    
    try:
        # Set up WebSocket server with more conservative settings
        async with websockets.serve(
            system.handle_websocket,
            "0.0.0.0",
            8765,
            ping_interval=None,  # Disable ping to avoid potential issues
            max_size=None  # Let websockets library handle message size
        ):
            print("WebSocket server started at ws://0.0.0.0:8765")
            print("Door lock system ready")
            print("Performance settings:")
            print(f"- Target FPS: {system.target_fps}")
            print(f"- Recognition interval: Every {system.recognition_interval} frames")
            print(f"- JPEG quality: {system.jpeg_quality}")
            print(f"- Max frame width: {system.max_width}px")
            print(f"- Adaptive quality: {'Enabled' if system.adaptive_quality else 'Disabled'}")
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
