import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Platform, Alert, Switch, ScrollView } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings as SettingsIcon, Save, RefreshCw, Bell, Shield, AlertTriangle, CheckCircle, Camera, Zap } from 'lucide-react-native';
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
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  
  // Camera Performance Settings
  const [performanceSettings, setPerformanceSettings] = useState({
    target_fps: 10,
    recognition_interval: 20,
    jpeg_quality: 60,
    max_width: 320,
    adaptive_quality: true
  });
  const [isSavingPerformance, setIsSavingPerformance] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);

  // Face Recognition Settings
  const [faceRecognitionSettings, setFaceRecognitionSettings] = useState({
    unlock_confidence: 0.5, // 50% default
    auto_unlock: true,
    lock_duration: 10
  });
  const [isSavingFaceSettings, setIsSavingFaceSettings] = useState(false);
  const [confidenceInputValue, setConfidenceInputValue] = useState('50');

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

  const handleSavePerformanceSettings = async () => {
    if (connectionStatus !== 'connected') {
      if (Platform.OS === 'web') {
        alert('Please connect to Raspberry Pi first');
      } else {
        Alert.alert('Connection Required', 'Please connect to Raspberry Pi first');
      }
      return;
    }

    setIsSavingPerformance(true);
    try {
      await doorLockApi.updatePerformanceSettings(performanceSettings);
      
      if (Platform.OS === 'web') {
        alert('Camera performance settings updated successfully!');
      } else {
        Alert.alert('Success', 'Camera performance settings updated successfully!');
      }
    } catch (error) {
      console.error('Error updating performance settings:', error);
      
      if (Platform.OS === 'web') {
        alert('Failed to update performance settings. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to update performance settings. Please try again.');
      }
    } finally {
      setIsSavingPerformance(false);
    }
  };

  const updatePerformanceSetting = (key: string, value: any) => {
    setPerformanceSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveFaceRecognitionSettings = async () => {
    if (connectionStatus !== 'connected') {
      if (Platform.OS === 'web') {
        alert('Please connect to Raspberry Pi first');
      } else {
        Alert.alert('Connection Required', 'Please connect to Raspberry Pi first');
      }
      return;
    }

    setIsSavingFaceSettings(true);
    try {
      await doorLockApi.updateDoorConfig({
        auto_unlock: faceRecognitionSettings.auto_unlock,
        unlock_confidence: faceRecognitionSettings.unlock_confidence,
        lock_duration: faceRecognitionSettings.lock_duration
      });
      
      if (Platform.OS === 'web') {
        alert('Face recognition settings updated successfully!');
      } else {
        Alert.alert('Success', 'Face recognition settings updated successfully!');
      }
    } catch (error) {
      console.error('Error updating face recognition settings:', error);
      
      if (Platform.OS === 'web') {
        alert('Failed to update face recognition settings. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to update face recognition settings. Please try again.');
      }
    } finally {
      setIsSavingFaceSettings(false);
    }
  };

  const handleRebootSystem = async () => {
    if (connectionStatus !== 'connected') {
      if (Platform.OS === 'web') {
        alert('Please connect to Raspberry Pi first');
      } else {
        Alert.alert('Connection Required', 'Please connect to Raspberry Pi first');
      }
      return;
    }

    // Show confirmation dialog
    const confirmReboot = () => {
      if (Platform.OS === 'web') {
        return confirm('Are you sure you want to reboot the Raspberry Pi? This will disconnect all clients and restart the system.');
      } else {
        return new Promise((resolve) => {
          Alert.alert(
            'Confirm Reboot',
            'Are you sure you want to reboot the Raspberry Pi? This will disconnect all clients and restart the system.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Reboot', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });
      }
    };

    const confirmed = await confirmReboot();
    if (!confirmed) return;

    setIsRebooting(true);
    try {
      await doorLockApi.rebootSystem();
      
      if (Platform.OS === 'web') {
        alert('Reboot command sent successfully! The system will restart in a few seconds.');
      } else {
        Alert.alert('Reboot Initiated', 'Reboot command sent successfully! The system will restart in a few seconds.');
      }
      
      // Update connection status since system will go offline
      setConnectionStatus('disconnected');
      
    } catch (error) {
      console.error('Error rebooting system:', error);
      
      if (Platform.OS === 'web') {
        alert('Failed to send reboot command. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to send reboot command. Please try again.');
      }
    } finally {
      setIsRebooting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
            <Shield size={20} color="#00D4FF" />
            <Text style={styles.sectionTitle}>Face Recognition Settings</Text>
          </View>
          
          <Text style={styles.description}>
            Configure face recognition confidence thresholds and auto-unlock behavior. Lower confidence = easier access, higher confidence = more secure.
          </Text>

          <View style={styles.performanceGrid}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Unlock Confidence Threshold</Text>
              <View style={styles.settingControl}>
                <TextInput
                  style={styles.numberInput}
                  value={confidenceInputValue}
                  onChangeText={(text) => {
                    // Update display value immediately
                    setConfidenceInputValue(text);
                    
                    // Update actual setting only if valid number
                    if (text === '') {
                      // Keep the display empty, don't update the setting
                      return;
                    }
                    
                    const numericValue = parseInt(text, 10);
                    if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= 100) {
                      setFaceRecognitionSettings(prev => ({
                        ...prev,
                        unlock_confidence: numericValue / 100
                      }));
                    }
                  }}
                  onBlur={() => {
                    // If field is empty when user finishes, reset to current setting
                    if (confidenceInputValue === '') {
                      setConfidenceInputValue(Math.round(faceRecognitionSettings.unlock_confidence * 100).toString());
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor="#8E8E93"
                  placeholder="50"
                  selectTextOnFocus={true}
                  maxLength={3}
                />
                <Text style={styles.unitText}>%</Text>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Auto-Unlock</Text>
              <Switch
                value={faceRecognitionSettings.auto_unlock}
                onValueChange={(value) => setFaceRecognitionSettings(prev => ({
                  ...prev,
                  auto_unlock: value
                }))}
                trackColor={{ false: '#3E3E3E', true: '#00D4FF' }}
                thumbColor={faceRecognitionSettings.auto_unlock ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Unlock Duration</Text>
              <View style={styles.settingControl}>
                <TextInput
                  style={styles.numberInput}
                  value={faceRecognitionSettings.lock_duration.toString()}
                  onChangeText={(text) => {
                    const value = parseInt(text) || 10;
                    setFaceRecognitionSettings(prev => ({
                      ...prev,
                      lock_duration: Math.max(1, Math.min(60, value))
                    }));
                  }}
                  keyboardType="numeric"
                  placeholderTextColor="#8E8E93"
                />
                <Text style={styles.unitText}>sec</Text>
              </View>
            </View>
          </View>

          <View style={styles.performanceInfo}>
            <View style={styles.infoRow}>
              <Shield size={16} color="#00FF88" />
              <Text style={styles.infoText}>
                Current setting: {Math.round(faceRecognitionSettings.unlock_confidence * 100)}% confidence required to unlock
              </Text>
            </View>
            <View style={styles.infoRow}>
              <AlertTriangle size={16} color="#FF9500" />
              <Text style={styles.infoText}>
                Lower thresholds (30-60%) = easier access but less secure. Higher thresholds (70-90%) = more secure but may require better lighting.
              </Text>
            </View>
          </View>

          <Button
            title="Apply Face Recognition Settings"
            variant="primary"
            onPress={handleSaveFaceRecognitionSettings}
            disabled={isSavingFaceSettings || connectionStatus !== 'connected'}
            icon={<Save size={18} color="#121214" />}
            style={styles.fullWidthButton}
          />

          {connectionStatus !== 'connected' && (
            <Text style={styles.warningText}>
              Connect to Raspberry Pi to apply face recognition settings
            </Text>
          )}
        </View>
      </Card>

      <Card style={styles.card} elevated>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Camera size={20} color="#00D4FF" />
            <Text style={styles.sectionTitle}>Camera Performance</Text>
          </View>
          
          <Text style={styles.description}>
            Adjust camera settings to optimize video quality and performance. Higher FPS improves smoothness but uses more bandwidth.
          </Text>

          <View style={styles.performanceGrid}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Target FPS</Text>
              <View style={styles.settingControl}>
                <TextInput
                  style={styles.numberInput}
                  value={performanceSettings.target_fps.toString()}
                  onChangeText={(text) => updatePerformanceSetting('target_fps', parseInt(text) || 10)}
                  keyboardType="numeric"
                  placeholderTextColor="#8E8E93"
                />
                <Text style={styles.unitText}>fps</Text>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Recognition Interval</Text>
              <View style={styles.settingControl}>
                <TextInput
                  style={styles.numberInput}
                  value={performanceSettings.recognition_interval.toString()}
                  onChangeText={(text) => updatePerformanceSetting('recognition_interval', parseInt(text) || 20)}
                  keyboardType="numeric"
                  placeholderTextColor="#8E8E93"
                />
                <Text style={styles.unitText}>frames</Text>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>JPEG Quality</Text>
              <View style={styles.settingControl}>
                <TextInput
                  style={styles.numberInput}
                  value={performanceSettings.jpeg_quality.toString()}
                  onChangeText={(text) => updatePerformanceSetting('jpeg_quality', parseInt(text) || 60)}
                  keyboardType="numeric"
                  placeholderTextColor="#8E8E93"
                />
                <Text style={styles.unitText}>%</Text>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Max Width</Text>
              <View style={styles.settingControl}>
                <TextInput
                  style={styles.numberInput}
                  value={performanceSettings.max_width.toString()}
                  onChangeText={(text) => updatePerformanceSetting('max_width', parseInt(text) || 320)}
                  keyboardType="numeric"
                  placeholderTextColor="#8E8E93"
                />
                <Text style={styles.unitText}>px</Text>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Adaptive Quality</Text>
              <Switch
                value={performanceSettings.adaptive_quality}
                onValueChange={(value) => updatePerformanceSetting('adaptive_quality', value)}
                trackColor={{ false: '#3E3E3E', true: '#00D4FF' }}
                thumbColor={performanceSettings.adaptive_quality ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>

          <View style={styles.performanceInfo}>
            <View style={styles.infoRow}>
              <Zap size={16} color="#FF9500" />
              <Text style={styles.infoText}>
                For smoother video: Increase FPS (15-30), decrease recognition interval (5-10), increase quality (70-85%)
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Zap size={16} color="#00FF88" />
              <Text style={styles.infoText}>
                For better performance: Keep FPS low (5-15), increase recognition interval (20-50), decrease quality (40-70%)
              </Text>
            </View>
          </View>

          <Button
            title="Apply Settings"
            variant="primary"
            onPress={handleSavePerformanceSettings}
            disabled={isSavingPerformance || connectionStatus !== 'connected'}
            icon={<Save size={18} color="#121214" />}
            style={styles.fullWidthButton}
          />

          {connectionStatus !== 'connected' && (
            <Text style={styles.warningText}>
              Connect to Raspberry Pi to apply performance settings
            </Text>
          )}
        </View>
      </Card>

      <Card style={styles.card} elevated>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <RefreshCw size={20} color="#00D4FF" />
            <Text style={styles.sectionTitle}>System Management</Text>
          </View>
          
          <Text style={styles.description}>
            Manage the Raspberry Pi system. Use the reboot function if the system becomes unresponsive or after making configuration changes.
          </Text>

          <View style={styles.rebootSection}>
            <View style={styles.rebootInfo}>
              <AlertTriangle size={18} color="#FF9500" />
              <Text style={styles.rebootWarningText}>
                Rebooting will restart the entire system and disconnect all clients temporarily.
              </Text>
            </View>

            <Button
              title={isRebooting ? "Rebooting..." : "Reboot Raspberry Pi"}
              variant="danger"
              onPress={handleRebootSystem}
              disabled={isRebooting || connectionStatus !== 'connected'}
              icon={<RefreshCw size={18} color="#FFFFFF" />}
              style={styles.rebootButton}
            />

            {connectionStatus !== 'connected' && (
              <Text style={styles.warningText}>
                Connect to Raspberry Pi to reboot the system
              </Text>
            )}
          </View>
        </View>
      </Card>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
  performanceGrid: {
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  settingLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  settingControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: 60,
    textAlign: 'center',
  },
  unitText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
    minWidth: 40,
  },
  performanceInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  fullWidthButton: {
    width: '100%',
  },
  warningText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 8,
  },
  rebootSection: {
    marginTop: 8,
  },
  rebootInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  rebootWarningText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  rebootButton: {
    width: '100%',
  },
});
