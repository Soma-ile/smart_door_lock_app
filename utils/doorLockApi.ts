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
          this.emit(message.type, message.data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
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

  async addUser(name: string, imageBase64: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Add user timeout'));
      }, 10000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('user_added', handleResponse);
        resolve(data.success);
      };

      this.on('user_added', handleResponse);

      this.ws.send(JSON.stringify({
        type: 'add_user',
        name,
        image: imageBase64
      }));
    });
  }

  async removeUser(userId: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Remove user timeout'));
      }, 10000);

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.off('user_removed', handleResponse);
        resolve(data.success);
      };

      this.on('user_removed', handleResponse);

      this.ws.send(JSON.stringify({
        type: 'remove_user',
        id: userId
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

      this.ws.send(JSON.stringify({
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

      this.ws.send(JSON.stringify({
        type: 'lock_door'
      }));
    });
  }
}

// Create a singleton instance
export const doorLockApi = new DoorLockApi();