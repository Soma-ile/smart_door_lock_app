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
import { FaceDetectionResult, FrameResult } from '@/types';

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
  const [detectedFaces, setDetectedFaces] = useState<FaceDetectionResult[]>([]);
  const [frameUpdateCount, setFrameUpdateCount] = useState(0);
  
  useEffect(() => {
    console.log('CameraView: Setting up WebSocket connection for real webcam feed');
    
    // Handle connection status
    const handleConnectionStatus = (data: any) => {
      console.log('CameraView: Connection status:', data.status);
      setConnectionStatus(data.status);
      if (data.error) {
        setError(data.error);
      }
    };

    // Frame throttling to prevent excessive re-renders
    let lastFrameUpdate = 0;
    const frameThrottleMs = 100; // Update max every 100ms (10 FPS on frontend)

    // Handle incoming frames with face tracking
    const handleFrame = (data: any) => {
      if (data.image) {
        const now = Date.now();
        
        // Throttle frame updates to prevent React Native flickering
        if (now - lastFrameUpdate >= frameThrottleMs) {
          console.log('CameraView: Updating frame');
          setCurrentFrame(data.image);
          setError(null);
          lastFrameUpdate = now;
          
          // Increment counter to force key update
          setFrameUpdateCount(prev => prev + 1);
        }
        
        // Always update face tracking data (lightweight)
        if (data.results?.faces) {
          setDetectedFaces(data.results.faces);
          
          // Update motion detection when faces detected
          if (data.results.faces.length > 0) {
            setIsMotionDetected(true);
            setTimeout(() => setIsMotionDetected(false), 3000);
          }
        } else {
          setDetectedFaces([]);
        }
      }
    };

    // Handle WebSocket errors
    const handleError = (data: any) => {
      console.log('CameraView: WebSocket error:', data.message);
      setError(data.message);
    };

    // Set up event listeners
    doorLockApi.on('connectionStatus', handleConnectionStatus);
    doorLockApi.on('frame', handleFrame);
    doorLockApi.on('error', handleError);

    // Connect to get real webcam feed
    doorLockApi.connect();

    return () => {
      console.log('CameraView: Cleaning up WebSocket listeners');
      doorLockApi.off('connectionStatus', handleConnectionStatus);
      doorLockApi.off('frame', handleFrame);
      doorLockApi.off('error', handleError);
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
    // Only show error messages, not connecting status
    if (!error) {
      return null;
    }

    return (
      <View style={styles.statusOverlay}>
        <Text style={styles.statusMessage}>
          {error}
        </Text>
      </View>
    );
  };
  
  // Render face boxes with names
  const renderFaceBoxes = () => {
    if (!detectedFaces.length || connectionStatus !== 'connected') {
      return null;
    }
    
    return detectedFaces.map((face, index) => {
      const { location, name, confidence } = face;
      const displayName = name !== "Unknown" ? name : "Unidentified";
      
      // Calculate box position and size
      const boxStyle = {
        position: 'absolute' as 'absolute',
        top: location.top,
        left: location.left,
        width: location.right - location.left,
        height: location.bottom - location.top,
        borderWidth: 2,
        borderColor: name !== "Unknown" ? '#00FF88' : '#FF3B30',
        borderRadius: 4,
      };
      
      // Calculate label position
      const labelStyle = {
        position: 'absolute' as 'absolute',
        top: location.top - 25,
        left: location.left,
        backgroundColor: name !== "Unknown" ? 'rgba(0, 255, 136, 0.7)' : 'rgba(255, 59, 48, 0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
      };
      
      return (
        <React.Fragment key={`face-${index}`}>
          <View style={boxStyle} />
          <View style={labelStyle}>
            <Text style={styles.faceLabel}>
              {displayName}
            </Text>
          </View>
        </React.Fragment>
      );
    });
  };
  
  if (isFullScreen) {
    // Fullscreen mode - use back button to minimize
    return (
      <View style={styles.fullScreenContainer}>
        <View style={styles.cameraContainer}>
          {currentFrame ? (
            <Image 
              key={`frame-${frameUpdateCount}`}
              source={{ uri: `data:image/jpeg;base64,${currentFrame}` }}
              style={styles.cameraFeed}
              resizeMode="cover"
              onError={(error) => {
                console.log('CameraView: Error loading webcam frame:', error);
                setCurrentFrame(null); // Reset to show fallback
              }}
            />
          ) : connectionStatus === 'connected' ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading webcam feed...</Text>
            </View>
          ) : (
            <Image 
              source={{ uri: cameraFeed.streamUrl }}
              style={styles.cameraFeed}
              resizeMode="cover"
            />
          )}
          
          {/* Face detection boxes */}
          <View style={styles.faceBoxContainer}>
            {renderFaceBoxes()}
          </View>
          
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
            
            {/* Fullscreen hint */}
            <View style={styles.fullscreenHint}>
              <Text style={styles.hintText}>Press back button to minimize</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Regular mode - with expand button only
  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        {currentFrame ? (
          <Image 
            source={{ uri: `data:image/jpeg;base64,${currentFrame}` }}
            style={styles.cameraFeed}
            resizeMode="cover"
            onError={(error) => {
              console.log('CameraView: Error loading webcam frame:', error);
              setCurrentFrame(null); // Reset to show fallback
            }}
          />
        ) : connectionStatus === 'connected' ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading webcam feed...</Text>
          </View>
        ) : (
          <Image 
            source={{ uri: cameraFeed.streamUrl }}
            style={styles.cameraFeed}
            resizeMode="cover"
          />
        )}
        
        {/* Face detection boxes */}
        <View style={styles.faceBoxContainer}>
          {renderFaceBoxes()}
        </View>
        
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
              onPress={() => {
                console.log('CameraView: Expand button pressed');
                if (onToggleFullScreen) {
                  onToggleFullScreen();
                } else {
                  console.log('CameraView: onToggleFullScreen callback not provided');
                }
              }}
            >
              <Maximize2 size={24} color="#FFFFFF" />
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
  faceBoxContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  faceLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 20,
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
    zIndex: 15,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  fullscreenHint: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
});
