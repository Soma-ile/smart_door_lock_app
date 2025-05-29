import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { Card } from './ui/Card';
import { getRelativeTime } from '@/utils/dateUtils';
import { DoorStatus } from '@/utils/mockData';
import { Wifi, Camera, ShieldAlert } from 'lucide-react-native';

interface DoorStatusCardProps {
  doorStatus: DoorStatus;
}

const StatusIndicator = ({ online, label }: { online: boolean, label: string }) => {
  const opacity = useSharedValue(online ? 1 : 0.5);

  // Create pulsing animation for online status
  React.useEffect(() => {
    if (online) {
      opacity.value = withRepeat(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      opacity.value = withTiming(0.5);
    }
  }, [online]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <View style={styles.statusContainer}>
      <View style={styles.statusIndicatorWrapper}>
        <Animated.View
          style={[
            styles.statusDot,
            { backgroundColor: online ? '#00FF88' : '#FF3B30' },
            animatedStyle,
          ]}
        />
      </View>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
    </View>
  );
};

export const DoorStatusCard = ({ doorStatus }: DoorStatusCardProps) => {
  const { systemOnline, cameraOnline, lastActivity } = doorStatus;

  return (
    <Card style={styles.card} elevated>
      <Text style={styles.title}>System Status</Text>
      
      <View style={styles.statusRow}>
        <StatusIndicator online={systemOnline} label="System" />
        <StatusIndicator online={cameraOnline} label="Camera" />
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.lastActivityContainer}>
        <Text style={styles.lastActivityLabel}>Last Activity:</Text>
        <Text style={styles.lastActivityTime}>{getRelativeTime(lastActivity)}</Text>
      </View>
      
      <View style={styles.iconRow}>
        <View style={[styles.iconContainer, { opacity: systemOnline ? 1 : 0.5 }]}>
          <Wifi size={20} color={systemOnline ? '#00D4FF' : '#8E8E93'} />
        </View>
        <View style={[styles.iconContainer, { opacity: cameraOnline ? 1 : 0.5 }]}>
          <Camera size={20} color={cameraOnline ? '#00D4FF' : '#8E8E93'} />
        </View>
        <View style={styles.iconContainer}>
          <ShieldAlert size={20} color="#00D4FF" />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusIndicatorWrapper: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  statusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  lastActivityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lastActivityLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8E8E93',
  },
  lastActivityTime: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
});