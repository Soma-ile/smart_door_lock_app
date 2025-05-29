import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { Card } from './ui/Card';
import { AccessEvent } from '@/utils/mockData';
import { getRelativeTime } from '@/utils/dateUtils';
import { CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react-native';

interface ActivityCardProps {
  activity: AccessEvent;
}

export const ActivityCard = ({ activity }: ActivityCardProps) => {
  const { userName, userPhoto, timestamp, status, confidence } = activity;
  const isSuccess = status === 'success';
  const confidencePercent = Math.round(confidence * 100);
  
  return (
    <Animated.View
      entering={FadeInRight.duration(300).delay(200)}
      exiting={FadeOutLeft.duration(200)}
    >
      <Card style={styles.card} elevated>
        <View style={styles.container}>
          <View style={styles.photoContainer}>
            <Image 
              source={{ uri: userPhoto }}
              style={styles.photo}
            />
            <View style={[
              styles.statusIndicator, 
              { backgroundColor: isSuccess ? '#00FF88' : '#FF3B30' }
            ]}>
              {isSuccess ? (
                <CheckCircle size={16} color="#000000" />
              ) : (
                <XCircle size={16} color="#000000" />
              )}
            </View>
          </View>
          
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.name}>{userName}</Text>
              <Text style={styles.time}>{getRelativeTime(timestamp)}</Text>
            </View>
            
            <View style={styles.details}>
              <Text style={styles.status}>
                {isSuccess ? 'Access Granted' : 'Access Denied'}
              </Text>
              
              {isSuccess && (
                <View style={styles.confidenceContainer}>
                  <Text style={styles.confidenceLabel}>Confidence:</Text>
                  <View style={styles.confidenceBarContainer}>
                    <View 
                      style={[
                        styles.confidenceBar, 
                        { 
                          width: `${confidencePercent}%`,
                          backgroundColor: getConfidenceColor(confidence)
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.confidencePercent}>{confidencePercent}%</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
};

// Get color based on confidence level
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return '#00FF88';
  if (confidence >= 0.7) return '#00D4FF';
  return '#FF9500';
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  container: {
    flexDirection: 'row',
  },
  photoContainer: {
    position: 'relative',
    marginRight: 12,
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121214',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  time: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
  },
  details: {
    marginTop: 4,
  },
  status: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    marginRight: 8,
  },
  confidenceBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceBar: {
    height: '100%',
    borderRadius: 3,
  },
  confidencePercent: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 8,
    width: 35,
  },
});