import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Camera as LucideCamera, Maximize2, Minimize2, Camera as CameraIcon, Settings } from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraFeed } from '@/utils/mockData';
import { doorLockApi } from '@/utils/doorLockApi';

interface CameraViewProps {
  cameraFeed: CameraFeed;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onSnapshot?: () => void;
}

export const CameraView = ({ 
  cameraFeed: initialCameraFeed,
  isFullScreen = false,
  onToggleFullScreen,
  onSnapshot
}: CameraViewProps) => {
  const [cameraFeed, setCameraFeed] = useState(initialCameraFeed);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [isMotionDetected, setIsMotionDetected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Handle connection status
    doorLockApi.on('connectionStatus', (data) => {
      setConnectionStatus(data.status);
      if (data.error) {
        setError(data.error);
      }
    });

    // Handle incoming frames
    doorLockApi.on('frame', (data) => {
      if (data.image) {
        setCurrentFrame(data.image);
        setError(null); // Clear any previous errors
        
        // Update motion detection if faces are detected
        if (data.results?.faces?.length > 0) {
          setIsMotionDetected(true);
          setTimeout(() => setIsMotionDetected(false), 3000);
        }
      }
    });

    // Handle errors
    doorLockApi.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      doorLockApi.off('connectionStatus', () => {});
      doorLockApi.off('frame', () => {});
      doorLockApi.off('error', () => {});
    };
  }, []);
  
  // Animation values
  const motionOpacity = useSharedValue(0);
  const recordDotScale = useSharedValue(1);
  
  // Motion detection animation
  useEffect(() => {
    if (isMotionDetected) {
      motionOpacity.value = withTiming(1, { duration: 300 });
      recordDotScale.value = withRepeat(
        withTiming(1.3, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      motionOpacity.value = withTiming(0, { duration: 300 });
      recordDotScale.value = withTiming(1);
    }
  }, [isMotionDetected]);
  
  const motionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: motionOpacity.value,
  }));
  
  const recordDotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordDotScale.value }],
  }));

  // Render connection status overlay
  const renderConnectionStatus = () => {
    if (connectionStatus === 'connected' && !error && currentFrame) {
      return null;
    }

    return (
      <View style={styles.statusOverlay}>
        <Text style={styles.statusMessage}>
          {error || `Camera ${connectionStatus}...`}
        </Text>
      </View>
    );
  };
  
  return (
    <View style={[styles.container, isFullScreen && styles.fullScreenContainer]}>
      <View style={styles.cameraContainer}>
        {currentFrame ? (
          <Image 
            source={{ uri: `data:image/jpeg;base64,${currentFrame}` }}
            style={styles.cameraFeed}
            resizeMode="cover"
          />
        ) : (
          <Image 
            source={{ uri: cameraFeed.streamUrl }}
            style={styles.cameraFeed}
            resizeMode="cover"
          />
        )}
        
        {renderConnectionStatus()}
        
        <View style={styles.overlay}>
          <View style={styles.statusBar}>
            <View style={styles.statusContainer}>
              <Animated.View style={[styles.recordingDot, recordDotAnimatedStyle]} />
              <Text style={styles.statusText}>
                {connectionStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
              </Text>
            </View>
            <Text style={styles.resolutionText}>{cameraFeed.resolution}</Text>
          </View>
          
          <Animated.View style={[styles.motionAlert, motionAnimatedStyle]}>
            <LinearGradient
              colors={['rgba(255, 59, 48, 0)', 'rgba(255, 59, 48, 0.3)']}
              style={styles.motionGradient}
            />
            <Text style={styles.motionText}>MOTION DETECTED</Text>
          </Animated.View>
          
          <View style={styles.controlsContainer}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={onSnapshot}
            >
              <CameraIcon size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={onToggleFullScreen}
            >
              {isFullScreen ? (
                <Minimize2 size={24} color="#FFFFFF" />
              ) : (
                <Maximize2 size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton}>
              <Settings size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 240,
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    borderRadius: 0,
    height: Dimensions.get('window').height,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraFeed: {
    width: '100%',
    height: '100%',
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  statusText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  resolutionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#FFFFFF',
  },
  motionAlert: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  motionGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  motionText: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
});