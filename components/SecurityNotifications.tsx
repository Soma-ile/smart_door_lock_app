import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { doorLockApi } from '@/utils/doorLockApi';
import { Shield, ShieldCheck, ShieldAlert, Eye, UserCheck, AlertTriangle, X } from 'lucide-react-native';

interface SecurityEvent {
  id: string;
  type: 'motion_detected' | 'access_granted' | 'access_denied' | 'door_unlocked' | 'door_locked' | 'recognition';
  title: string;
  message: string;
  timestamp: Date;
  user?: string;
  confidence?: number;
  severity: 'info' | 'success' | 'warning' | 'error';
}

interface SecurityNotificationsProps {
  maxNotifications?: number;
  autoHideDelay?: number;
}

export function SecurityNotifications({ 
  maxNotifications = 5, 
  autoHideDelay = 10000 
}: SecurityNotificationsProps) {
  const [notifications, setNotifications] = useState<SecurityEvent[]>([]);
  const [animations] = useState(() => new Map<string, Animated.Value>());

  useEffect(() => {
    const handleSecurityEvent = (eventData: any) => {
      let event: SecurityEvent | null = null;

      // Process different types of security events
      if (eventData.type === 'recognition' || (eventData.name && eventData.confidence !== undefined)) {
        // Face recognition event
        const isAuthorized = eventData.is_authorized || false;
        const user = eventData.name || eventData.user;
        const confidence = eventData.confidence || 0;

        if (user && user !== 'Unknown') {
          event = {
            id: `recognition_${Date.now()}_${Math.random()}`,
            type: isAuthorized ? 'access_granted' : 'access_denied',
            title: isAuthorized ? 'Access Granted' : 'Access Denied',
            message: isAuthorized 
              ? `Welcome ${user}! Face recognized with ${(confidence * 100).toFixed(1)}% confidence`
              : `Unauthorized access attempt by ${user}`,
            timestamp: new Date(),
            user,
            confidence,
            severity: isAuthorized ? 'success' : 'warning'
          };
        } else if (user === 'Unknown') {
          event = {
            id: `unknown_${Date.now()}_${Math.random()}`,
            type: 'motion_detected',
            title: 'Motion Detected',
            message: 'Unknown person detected at door',
            timestamp: new Date(),
            severity: 'warning'
          };
        }
      } else if (eventData.type === 'door_unlocked' || eventData.user) {
        // Door unlocked event
        const user = eventData.user || 'Unknown';
        const autoUnlock = eventData.auto_unlock || false;
        
        event = {
          id: `unlock_${Date.now()}_${Math.random()}`,
          type: 'door_unlocked',
          title: 'Door Unlocked',
          message: autoUnlock 
            ? `Door automatically unlocked for ${user}`
            : `Door manually unlocked${user !== 'Manual' ? ` by ${user}` : ''}`,
          timestamp: new Date(),
          user: user !== 'Manual' ? user : undefined,
          severity: 'success'
        };
      } else if (eventData.type === 'door_locked') {
        // Door locked event
        event = {
          id: `lock_${Date.now()}_${Math.random()}`,
          type: 'door_locked',
          title: 'Door Locked',
          message: eventData.manual ? 'Door manually locked' : 'Door automatically locked',
          timestamp: new Date(),
          severity: 'info'
        };
      } else if (eventData.type === 'motion_detected') {
        // Motion detection event
        event = {
          id: `motion_${Date.now()}_${Math.random()}`,
          type: 'motion_detected',
          title: 'Motion Detected',
          message: 'Movement detected at door camera',
          timestamp: new Date(),
          severity: 'info'
        };
      }

      if (event) {
        addNotification(event);
      }
    };

    // Listen for security events
    doorLockApi.onSecurityEvent(handleSecurityEvent);

    return () => {
      doorLockApi.offSecurityEvent(handleSecurityEvent);
    };
  }, []);

  const addNotification = (notification: SecurityEvent) => {
    // Create animation value for new notification
    const animValue = new Animated.Value(0);
    animations.set(notification.id, animValue);

    // Add notification
    setNotifications(prev => {
      const updated = [notification, ...prev].slice(0, maxNotifications);
      return updated;
    });

    // Animate in
    Animated.timing(animValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-hide after delay
    if (autoHideDelay > 0) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, autoHideDelay);
    }
  };

  const removeNotification = (id: string) => {
    const animValue = animations.get(id);
    if (animValue) {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        animations.delete(id);
      });
    }
  };

  const getIcon = (type: SecurityEvent['type'], severity: SecurityEvent['severity']) => {
    const size = 20;
    const color = getIconColor(severity);

    switch (type) {
      case 'access_granted':
        return <UserCheck size={size} color={color} />;
      case 'access_denied':
        return <ShieldAlert size={size} color={color} />;
      case 'door_unlocked':
        return <ShieldCheck size={size} color={color} />;
      case 'door_locked':
        return <Shield size={size} color={color} />;
      case 'motion_detected':
        return <Eye size={size} color={color} />;
      case 'recognition':
        return <UserCheck size={size} color={color} />;
      default:
        return <AlertTriangle size={size} color={color} />;
    }
  };

  const getIconColor = (severity: SecurityEvent['severity']) => {
    switch (severity) {
      case 'success':
        return '#00D4FF';
      case 'warning':
        return '#FF9500';
      case 'error':
        return '#FF3B30';
      case 'info':
      default:
        return '#8E8E93';
    }
  };

  const getNotificationStyle = (severity: SecurityEvent['severity']) => {
    const baseStyle = [styles.notification];
    
    switch (severity) {
      case 'success':
        return [...baseStyle, styles.successNotification];
      case 'warning':
        return [...baseStyle, styles.warningNotification];
      case 'error':
        return [...baseStyle, styles.errorNotification];
      case 'info':
      default:
        return [...baseStyle, styles.infoNotification];
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {notifications.map((notification) => {
        const animValue = animations.get(notification.id);
        return (
          <Animated.View
            key={notification.id}
            style={[
              getNotificationStyle(notification.severity),
              {
                opacity: animValue,
                transform: [
                  {
                    translateY: animValue ? animValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-50, 0],
                    }) : 0,
                  },
                ],
              },
            ]}
          >
            <View style={styles.notificationContent}>
              <View style={styles.iconContainer}>
                {getIcon(notification.type, notification.severity)}
              </View>
              
              <View style={styles.textContainer}>
                <Text style={styles.title}>{notification.title}</Text>
                <Text style={styles.message}>{notification.message}</Text>
                <Text style={styles.timestamp}>{formatTime(notification.timestamp)}</Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => removeNotification(notification.id)}
              >
                <X size={16} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  notification: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successNotification: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  warningNotification: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  errorNotification: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  infoNotification: {
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    borderColor: 'rgba(142, 142, 147, 0.3)',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  message: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#E5E5E7',
    lineHeight: 16,
    marginBottom: 4,
  },
  timestamp: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: '#8E8E93',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
