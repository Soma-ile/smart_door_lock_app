import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Platform, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DoorStatusCard } from '@/components/DoorStatusCard';
import { DoorLockButton } from '@/components/DoorLockButton';
import { CameraView } from '@/components/CameraView';
import { mockDoorStatus, mockCameraFeed } from '@/utils/mockData';
import { doorLockApi } from '@/utils/doorLockApi';

export default function HomeScreen() {
  const [doorStatus, setDoorStatus] = useState(mockDoorStatus);
  const [isFullScreenCamera, setIsFullScreenCamera] = useState(false);
  const [isDoorLockLoading, setIsDoorLockLoading] = useState(false);
  
  // Toggle door lock status
  const toggleLock = async () => {
    console.log('HomeScreen: Door lock toggle requested, current state:', doorStatus.locked);
    
    if (isDoorLockLoading) {
      console.log('HomeScreen: Door lock operation already in progress, ignoring request');
      return;
    }

    setIsDoorLockLoading(true);
    
    try {
      let success = false;
      
      if (doorStatus.locked) {
        // Currently locked, so unlock it
        console.log('HomeScreen: Sending unlock command to door lock');
        success = await doorLockApi.unlockDoor(10); // Unlock for 10 seconds
      } else {
        // Currently unlocked, so lock it
        console.log('HomeScreen: Sending lock command to door lock');
        success = await doorLockApi.lockDoor();
      }

      if (success) {
        console.log('HomeScreen: Door lock command successful, updating UI state');
        setDoorStatus(prev => ({
          ...prev,
          locked: !prev.locked,
          lastActivity: new Date().toISOString(),
        }));
      } else {
        console.log('HomeScreen: Door lock command failed');
        if (Platform.OS === 'web') {
          alert('Failed to control door lock. Please check connection.');
        }
      }
    } catch (error) {
      console.error('HomeScreen: Error controlling door lock:', error);
      if (Platform.OS === 'web') {
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsDoorLockLoading(false);
    }
  };
  
  // Toggle camera fullscreen
  const toggleFullScreen = () => {
    console.log('HomeScreen: toggleFullScreen called, current state:', isFullScreenCamera);
    setIsFullScreenCamera(prev => {
      const newState = !prev;
      console.log('HomeScreen: Setting isFullScreenCamera to:', newState);
      return newState;
    });
  };
  
  // Take snapshot (simulated)
  const takeSnapshot = () => {
    // Simulation only - would save image in real app
    alert('Snapshot taken');
  };

  // Listen for door lock status updates from server
  useEffect(() => {
    const handleDoorLocked = (data: any) => {
      console.log('HomeScreen: Received door_locked event:', data);
      setDoorStatus(prev => ({
        ...prev,
        locked: true,
        lastActivity: new Date().toISOString(),
      }));
    };

    const handleDoorUnlocked = (data: any) => {
      console.log('HomeScreen: Received door_unlocked event:', data);
      setDoorStatus(prev => ({
        ...prev,
        locked: false,
        lastActivity: new Date().toISOString(),
      }));
    };

    const handleDoorStatus = (data: any) => {
      console.log('HomeScreen: Received door_status event:', data);
      setDoorStatus(prev => ({
        ...prev,
        locked: !data.is_unlocked, // Note: backend sends is_unlocked, we need locked
        lastActivity: new Date().toISOString(),
      }));
    };

    const handleConnectionStatus = (data: any) => {
      console.log('HomeScreen: Connection status changed:', data.status);
      if (data.status === 'connected') {
        // Request current door status when we connect
        setTimeout(() => {
          doorLockApi.requestDoorStatus();
        }, 1000);
      }
    };

    const handleRecognitionEvent = (data: any) => {
      console.log('HomeScreen: Received recognition event:', data);
      // Recognition events might include door unlock actions
      if (data.door_unlocked !== undefined) {
        setDoorStatus(prev => ({
          ...prev,
          locked: !data.door_unlocked,
          lastActivity: new Date().toISOString(),
        }));
      }
    };

    // Listen for door lock events
    doorLockApi.on('door_locked', handleDoorLocked);
    doorLockApi.on('door_unlocked', handleDoorUnlocked);
    doorLockApi.on('door_status', handleDoorStatus);
    doorLockApi.on('connectionStatus', handleConnectionStatus);
    doorLockApi.on('recognition', handleRecognitionEvent);

    // Request initial door status
    doorLockApi.requestDoorStatus();

    // Set up periodic door status check to ensure sync
    const statusInterval = setInterval(() => {
      doorLockApi.requestDoorStatus();
    }, 5000); // Check every 5 seconds

    return () => {
      doorLockApi.off('door_locked', handleDoorLocked);
      doorLockApi.off('door_unlocked', handleDoorUnlocked);
      doorLockApi.off('door_status', handleDoorStatus);
      doorLockApi.off('connectionStatus', handleConnectionStatus);
      doorLockApi.off('recognition', handleRecognitionEvent);
      clearInterval(statusInterval);
    };
  }, []);

  // Handle back button press for fullscreen camera
  useEffect(() => {
    const backAction = () => {
      if (isFullScreenCamera) {
        console.log('HomeScreen: Back button pressed, minimizing fullscreen camera');
        setIsFullScreenCamera(false);
        return true; // Prevent default back action
      }
      return false; // Allow default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [isFullScreenCamera]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.title}>Smart Door Lock</Text>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Door Status Card */}
        <DoorStatusCard doorStatus={doorStatus} />
        
        {/* Camera Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Camera</Text>
          <CameraView 
            cameraFeed={mockCameraFeed}
            onToggleFullScreen={toggleFullScreen}
            onSnapshot={takeSnapshot}
          />
        </View>
        
        {/* Door Lock Control */}
        <View style={styles.lockContainer}>
          <DoorLockButton 
            isLocked={doorStatus.locked} 
            onToggle={toggleLock}
            isLoading={isDoorLockLoading}
          />
        </View>
      </ScrollView>
      
      {/* Fullscreen camera overlay */}
      {isFullScreenCamera && (
        <CameraView 
          cameraFeed={mockCameraFeed}
          isFullScreen
          onToggleFullScreen={toggleFullScreen}
          onSnapshot={takeSnapshot}
        />
      )}
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  lockContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
});
