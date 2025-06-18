import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Platform, Alert, TextInput, TouchableOpacity, Modal, Image, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { UsersList } from '@/components/UsersList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { User } from '@/utils/mockData';
import { doorLockApi } from '@/utils/doorLockApi';
import { Camera, Circle as XCircle, Save, FlipHorizontal, CheckCircle2, RefreshCw } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IP_ADDRESS_KEY = '@settings/raspberry_pi_ip';

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddUserModalVisible, setIsAddUserModalVisible] = useState(false);
  const [isEditUserModalVisible, setIsEditUserModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [currentIP, setCurrentIP] = useState<string>('');

  // Load users on component mount
  useEffect(() => {
    loadSavedIPAndConnect();
    
    // Listen for connection status
    doorLockApi.on('connectionStatus', handleConnectionStatus);
    
    return () => {
      doorLockApi.off('connectionStatus', handleConnectionStatus);
    };
  }, []);

  // Load users when connection status changes to connected (only once)
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const timer = setTimeout(() => {
        loadUsers();
      }, 1000); // Delay to ensure connection is stable
      
      return () => clearTimeout(timer);
    }
  }, [connectionStatus]);

  // Load saved IP address and establish connection
  const loadSavedIPAndConnect = async () => {
    try {
      const savedIP = await AsyncStorage.getItem(IP_ADDRESS_KEY);
      if (savedIP) {
        // Update the API with the saved IP address
        doorLockApi.updateServerAddress(savedIP);
        setCurrentIP(savedIP);
      }
      
      // Connect to WebSocket
      doorLockApi.connect();
      
      // Load users after connection attempt
      loadUsers();
    } catch (error) {
      console.error('Error loading saved IP:', error);
      // Still try to connect with default IP
      doorLockApi.connect();
      loadUsers();
    }
  };


  const handleConnectionStatus = (data: any) => {
    setConnectionStatus(data.status);
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      // Only try to load users if connected
      if (connectionStatus !== 'connected') {
        console.log('Not connected, skipping user load');
        setUsers([]); // Show empty state when not connected
        return;
      }
      
      // Use the new getUsers method
      const usersData = await doorLockApi.getUsers();
      
      // Convert backend users to app format
      const formattedUsers: User[] = usersData.map((user: any, index: number) => ({
        id: `${user.name}_${index}_${Date.now()}`, // Ensure unique IDs
        name: user.name,
        photo: `data:image/jpeg;base64,${user.photo || ''}`,
        addedDate: new Date().toISOString(),
      }));
      
      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      // Show placeholder empty state if connection fails
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add user handler
  const handleAddUser = () => {
    setNewUserName('');
    setCapturedPhoto(null);
    setIsAddUserModalVisible(true);
  };
  
  // Edit user handler
  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setNewUserName(user.name);
    setIsEditUserModalVisible(true);
  };
  
  // Delete user handler
  const handleDeleteUser = async (user: User) => {
    try {
      setIsLoading(true);
      
      console.log('Current users from backend before removal:');
      try {
        const currentUsers = await doorLockApi.getUsers();
        console.log('Backend users:', currentUsers.map(u => u.name));
      } catch (err) {
        console.log('Could not get current users:', err);
      }
      
      console.log('Attempting to remove user:', user.name);
      console.log('User ID:', user.id);
      
      const success = await doorLockApi.removeUser(user.name);
      
      if (success) {
        console.log('User removal successful, reloading user list...');
        // Reload users from backend to ensure consistency
        await loadUsers();
        
        if (Platform.OS === 'web') {
          alert('User removed successfully');
        } else {
          Alert.alert('Success', 'User removed successfully');
        }
      } else {
        throw new Error('Failed to remove user');
      }
    } catch (error) {
      console.error('Error removing user:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove user. Please try again.';
      
      if (Platform.OS === 'web') {
        alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Capture photo from webcam
  const captureFromWebcam = async () => {
    try {
      setIsLoading(true);
      
      // Check if connected to backend
      if (connectionStatus !== 'connected') {
        if (Platform.OS === 'web') {
          alert('Please connect to the system first. Check Settings tab to configure IP address.');
        } else {
          Alert.alert('Connection Required', 'Please connect to the system first. Check Settings tab to configure IP address.');
        }
        return;
      }

      // Capture photo from webcam via backend
      const imageData = await doorLockApi.captureWebcamPhoto();
      setCapturedPhoto(imageData);

    } catch (error) {
      console.error('Error capturing from webcam:', error);
      if (Platform.OS === 'web') {
        alert('Failed to capture from webcam. Please ensure the camera is connected and try again.');
      } else {
        Alert.alert('Error', 'Failed to capture from webcam. Please ensure the camera is connected and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };


  // Save new user using Raspberry Pi face recognition
  const saveNewUser = async () => {
    if (!newUserName.trim()) {
      if (Platform.OS === 'web') {
        alert('Please enter a name');
      } else {
        Alert.alert('Error', 'Please enter a name');
      }
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log('Adding user via Raspberry Pi face recognition:', newUserName.trim());
      
      // Check if connected to backend
      if (connectionStatus !== 'connected') {
        throw new Error('Please connect to the system first. Check Settings tab to configure IP address.');
      }

      // Use the backend's direct face recognition enrollment
      const success = await doorLockApi.addUserFromWebcam(newUserName.trim());
      
      if (success) {
        console.log('User enrolled successfully via Raspberry Pi');
        
        // Reload users from backend to get the actual saved data
        await loadUsers();
        
        setIsAddUserModalVisible(false);
        setCapturedPhoto(null);
        setNewUserName('');
        
        if (Platform.OS === 'web') {
          alert(`User "${newUserName.trim()}" enrolled successfully! The system has captured and processed their face automatically.`);
        } else {
          Alert.alert('Success', `User "${newUserName.trim()}" enrolled successfully! The system has captured and processed their face automatically.`);
        }
      } else {
        throw new Error('Failed to enroll user');
      }
    } catch (error) {
      console.error('Error enrolling user:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to enroll user. Please try again.';
      
      if (Platform.OS === 'web') {
        alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Quick add user directly from webcam (no preview)
  const quickAddFromWebcam = async () => {
    if (!newUserName.trim()) {
      if (Platform.OS === 'web') {
        alert('Please enter a name first');
      } else {
        Alert.alert('Error', 'Please enter a name first');
      }
      return;
    }

    try {
      setIsLoading(true);
      
      // Check if connected to backend
      if (connectionStatus !== 'connected') {
        if (Platform.OS === 'web') {
          alert('Please connect to the system first. Check Settings tab to configure IP address.');
        } else {
          Alert.alert('Connection Required', 'Please connect to the system first. Check Settings tab to configure IP address.');
        }
        return;
      }

      // Add user directly from webcam
      const success = await doorLockApi.addUserFromWebcam(newUserName.trim());
      
      if (success) {
        // Reload users to get updated list
        await loadUsers();
        
        setIsAddUserModalVisible(false);
        setCapturedPhoto(null);
        setNewUserName('');
        
        if (Platform.OS === 'web') {
          alert(`User "${newUserName.trim()}" added successfully from webcam!`);
        } else {
          Alert.alert('Success', `User "${newUserName.trim()}" added successfully from webcam!`);
        }
      } else {
        throw new Error('Failed to add user from webcam');
      }
    } catch (error) {
      console.error('Error adding user from webcam:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to add user from webcam';
      
      if (Platform.OS === 'web') {
        alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
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

  // Retry connection
  const retryConnection = () => {
    doorLockApi.reconnect();
    setTimeout(() => {
      loadUsers();
    }, 1000);
  };


  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        {connectionStatus !== 'connected' && (
          <TouchableOpacity onPress={retryConnection} style={styles.retryButton}>
            <RefreshCw size={20} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      {/* Connection status */}
      {connectionStatus !== 'connected' && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>
            {connectionStatus === 'connecting' ? 'Connecting to system...' : 'System offline - showing cached data'}
          </Text>
        </View>
      )}
      
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
            
            <View style={styles.enrollmentInfo}>
              <Camera size={48} color="#00D4FF" />
              <Text style={styles.enrollmentTitle}>Face Recognition Enrollment</Text>
              <Text style={styles.enrollmentDescription}>
                The Raspberry Pi will automatically capture and process your face using its camera.
              </Text>
              <View style={styles.enrollmentSteps}>
                <Text style={styles.stepText}>1. Position yourself in front of the camera</Text>
                <Text style={styles.stepText}>2. Ensure good lighting and only one face visible</Text>
                <Text style={styles.stepText}>3. Click "Enroll User" when ready</Text>
              </View>
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
                onPress={() => {
                  setIsAddUserModalVisible(false);
                  setCapturedPhoto(null);
                  setNewUserName('');
                }}
                style={styles.modalButton}
                disabled={isLoading}
              />
              <Button
                title={isLoading ? "Adding..." : "Add User"}
                variant="primary"
                onPress={saveNewUser}
                style={styles.modalButton}
                icon={!isLoading && <Save size={18} color="#121214" />}
                disabled={isLoading}
              />
            </View>
            
            {/* Quick add option */}
            <View style={styles.quickAddContainer}>
              <Text style={styles.quickAddLabel}>Quick Add (Auto-capture)</Text>
              <Button
                title={isLoading ? "Adding..." : "Quick Add from Webcam"}
                variant="secondary"
                onPress={quickAddFromWebcam}
                style={styles.quickAddButton}
                icon={!isLoading && <CheckCircle2 size={18} color="#121214" />}
                disabled={isLoading || !newUserName.trim()}
              />
              <Text style={styles.quickAddNote}>
                This will automatically capture and add the user without preview
              </Text>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#121214',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  retryButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  statusBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 152, 0, 0.2)',
  },
  statusText: {
    color: '#FF9500',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  retakeButton: {
    alignSelf: 'center',
    marginBottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  retakeText: {
    color: '#00D4FF',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  photoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'space-between',
    zIndex: 1000,
    elevation: 1000,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  faceFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    height: 200,
    marginTop: -100,
    marginLeft: -100,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#00FF88',
    borderStyle: 'dashed',
  },
  cameraFooter: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 30,
    textAlign: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00FF88',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1000,
  },
  flipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1000,
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  quickAddContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickAddLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickAddButton: {
    marginBottom: 12,
  },
  quickAddNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6C6C70',
    textAlign: 'center',
    lineHeight: 16,
  },
  enrollmentInfo: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.1)',
  },
  enrollmentTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  enrollmentDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  enrollmentSteps: {
    alignSelf: 'stretch',
  },
  stepText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 6,
    paddingLeft: 8,
  },
});
