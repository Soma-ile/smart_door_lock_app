import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DoorStatusCard } from '@/components/DoorStatusCard';
import { DoorLockButton } from '@/components/DoorLockButton';
import { CameraView } from '@/components/CameraView';
import { RecentActivityList } from '@/components/RecentActivityList';
import { mockDoorStatus, mockAccessHistory, mockCameraFeed } from '@/utils/mockData';

export default function HomeScreen() {
  const [doorStatus, setDoorStatus] = useState(mockDoorStatus);
  const [isFullScreenCamera, setIsFullScreenCamera] = useState(false);
  
  // Toggle door lock status
  const toggleLock = () => {
    setDoorStatus(prev => ({
      ...prev,
      locked: !prev.locked,
      lastActivity: new Date().toISOString(),
    }));
  };
  
  // Toggle camera fullscreen
  const toggleFullScreen = () => {
    setIsFullScreenCamera(prev => !prev);
  };
  
  // Take snapshot (simulated)
  const takeSnapshot = () => {
    // Simulation only - would save image in real app
    alert('Snapshot taken');
  };

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
          />
        </View>
        
        {/* Recent Activity */}
        <RecentActivityList 
          activities={mockAccessHistory.slice(0, 3)} 
          title="Recent Activity"
        />
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