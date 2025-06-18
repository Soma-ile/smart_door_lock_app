import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { doorLockApi } from '@/utils/doorLockApi';

// Mock Slider component since we don't have the actual package
const Slider = ({ 
  style, 
  minimumValue, 
  maximumValue, 
  step, 
  value, 
  onValueChange, 
  minimumTrackTintColor, 
  maximumTrackTintColor 
}: {
  style: any;
  minimumValue: number;
  maximumValue: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
}) => {
  // This is just a mock implementation for TypeScript
  return (
    <View style={style}>
      <Text>Slider (Mock): {value}</Text>
    </View>
  );
};

interface PerformanceSettingsProps {
  onClose?: () => void;
}

interface PerformanceSettings {
  target_fps: number;
  recognition_interval: number;
  jpeg_quality: number;
  max_width: number;
  adaptive_quality: boolean;
}

export const PerformanceSettings = ({ onClose }: PerformanceSettingsProps) => {
  const [settings, setSettings] = useState<PerformanceSettings>({
    target_fps: 15,
    recognition_interval: 3,
    jpeg_quality: 70,
    max_width: 480,
    adaptive_quality: true
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  useEffect(() => {
    // Request current settings from server
    const fetchSettings = async () => {
      try {
        // In a real implementation, we would fetch the current settings from the server
        // For now, we'll use the default values
        console.log('Fetching current performance settings');
      } catch (error) {
        console.error('Error fetching performance settings:', error);
        Alert.alert('Error', 'Failed to fetch current performance settings');
      }
    };
    
    fetchSettings();
  }, []);
  
  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Send updated settings to server
      await doorLockApi.updatePerformanceSettings(settings);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error('Error saving performance settings:', error);
      Alert.alert('Error', 'Failed to save performance settings');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Performance Settings</Text>
      <Text style={styles.subtitle}>
        Adjust these settings to optimize camera performance based on your Raspberry Pi capabilities
      </Text>
      
      <ScrollView style={styles.settingsContainer}>
        <View style={styles.settingGroup}>
          <Text style={styles.settingTitle}>Target FPS: {settings.target_fps}</Text>
          <Text style={styles.settingDescription}>
            Lower values reduce CPU usage but may result in choppier video
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={5}
            maximumValue={30}
            step={1}
            value={settings.target_fps}
            onValueChange={(value) => setSettings({ ...settings, target_fps: value })}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#CCCCCC"
          />
          <View style={styles.sliderLabels}>
            <Text>5 FPS</Text>
            <Text>30 FPS</Text>
          </View>
        </View>
        
        <View style={styles.settingGroup}>
          <Text style={styles.settingTitle}>Recognition Interval: {settings.recognition_interval}</Text>
          <Text style={styles.settingDescription}>
            Perform face recognition every N frames (higher values = less CPU usage)
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={settings.recognition_interval}
            onValueChange={(value) => setSettings({ ...settings, recognition_interval: value })}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#CCCCCC"
          />
          <View style={styles.sliderLabels}>
            <Text>Every frame</Text>
            <Text>Every 10 frames</Text>
          </View>
        </View>
        
        <View style={styles.settingGroup}>
          <Text style={styles.settingTitle}>JPEG Quality: {settings.jpeg_quality}%</Text>
          <Text style={styles.settingDescription}>
            Lower values reduce bandwidth usage but decrease image quality
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={30}
            maximumValue={95}
            step={5}
            value={settings.jpeg_quality}
            onValueChange={(value) => setSettings({ ...settings, jpeg_quality: value })}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#CCCCCC"
          />
          <View style={styles.sliderLabels}>
            <Text>Low (30%)</Text>
            <Text>High (95%)</Text>
          </View>
        </View>
        
        <View style={styles.settingGroup}>
          <Text style={styles.settingTitle}>Max Frame Width: {settings.max_width}px</Text>
          <Text style={styles.settingDescription}>
            Maximum width of video frames (smaller = less CPU and bandwidth)
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={320}
            maximumValue={640}
            step={40}
            value={settings.max_width}
            onValueChange={(value) => setSettings({ ...settings, max_width: value })}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#CCCCCC"
          />
          <View style={styles.sliderLabels}>
            <Text>320px</Text>
            <Text>640px</Text>
          </View>
        </View>
        
        <View style={styles.switchSetting}>
          <View>
            <Text style={styles.settingTitle}>Adaptive Quality</Text>
            <Text style={styles.settingDescription}>
              Automatically adjust quality based on system load
            </Text>
          </View>
          <Switch
            value={settings.adaptive_quality}
            onValueChange={(value) => setSettings({ ...settings, adaptive_quality: value })}
            trackColor={{ false: "#CCCCCC", true: "#007AFF" }}
          />
        </View>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.cancelButton]} 
          onPress={onClose}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.saveButton, isLoading && styles.disabledButton]} 
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Saving...' : isSaved ? 'Saved!' : 'Save Settings'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  settingsContainer: {
    flex: 1,
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  switchSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#EEEEEE',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
});
