import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, ScrollView, Modal, FlatList, Image, Alert, Dimensions, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { CameraView } from '@/components/CameraView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { mockCameraFeed } from '@/utils/mockData';
import { doorLockApi } from '@/utils/doorLockApi';
import { Camera, Zap, Image as ImageIcon, X, Trash2, Share, Download } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const imageSize = (width - 48) / 3; // 3 images per row with padding

interface GalleryImage {
  id: string;
  uri: string;
  timestamp: string;
  type: 'captured' | 'library';
}

export default function CameraScreen() {
  const [isFullScreenCamera, setIsFullScreenCamera] = useState(false);
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [cameraFeed, setCameraFeed] = useState(mockCameraFeed);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  
  // Load gallery images on component mount
  useEffect(() => {
    loadGalleryImages();
  }, []);

  // Request media library permission
  useEffect(() => {
    if (mediaLibraryPermission && !mediaLibraryPermission.granted) {
      requestMediaLibraryPermission();
    }
  }, [mediaLibraryPermission, requestMediaLibraryPermission]);

  const loadGalleryImages = async () => {
    try {
      if (!mediaLibraryPermission?.granted) {
        return;
      }

      // Get recent photos from device gallery
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        sortBy: 'creationTime',
        first: 50,
      });

      const libraryImages: GalleryImage[] = media.assets.map((asset: any, index: number) => ({
        id: `library_${asset.id}`,
        uri: asset.uri,
        timestamp: new Date(asset.creationTime).toISOString(),
        type: 'library',
      }));

      // Add some mock captured images for demonstration
      const mockCapturedImages: GalleryImage[] = [
        {
          id: 'captured_1',
          uri: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          type: 'captured',
        },
        {
          id: 'captured_2',
          uri: 'https://images.pexels.com/photos/1462980/pexels-photo-1462980.jpeg?auto=compress&cs=tinysrgb&w=600',
          timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          type: 'captured',
        },
        {
          id: 'captured_3',
          uri: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=600',
          timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
          type: 'captured',
        },
      ];

      // Combine and sort all images by timestamp
      const allImages = [...mockCapturedImages, ...libraryImages.slice(0, 20)]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setGalleryImages(allImages);
    } catch (error) {
      console.error('Error loading gallery images:', error);
    }
  };
  
  // Toggle camera fullscreen
  const toggleFullScreen = () => {
    console.log('CameraScreen: toggleFullScreen called, current state:', isFullScreenCamera);
    setIsFullScreenCamera(prev => {
      const newState = !prev;
      console.log('CameraScreen: Setting isFullScreenCamera to:', newState);
      return newState;
    });
  };
  
  // Take snapshot (simulated)
  const takeSnapshot = () => {
    // Simulate capturing a new image
    const newImage: GalleryImage = {
      id: `captured_${Date.now()}`,
      uri: 'https://images.pexels.com/photos/1848565/pexels-photo-1848565.jpeg?auto=compress&cs=tinysrgb&w=600',
      timestamp: new Date().toISOString(),
      type: 'captured',
    };

    setGalleryImages(prev => [newImage, ...prev]);
    
    if (Platform.OS === 'web') {
      alert('Snapshot captured and saved to gallery');
    } else {
      Alert.alert('Success', 'Snapshot captured and saved to gallery');
    }
  };

  // Open gallery
  const openGallery = async () => {
    if (!mediaLibraryPermission?.granted) {
      const result = await requestMediaLibraryPermission();
      if (!result.granted) {
        if (Platform.OS === 'web') {
          alert('Media library permission is required to access gallery');
        } else {
          Alert.alert('Permission Required', 'Media library permission is required to access gallery');
        }
        return;
      }
    }

    await loadGalleryImages();
    setIsGalleryVisible(true);
  };

  // Open image picker
  const openImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage: GalleryImage = {
          id: `imported_${Date.now()}`,
          uri: result.assets[0].uri,
          timestamp: new Date().toISOString(),
          type: 'library',
        };

        setGalleryImages(prev => [newImage, ...prev]);
        
        if (Platform.OS === 'web') {
          alert('Image imported to gallery');
        } else {
          Alert.alert('Success', 'Image imported to gallery');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      if (Platform.OS === 'web') {
        alert('Failed to import image');
      } else {
        Alert.alert('Error', 'Failed to import image');
      }
    }
  };

  // View image in fullscreen
  const viewImage = (image: GalleryImage) => {
    setSelectedImage(image);
    setIsImageViewerVisible(true);
  };

  // Delete image
  const deleteImage = (imageId: string) => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to delete this image?')) {
        setGalleryImages(prev => prev.filter(img => img.id !== imageId));
        setIsImageViewerVisible(false);
        setSelectedImage(null);
      }
    } else {
      Alert.alert(
        'Delete Image',
        'Are you sure you want to delete this image?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive', 
            onPress: () => {
              setGalleryImages(prev => prev.filter(img => img.id !== imageId));
              setIsImageViewerVisible(false);
              setSelectedImage(null);
            }
          }
        ]
      );
    }
  };

  // Share image (simulated)
  const shareImage = () => {
    if (Platform.OS === 'web') {
      alert('Share functionality - would open share dialog');
    } else {
      Alert.alert('Share', 'Share functionality - would open share dialog');
    }
  };
  
  // Toggle camera status (simulation)
  const toggleCameraStatus = () => {
    setCameraFeed(prev => ({
      ...prev,
      status: prev.status === 'online' ? 'offline' : 'online'
    }));
  };

  // Handle back button press for fullscreen camera
  useEffect(() => {
    const backAction = () => {
      if (isFullScreenCamera) {
        console.log('CameraScreen: Back button pressed, minimizing fullscreen camera');
        setIsFullScreenCamera(false);
        return true; // Prevent default back action
      }
      return false; // Allow default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [isFullScreenCamera]);

  const renderGalleryItem = ({ item }: { item: GalleryImage }) => (
    <TouchableOpacity
      style={styles.galleryItem}
      onPress={() => viewImage(item)}
    >
      <Image source={{ uri: item.uri }} style={styles.galleryImage} />
      <View style={styles.imageOverlay}>
        <Text style={styles.imageType}>
          {item.type === 'captured' ? 'CAP' : 'LIB'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.title}>Camera Control</Text>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Camera Feed */}
        <View style={styles.cameraContainer}>
          <CameraView 
            cameraFeed={cameraFeed}
            onToggleFullScreen={toggleFullScreen}
            onSnapshot={takeSnapshot}
          />
        </View>
        
        {/* Camera Controls */}
        <View style={styles.controlsSection}>
          <Text style={styles.sectionTitle}>Camera Controls</Text>
          
          <View style={styles.controlsGrid}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={takeSnapshot}
            >
              <Camera size={28} color="#00D4FF" />
              <Text style={styles.controlText}>Snapshot</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={openGallery}
            >
              <ImageIcon size={28} color="#00D4FF" />
              <Text style={styles.controlText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Camera Status */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Camera Status</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[
                styles.statusValue, 
                { color: cameraFeed.status === 'online' ? '#00FF88' : '#FF3B30' }
              ]}>
                {cameraFeed.status === 'online' ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Resolution:</Text>
              <Text style={styles.statusValue}>{cameraFeed.resolution}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Motion Detection:</Text>
              <Text style={styles.statusValue}>Active</Text>
            </View>
            
            <Button 
              title={cameraFeed.status === 'online' ? 'Disable Camera' : 'Enable Camera'}
              variant={cameraFeed.status === 'online' ? 'danger' : 'success'}
              onPress={toggleCameraStatus}
              style={styles.statusButton}
              icon={<Zap size={18} color={cameraFeed.status === 'online' ? '#FFFFFF' : '#121214'} />}
            />
          </View>
        </View>
      </ScrollView>

      {/* Gallery Modal */}
      <Modal
        visible={isGalleryVisible}
        animationType="slide"
        onRequestClose={() => setIsGalleryVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Camera Gallery</Text>
            <View style={styles.galleryActions}>
              <TouchableOpacity 
                style={styles.galleryActionButton}
                onPress={openImagePicker}
              >
                <Download size={20} color="#00D4FF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.galleryActionButton}
                onPress={() => setIsGalleryVisible(false)}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {galleryImages.length === 0 ? (
            <View style={styles.emptyGallery}>
              <ImageIcon size={64} color="#8E8E93" />
              <Text style={styles.emptyGalleryText}>No images in gallery</Text>
              <Button
                title="Import Image"
                variant="primary"
                onPress={openImagePicker}
                style={styles.importButton}
                icon={<Download size={18} color="#121214" />}
              />
            </View>
          ) : (
            <FlatList
              data={galleryImages}
              renderItem={renderGalleryItem}
              keyExtractor={(item) => item.id}
              numColumns={3}
              contentContainerStyle={styles.galleryList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={isImageViewerVisible}
        animationType="fade"
        onRequestClose={() => setIsImageViewerVisible(false)}
      >
        <View style={styles.imageViewerContainer}>
          {selectedImage && (
            <>
              <View style={styles.imageViewerHeader}>
                <TouchableOpacity 
                  style={styles.imageViewerButton}
                  onPress={() => setIsImageViewerVisible(false)}
                >
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
                
                <View style={styles.imageViewerActions}>
                  <TouchableOpacity 
                    style={styles.imageViewerButton}
                    onPress={shareImage}
                  >
                    <Share size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.imageViewerButton}
                    onPress={() => deleteImage(selectedImage.id)}
                  >
                    <Trash2 size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.imageViewerContent}>
                <Image 
                  source={{ uri: selectedImage.uri }} 
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.imageViewerFooter}>
                <Text style={styles.imageInfo}>
                  {selectedImage.type === 'captured' ? 'Camera Capture' : 'Library Import'}
                </Text>
                <Text style={styles.imageTimestamp}>
                  {new Date(selectedImage.timestamp).toLocaleString()}
                </Text>
              </View>
            </>
          )}
        </View>
      </Modal>
      
      {/* Fullscreen camera overlay */}
      {isFullScreenCamera && (
        <CameraView 
          cameraFeed={cameraFeed}
          isFullScreen
          onToggleFullScreen={toggleFullScreen}
          onSnapshot={takeSnapshot}
        />
      )}
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  cameraContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    height: 240,
  },
  controlsSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  controlsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  controlButton: {
    width: '48%',
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 8,
  },
  statusSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#8E8E93',
  },
  statusValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  statusButton: {
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#121214',
  },
  galleryHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  galleryTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  galleryActions: {
    flexDirection: 'row',
  },
  galleryActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  emptyGallery: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyGalleryText: {
    fontFamily: 'Inter-Regular',
    fontSize: 18,
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 24,
  },
  importButton: {
    paddingHorizontal: 32,
  },
  galleryList: {
    padding: 16,
  },
  galleryItem: {
    width: imageSize,
    height: imageSize,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  imageType: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageViewerHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageViewerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerActions: {
    flexDirection: 'row',
  },
  imageViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  imageViewerFooter: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingTop: 16,
  },
  imageInfo: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  imageTimestamp: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8E8E93',
  },
});
