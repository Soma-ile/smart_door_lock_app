import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Card } from './ui/Card';
import { User } from '@/utils/mockData';
import { formatDate } from '@/utils/dateUtils';
import { Trash2, CreditCard as Edit } from 'lucide-react-native';

interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  onDelete?: (user: User) => void;
}

export const UserCard = ({ user, onEdit, onDelete }: UserCardProps) => {
  const { name, photo, addedDate } = user;

  const handleEdit = () => {
    if (onEdit) {
      onEdit(user);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to remove this user?')) {
        onDelete?.(user);
      }
    } else {
      Alert.alert(
        'Remove User',
        `Are you sure you want to remove ${name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => onDelete?.(user) }
        ]
      );
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
    >
      <Card style={styles.card} elevated>
        <View style={styles.container}>
          <Image 
            source={{ uri: photo }}
            style={styles.photo}
          />
          
          <View style={styles.content}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.date}>Added: {formatDate(addedDate)}</Text>
          </View>
          
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.editButton]} 
                onPress={handleEdit}
              >
                <Edit size={16} color="#00D4FF" />
              </TouchableOpacity>
            )}
            
            {onDelete && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]} 
                onPress={handleDelete}
              >
                <Trash2 size={16} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  content: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  date: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
});