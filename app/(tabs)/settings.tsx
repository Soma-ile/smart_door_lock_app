import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doorLockApi } from '@/utils/doorLockApi';

const IP_ADDRESS_KEY = '@settings/raspberry_pi_ip';

export default function SettingsScreen() {
  const [ipAddress, setIpAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'failed'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSavedIP();
    
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
});