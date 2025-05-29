import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView } from '@/components/CameraView';
import { Button } from '@/components/ui/Button';
import { mockCameraFeed } from '@/utils/mockData';
import { Camera, Zap, FileSliders as Sliders, Video, Image as ImageIcon } from 'lucide-react-native';

export default function CameraScreen() {
  const [isFullScreenCamera, setIsFullScreenCamera] = useState(false);
  const [cameraFeed, setCameraFeed] = useState(mockCameraFeed);
  
  // Toggle camera fullscreen
  const toggleFullScreen = () => {
    setIsFullScreenCamera(prev => !prev);
  };
  
  // Take snapshot (simulated)
  const takeSnapshot = () => {
    // Simulation only - would save image in real app
    alert('Snapshot taken');
  };
  
  // Toggle camera status (simulation)
  const toggleCameraStatus = () => {
    setCameraFeed(prev => ({
      ...prev,
      status: prev.status === 'online' ? 'offline' : 'online'
    }));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.title}>Camera Control</Text>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Camera Feed */}
        <View style={styles.cameraContainer}>
          <CameraView 
            cameraFeed={cameraFeed}
            onToggleFullScreen={toggleFullScreen}
            onSnapshot={takeSnapshot}
          />
        </View>
        
        {/* Camera Controls */}
        <View style={styles.controlsSection}>
          <Text style={styles.sectionTitle}>Camera Controls</Text>
          
          <View style={styles.controlsGrid}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={takeSnapshot}
            >
              <Camera size={28} color="#00D4FF" />
              <Text style={styles.controlText}>Snapshot</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton}>
              <Video size={28} color="#00D4FF" />
              <Text style={styles.controlText}>Record</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton}>
              <ImageIcon size={28} color="#00D4FF" />
              <Text style={styles.controlText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton}>
              <Sliders size={28} color="#00D4FF" />
              <Text style={styles.controlText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Camera Status */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Camera Status</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[
                styles.statusValue, 
                { color: cameraFeed.status === 'online' ? '#00FF88' : '#FF3B30' }
              ]}>
                {cameraFeed.status === 'online' ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Resolution:</Text>
              <Text style={styles.statusValue}>{cameraFeed.resolution}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Motion Detection:</Text>
              <Text style={styles.statusValue}>Active</Text>
            </View>
            
            <Button 
              title={cameraFeed.status === 'online' ? 'Disable Camera' : 'Enable Camera'}
              variant={cameraFeed.status === 'online' ? 'danger' : 'success'}
              onPress={toggleCameraStatus}
              style={styles.statusButton}
              icon={<Zap size={18} color={cameraFeed.status === 'online' ? '#FFFFFF' : '#121214'} />}
            />
          </View>
        </View>
      </ScrollView>
      
      {/* Fullscreen camera overlay */}
      {isFullScreenCamera && (
        <CameraView 
          cameraFeed={cameraFeed}
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
  cameraContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    height: 240,
  },
  controlsSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  controlsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  controlButton: {
    width: '48%',
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 8,
  },
  statusSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#8E8E93',
  },
  statusValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  statusButton: {
    marginTop: 16,
  },
});