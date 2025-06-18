import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Platform, Modal, Alert } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings as SettingsIcon, Save, RefreshCw, Sliders, Bell, Shield, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { PerformanceSettings } from '@/components/PerformanceSettings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doorLockApi } from '@/utils/doorLockApi';
import * as Notifications from 'expo-notifications';

const IP_ADDRESS_KEY = '@settings/raspberry_pi_ip';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function SettingsScreen() {
  const [ipAddress, setIpAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'failed'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [showPerformanceSettings, setShowPerformanceSettings] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  useEffect(() => {
    loadSavedIP();
    checkNotificationPermissions();
    
    // Listen for connection status changes
    doorLockApi.on('connectionStatus', (data) => {
      setConnectionStatus(data.status);
      setIsConnecting(false);
      if (data.error) {
        setError(data.error);
      } else {
        setError(null);
      }
    });

    return () => {
      doorLockApi.off('connectionStatus', () => {});
    };
  }, []);

  const loadSavedIP = async () => {
    try {
      const savedIP = await AsyncStorage.getItem(IP_ADDRESS_KEY);
      if (savedIP) {
        setIpAddress(savedIP);
      }
    } catch (error) {
      console.error('Error loading saved IP:', error);
    }
  };

  const checkNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationPermission(status);
    } catch (error) {
      console.error('Error checking notification permissions:', error);
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(status);
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  const sendTestNotification = async (type: 'security' | 'access' | 'system') => {
    setIsSendingNotification(true);
    
    try {
      // Check and request permissions if needed
      if (notificationPermission !== 'granted') {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          if (Platform.OS === 'web') {
            alert('Notification permissions are required to send test notifications');
          } else {
            Alert.alert('Permission Required', 'Notification permissions are required to send test notifications');
          }
          setIsSendingNotification(false);
          return;
        }
      }

      let title, body, data;

      switch (type) {
        case 'security':
          title = 'Security Alert';
          body = 'Unauthorized access attempt detected. Unknown person tried to enter at the front door.';
          data = {
            type: 'security_alert',
            severity: 'high',
            location: 'Front Door',
            timestamp: new Date().toISOString(),
          };
          break;
        case 'access':
          title = 'Access Granted';
          body = 'Door unlocked successfully. Chioma Okwu has entered the building.';
          data = {
            type: 'access_granted',
            user: 'Chioma Okwu',
            location: 'Front Door',
            timestamp: new Date().toISOString(),
          };
          break;
        case 'system':
          title = 'System Update';
          body = 'Smart door lock system is now online and monitoring. All sensors active.';
          data = {
            type: 'system_status',
            status: 'online',
            timestamp: new Date().toISOString(),
          };
          break;
        default:
          throw new Error('Invalid notification type');
      }

      // Schedule the notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: type === 'security' ? Notifications.AndroidNotificationPriority.HIGH : Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null, // Send immediately
      });

      // Show success message
      if (Platform.OS === 'web') {
        alert(`Test ${type} notification sent successfully!`);
      } else {
        Alert.alert('Success', `Test ${type} notification sent successfully!`);
      }

    } catch (error) {
      console.error('Error sending test notification:', error);
      
      if (Platform.OS === 'web') {
        alert('Failed to send test notification. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to send test notification. Please try again.');
      }
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleSave = async () => {
    try {
      await AsyncStorage.setItem(IP_ADDRESS_KEY, ipAddress);
      setIsConnecting(true);
      setError(null);
      
      // Update the WebSocket URL and reconnect
      doorLockApi.updateServerAddress(ipAddress);
      doorLockApi.reconnect();
    } catch (error) {
      console.error('Error saving IP:', error);
      setError('Failed to save IP address');
    }
  };

  const handleReconnect = () => {
    setIsConnecting(true);
    setError(null);
    doorLockApi.reconnect();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Card style={styles.card} elevated>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SettingsIcon size={20} color="#00D4FF" />
            <Text style={styles.sectionTitle}>Raspberry Pi Connection</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>IP Address</Text>
            <TextInput
              style={styles.input}
              value={ipAddress}
              onChangeText={setIpAddress}
              placeholder="Enter Raspberry Pi IP address"
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text style={[
              styles.statusText,
              { color: connectionStatus === 'connected' ? '#00FF88' : 
                       connectionStatus === 'failed' ? '#FF3B30' : '#8E8E93' }
            ]}>
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'failed' ? 'Failed' : 'Disconnected'}
            </Text>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <View style={styles.buttonContainer}>
            <Button
              title="Save & Connect"
              variant="primary"
              onPress={handleSave}
              disabled={isConnecting || !ipAddress}
              icon={<Save size={18} color="#121214" />}
              style={styles.button}
            />
            <Button
              title="Reconnect"
              variant="secondary"
              onPress={handleReconnect}
              disabled={isConnecting || !ipAddress}
              icon={<RefreshCw size={18} color="#FFFFFF" />}
              style={styles.button}
            />
          </View>
        </View>
      </Card>

      <Card style={styles.card} elevated>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={20} color="#00D4FF" />
            <Text style={styles.sectionTitle}>Test Notifications</Text>
          </View>
          
          <Text style={styles.description}>
            Test different types of security notifications to ensure they're working properly
          </Text>

          <View style={styles.notificationStatus}>
            <Text style={styles.statusLabel}>Notifications:</Text>
            <View style={styles.permissionBadge}>
              {notificationPermission === 'granted' ? (
                <CheckCircle size={16} color="#00FF88" />
              ) : (
                <AlertTriangle size={16} color="#FF9500" />
              )}
              <Text style={[
                styles.permissionText,
                { color: notificationPermission === 'granted' ? '#00FF88' : '#FF9500' }
              ]}>
                {notificationPermission === 'granted' ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>

          <View style={styles.notificationButtons}>
            <TouchableOpacity
              style={[styles.notificationButton, styles.securityButton]}
              onPress={() => sendTestNotification('security')}
              disabled={isSendingNotification}
            >
              <Shield size={20} color="#FF3B30" />
              <Text style={styles.notificationButtonText}>Security Alert</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.notificationButton, styles.accessButton]}
              onPress={() => sendTestNotification('access')}
              disabled={isSendingNotification}
            >
              <CheckCircle size={20} color="#00FF88" />
              <Text style={styles.notificationButtonText}>Access Granted</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.notificationButton, styles.systemButton]}
              onPress={() => sendTestNotification('system')}
              disabled={isSendingNotification}
            >
              <SettingsIcon size={20} color="#00D4FF" />
              <Text style={styles.notificationButtonText}>System Status</Text>
            </TouchableOpacity>
          </View>

          {notificationPermission !== 'granted' && (
            <Button
              title="Enable Notifications"
              variant="primary"
              onPress={requestNotificationPermissions}
              style={styles.enableButton}
              icon={<Bell size={18} color="#121214" />}
            />
          )}
        </View>
      </Card>

      <Card style={styles.card} elevated>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sliders size={20} color="#00D4FF" />
            <Text style={styles.sectionTitle}>Camera Performance</Text>
          </View>
          
          <Text style={styles.description}>
            Optimize camera streaming performance and face recognition settings
          </Text>
          
          <Button
            title="Adjust Performance Settings"
            variant="secondary"
            onPress={() => setShowPerformanceSettings(true)}
            disabled={connectionStatus !== 'connected'}
            style={{ marginTop: 16 }}
          />
        </View>
      </Card>
      
      {/* Performance Settings Modal */}
      <Modal
        visible={showPerformanceSettings}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPerformanceSettings(false)}
      >
        <PerformanceSettings onClose={() => setShowPerformanceSettings(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#121214',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  card: {
    margin: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  statusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    marginBottom: 16,
  },
  notificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginLeft: 6,
  },
  notificationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  notificationButton: {
    width: '48%',
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  securityButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  accessButton: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  systemButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderColor: 'rgba(0, 212, 255, 0.3)',
    width: '100%',
  },
  notificationButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 6,
    textAlign: 'center',
  },
  enableButton: {
    marginTop: 8,
  },
});
