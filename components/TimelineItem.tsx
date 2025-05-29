import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { AccessEvent } from '@/utils/mockData';
import { formatTime, formatDate } from '@/utils/dateUtils';
import { CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react-native';

interface TimelineItemProps {
  event: AccessEvent;
  isLast?: boolean;
}

export const TimelineItem = ({ event, isLast = false }: TimelineItemProps) => {
  const { userName, userPhoto, timestamp, status, confidence } = event;
  const isSuccess = status === 'success';
  const confidencePercent = Math.round(confidence * 100);
  
  // Get date string for grouping events by date
  const dateStr = formatDate(timestamp);
  const timeStr = formatTime(timestamp);
  
  return (
    <View style={styles.container}>
      {/* Timeline connector */}
      <View style={styles.timelineContainer}>
        <View style={[
          styles.timelineDot,
          { backgroundColor: isSuccess ? '#00FF88' : '#FF3B30' }
        ]}>
          {isSuccess ? (
            <CheckCircle size={12} color="#000000" />
          ) : (
            <XCircle size={12} color="#000000" />
          )}
        </View>
        {!isLast && <View style={styles.timelineConnector} />}
      </View>
      
      {/* Content */}
      <View style={styles.contentContainer}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Image source={{ uri: userPhoto }} style={styles.userPhoto} />
            <View style={styles.headerText}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.timestamp}>{timeStr}</Text>
            </View>
          </View>
          
          <View style={styles.cardContent}>
            <View style={styles.statusContainer}>
              <Text style={[
                styles.statusText,
                { color: isSuccess ? '#00FF88' : '#FF3B30' }
              ]}>
                {isSuccess ? 'Access Granted' : 'Access Denied'}
              </Text>
            </View>
            
            {isSuccess && (
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>Match confidence:</Text>
                <View style={styles.confidenceBarContainer}>
                  <View style={[
                    styles.confidenceBar,
                    { 
                      width: `${confidencePercent}%`,
                      backgroundColor: getConfidenceColor(confidence)
                    }
                  ]} />
                </View>
                <Text style={styles.confidenceValue}>{confidencePercent}%</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Date label if provided */}
        <Text style={styles.dateLabel}>{dateStr}</Text>
      </View>
    </View>
  );
};

// Get color based on confidence level
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return '#00FF88';
  if (confidence >= 0.7) return '#00D4FF';
  return '#FF9500';
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  timelineContainer: {
    width: 40,
    alignItems: 'center',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00FF88',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121214',
  },
  timelineConnector: {
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 4,
    marginBottom: -8,
  },
  contentContainer: {
    flex: 1,
    marginRight: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  userPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  userName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  timestamp: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  cardContent: {
    padding: 12,
  },
  statusContainer: {
    marginBottom: 8,
  },
  statusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    width: 120,
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
  confidenceValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 8,
    width: 30,
    textAlign: 'right',
  },
  dateLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    marginLeft: 4,
  },
});