import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  withRepeat, 
  withSequence,
  Easing,
  cancelAnimation 
} from 'react-native-reanimated';
import { Lock, Clock as Unlock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface DoorLockButtonProps {
  isLocked: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

export const DoorLockButton = ({ isLocked, onToggle, isLoading = false }: DoorLockButtonProps) => {
  const [isAnimating, setIsAnimating] = useState(false);

  // Animation values
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const glow = useSharedValue(0);

  // Trigger haptic feedback and animation on state change
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        isLocked 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Warning
      );
    }

    // Trigger animation when state changes (from external updates)
    if (!isAnimating) {
      // Button state change animation
      scale.value = withSequence(
        withTiming(1.05, { duration: 150 }),
        withTiming(1, { duration: 100 })
      );
      
      // Rotation animation based on new state
      rotation.value = withTiming(
        isLocked ? 0 : Math.PI, 
        { duration: 400 }
      );
      
      // Brief glow effect
      glow.value = withSequence(
        withTiming(0.8, { duration: 200 }),
        withTiming(isLocked ? 0 : 0.2, { duration: 200 })
      );
    }
  }, [isLocked]);

  const handlePress = () => {
    // Only trigger haptics on native platforms
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setIsAnimating(true);
    
    // Button press animation
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1.05, { duration: 150 }),
      withTiming(1, { duration: 100 })
    );
    
    // Rotation animation
    rotation.value = withSequence(
      withTiming(isLocked ? 0 : -Math.PI, { duration: 300 }),
      withTiming(isLocked ? Math.PI : 0, { duration: 300 })
    );
    
    // Glow effect
    glow.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 300 })
    );
    
    // Call the toggle function after animation
    setTimeout(() => {
      onToggle();
      setIsAnimating(false);
    }, 600);
  };

  // Status pulse animation (continuous when unlocked)
  useEffect(() => {
    if (!isLocked) {
      glow.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(0);
    }
    
    return () => {
      cancelAnimation(glow);
    };
  }, [isLocked]);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      shadowOpacity: glow.value * 0.8,
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}rad` }],
    };
  });

  const statusColor = isLoading ? '#00D4FF' : (isLocked ? '#00FF88' : '#FF3B30');
  const statusText = isLoading ? 'Connecting...' : (isLocked ? 'Locked' : 'Unlocked');

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.buttonContainer, 
          { 
            backgroundColor: isLocked ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 59, 48, 0.1)',
            borderColor: statusColor
          },
          animatedContainerStyle
        ]}
      >
        <TouchableOpacity
          style={styles.button}
          onPress={handlePress}
          disabled={isAnimating || isLoading}
        >
          <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
            {isLocked ? (
              <Lock size={40} color="#00FF88" />
            ) : (
              <Unlock size={40} color="#FF3B30" />
            )}
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
      <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#00FF88',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 20,
    elevation: 10,
    margin: 20,
  },
  button: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(18, 18, 20, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    marginTop: 12,
  },
});
