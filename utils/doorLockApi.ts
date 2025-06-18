import { Platform } from 'react-native';
import { AccessEvent, User } from './mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IP_ADDRESS_KEY = '@settings/raspberry_pi_ip';

// Initialize with default IP, will be updated from settings
let SERVER_IP = '192.168.40.179';

// Function to get WebSocket URL based on platform and environment
const getWebSocketUrl = (ip: string) => Platform.select({
  web: `wss://${ip}:8765`,
  default: __DEV__ ? `ws://${ip}:8765` : `wss://${ip}:8765`
});

type EventCallback = (data: any) => void;

class DoorLockApi {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  constructor() {
    this.loadSavedIP();
  }

  private async loadSavedIP() {
    try {
      const savedIP = await AsyncStorage.getItem(IP_ADDRESS_KEY);
      if (savedIP) {
        SERVER_IP = savedIP;
      }
    } catch (error) {
      console.error('Error loading saved IP:', error);
    }
  }

  updateServerAddress(ip: string) {
    SERVER_IP = ip;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;
    console.log('Connecting to WebSocket server...');

    try {
      this.ws = new WebSocket(getWebSocketUrl(SERVER_IP));

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.emit('connectionStatus', { status: 'connected' });
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.emit('connectionStatus', { status: 'disconnected' });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
          console.log(`Reconnecting in ${backoffTime/1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          this.reconnectTimer = setTimeout(() => this.connect(), backoffTime);
        } else {
          console.log('Max reconnection attempts reached');
          this.emit('connectionStatus', { 
            status: 'failed',
            error: 'Maximum reconnection attempts reached'
          });
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', { 
          error,
          message: Platform.OS === 'web'
            ? 'Connection failed. Please ensure the server is running and accessible.'
            : 'Connection failed. Please check your network connection.'
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', message.type, message.data);
          this.emit(message.type, message.data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          console.log('Raw message data:', event.data);
        }
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
    }
  }

  reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  on(event: string, callback: EventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }

  off(event: string, callback: EventCallback) {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.eventListeners.get(event)?.forEach(callback => callback(data));
  }

  // Security notification methods
  onSecurityEvent(callback: (event: any) => void) {
    this.on('recognition', callback);
    this.on('door_unlocked', callback);
    this.on('door_locked', callback);
    this.on('motion_detected', callback);
    this.on('security_alert', callback);
  }

  offSecurityEvent(callback: (event: any) => void) {
    this.off('recognition', callback);
    this.off('door_unlocked', callback);
    this.off('door_locked', callback);
    this.off('motion_detected', callback);
    this.off('security_alert', callback);
  }

  async addUser(name: string, imageBase64: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Add user timeout'));
      }, 20000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('user_added', handleResponse);
        this.off('error', handleError);
        
        console.log('✅ Received user_added response:', data);
        console.log('✅ Response data:', JSON.stringify(data, null, 2));
        
        if (data.success) {
          console.log('✅ User addition successful');
          resolve(true);
        } else {
          console.log('❌ User addition failed:', data.error);
          reject(new Error(data.error || 'Failed to add user'));
        }
      };

      // Also listen for any error events
      const handleError = (data: any) => {
        clearTimeout(timeout);
        this.off('user_added', handleResponse);
        this.off('error', handleError);
        console.log('❌ Connection error during user addition:', data);
        reject(new Error(data.message || 'Connection error during user addition'));
      };

      // Listen for the response
      this.on('user_added', handleResponse);
      this.on('error', handleError);
      
      // Add a generic message listener to catch any response
      const handleAnyMessage = (type: string, data: any) => {
        if (type.includes('user') || type.includes('add') || type.includes('response')) {
          console.log('🔍 Potentially relevant message:', type, data);
        }
      };
      
      // Listen for ALL messages for 5 seconds to see what's being sent
      const originalEmit = this.emit.bind(this);
      this.emit = (type: string, data: any) => {
        handleAnyMessage(type, data);
        originalEmit(type, data);
      };
      
      // Restore original emit after timeout
      setTimeout(() => {
        this.emit = originalEmit;
      }, 5000);

      console.log('Sending add_user message for:', name);
      console.log('Image data format:', imageBase64.substring(0, 100));
      console.log('Image data length:', imageBase64.length);
      console.log('Has data URI prefix:', imageBase64.startsWith('data:'));
      
      this.ws!.send(JSON.stringify({
        type: 'add_user',
        name,
        image: imageBase64,
        authorized: true
      }));
    });
  }

  async removeUser(userName: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Remove user timeout'));
      }, 15000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('user_removed', handleResponse);
        
        console.log('Received user_removed response:', data);
        console.log('Response data:', JSON.stringify(data, null, 2));
        
        if (data.success) {
          resolve(true);
        } else {
          reject(new Error(data.error || 'Failed to remove user'));
        }
      };

      this.on('user_removed', handleResponse);

      console.log('Sending remove_user message for userName:', userName);
      this.ws!.send(JSON.stringify({
        type: 'remove_user',
        name: userName  // Backend expects name field
      }));
    });
  }

  async unlockDoor(duration?: number): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Unlock door timeout'));
      }, 5000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('unlock_response', handleResponse);
        resolve(data.success);
      };

      this.on('unlock_response', handleResponse);

      this.ws!.send(JSON.stringify({
        type: 'unlock_door',
        duration
      }));
    });
  }

  async lockDoor(): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Lock door timeout'));
      }, 5000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('lock_response', handleResponse);
        resolve(data.success);
      };

      this.on('lock_response', handleResponse);

      this.ws!.send(JSON.stringify({
        type: 'lock_door'
      }));
    });
  }

  async updatePerformanceSettings(settings: {
    target_fps: number;
    recognition_interval: number;
    jpeg_quality: number;
    max_width: number;
    adaptive_quality: boolean;
  }): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Update performance settings timeout'));
      }, 5000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('performance_settings_response', handleResponse);
        resolve(data.success);
      };

      this.on('performance_settings_response', handleResponse);

      this.ws!.send(JSON.stringify({
        type: 'update_performance_settings',
        settings
      }));
    });
  }

  async captureWebcamPhoto(): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Capture webcam photo timeout'));
      }, 10000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('webcam_capture_response', handleResponse);
        
        if (data.success && data.image) {
          resolve(data.image);
        } else {
          reject(new Error(data.error || 'Failed to capture photo'));
        }
      };

      this.on('webcam_capture_response', handleResponse);

      this.ws!.send(JSON.stringify({
        type: 'capture_webcam_photo'
      }));
    });
  }

  async addUserFromWebcam(name: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Add user from webcam timeout'));
      }, 15000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('user_added_from_webcam', handleResponse);
        
        if (data.success) {
          resolve(true);
        } else {
          reject(new Error(data.error || 'Failed to add user from webcam'));
        }
      };

      this.on('user_added_from_webcam', handleResponse);

      this.ws!.send(JSON.stringify({
        type: 'add_user_from_webcam',
        name
      }));
    });
  }

  async getUsers(): Promise<any[]> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Get users timeout'));
      }, 5000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('users_list', handleResponse);
        resolve(data.users || []);
      };

      this.on('users_list', handleResponse);

      this.ws!.send(JSON.stringify({
        type: 'get_users'
      }));
    });
  }

  async getAccessHistory(): Promise<any[]> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Get access history timeout'));
      }, 5000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('access_history', handleResponse);
        resolve(data.history || []);
      };

      this.on('access_history', handleResponse);

      this.ws!.send(JSON.stringify({
        type: 'get_access_history'
      }));
    });
  }
}

// Create a singleton instance
export const doorLockApi = new DoorLockApi();
