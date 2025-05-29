import React from 'react';
import { StyleSheet, View, Text, FlatList, ListRenderItem, TouchableOpacity } from 'react-native';
import { User } from '@/utils/mockData';
import { UserCard } from './UserCard';
import { UserPlus } from 'lucide-react-native';

interface UsersListProps {
  users: User[];
  onAddUser?: () => void;
  onEditUser?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
}

export const UsersList = ({ 
  users, 
  onAddUser,
  onEditUser,
  onDeleteUser
}: UsersListProps) => {
  const renderItem: ListRenderItem<User> = ({ item }) => {
    return (
      <UserCard 
        user={item} 
        onEdit={onEditUser}
        onDelete={onDeleteUser}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Authorized Users</Text>
        
        {onAddUser && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={onAddUser}
          >
            <UserPlus size={20} color="#00D4FF" />
            <Text style={styles.addButtonText}>Add User</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No users added yet</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    color: '#FFFFFF',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#00D4FF',
    marginLeft: 6,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#8E8E93',
  },
});