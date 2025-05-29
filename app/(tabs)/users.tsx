import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, Platform, Alert, TextInput, TouchableOpacity, Modal, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { UsersList } from '@/components/UsersList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { User, mockUsers } from '@/utils/mockData';
import { Camera, Circle as XCircle, Save } from 'lucide-react-native';

export default function UsersScreen() {
  const [users, setUsers] = useState(mockUsers);
  const [isAddUserModalVisible, setIsAddUserModalVisible] = useState(false);
  const [isEditUserModalVisible, setIsEditUserModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newUserName, setNewUserName] = useState('');
  
  // Add user handler
  const handleAddUser = () => {
    setNewUserName('');
    setIsAddUserModalVisible(true);
  };
  
  // Edit user handler
  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setNewUserName(user.name);
    setIsEditUserModalVisible(true);
  };
  
  // Delete user handler
  const handleDeleteUser = (user: User) => {
    setUsers(prev => prev.filter(u => u.id !== user.id));
  };
  
  // Save new user (simulation)
  const saveNewUser = () => {
    if (!newUserName.trim()) {
      if (Platform.OS === 'web') {
        alert('Please enter a name');
      } else {
        Alert.alert('Error', 'Please enter a name');
      }
      return;
    }
    
    // Create new user with random ID and placeholder photo
    const newUser: User = {
      id: Math.random().toString(36).substring(2, 9),
      name: newUserName.trim(),
      photo: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600',
      addedDate: new Date().toISOString(),
    };
    
    setUsers(prev => [newUser, ...prev]);
    setIsAddUserModalVisible(false);
  };
  
  // Save edited user
  const saveEditedUser = () => {
    if (!currentUser || !newUserName.trim()) return;
    
    setUsers(prev => prev.map(user => 
      user.id === currentUser.id 
        ? { ...user, name: newUserName.trim() }
        : user
    ));
    
    setIsEditUserModalVisible(false);
    setCurrentUser(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
      </View>
      
      {/* Users list */}
      <UsersList 
        users={users}
        onAddUser={handleAddUser}
        onEditUser={handleEditUser}
        onDeleteUser={handleDeleteUser}
      />
      
      {/* Add User Modal */}
      <Modal
        visible={isAddUserModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddUserModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard} elevated>
            <Text style={styles.modalTitle}>Add New User</Text>
            
            <View style={styles.photoPlaceholder}>
              <Camera size={40} color="#8E8E93" />
              <Text style={styles.photoText}>Tap to add photo</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>User Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="#8E8E93"
                value={newUserName}
                onChangeText={setNewUserName}
              />
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setIsAddUserModalVisible(false)}
                style={styles.modalButton}
              />
              <Button
                title="Save"
                variant="primary"
                onPress={saveNewUser}
                style={styles.modalButton}
                icon={<Save size={18} color="#121214" />}
              />
            </View>
          </Card>
        </View>
      </Modal>
      
      {/* Edit User Modal */}
      <Modal
        visible={isEditUserModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditUserModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Card style={styles.modalCard} elevated>
            <Text style={styles.modalTitle}>Edit User</Text>
            
            {currentUser && (
              <View style={styles.editPhotoContainer}>
                <Image 
                  source={{ uri: currentUser.photo }}
                  style={styles.editPhoto}
                />
                <TouchableOpacity style={styles.editPhotoButton}>
                  <Camera size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>User Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="#8E8E93"
                value={newUserName}
                onChangeText={setNewUserName}
              />
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setIsEditUserModalVisible(false)}
                style={styles.modalButton}
              />
              <Button
                title="Save"
                variant="primary"
                onPress={saveEditedUser}
                style={styles.modalButton}
                icon={<Save size={18} color="#121214" />}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#121214',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  modalTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  photoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  editPhotoContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 24,
  },
  editPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00D4FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121214',
  },
});