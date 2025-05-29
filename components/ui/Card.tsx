import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';

interface CardProps extends ViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  elevated?: boolean;
}

export const Card = ({ 
  children, 
  style, 
  intensity = 40, 
  tint = 'dark',
  elevated = false,
  ...props 
}: CardProps) => {
  // On web, use regular View with backdrop-filter
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.card,
          elevated && styles.elevated,
          style,
        ]}
        {...props}>
        {children}
      </View>
    );
  }

  // On native, use BlurView
  return (
    <View style={[styles.container, elevated && styles.elevated, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[styles.card]}
        {...props}>
        {children}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(18, 18, 20, 0.7)',
    // Web-specific styles for glass effect
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } : {}),
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
});