import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Modal, Alert, Platform, Dimensions, TouchableOpacity, Image } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { doorLockApi } from '@/utils/doorLockApi';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  User,
  Zap
} from 'lucide-react-native';

interface FaceEnrollmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userName: string;
}

interface EnrollmentProgress {
  current: number;
  total: number;
  message: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function FaceEnrollmentModal({ 
  visible, 
  onClose, 
  onSuccess, 
  userName 
}: FaceEnrollmentModalProps) {
  const [enrollmentState, setEnrollmentState] = useState<'preview' | 'enrolling' | 'success' | 'error'>('preview');
  const [progress, setProgress] = useState<EnrollmentProgress>({ current: 0, total: 5, message: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCapturingPreview, setIsCapturingPreview] = useState(false);
  const previewInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start webcam preview when modal opens
  useEffect(() => {
    if (visible && enrollmentState === 'preview') {
      startPreview();
    } else {
      stopPreview();
    }

    return () => {
      stopPreview();
    };
  }, [visible, enrollmentState]);

  const startPreview = () => {
    // Capture preview frames every 500ms
    previewInterval.current = setInterval(async () => {
      if (!isCapturingPreview) {
        try {
          setIsCapturingPreview(true);
          const imageData = await doorLockApi.captureWebcamPhoto();
          setPreviewImage(imageData);
        } catch (error) {
          console.log('Preview capture failed:', error);
          // Don't show error for preview failures, just continue
        } finally {
          setIsCapturingPreview(false);
        }
      }
    }, 500);
  };

  const stopPreview = () => {
    if (previewInterval.current) {
      clearInterval(previewInterval.current);
      previewInterval.current = null;
    }
  };

  const handleStartEnrollment = async () => {
    if (!userName.trim()) {
      return;
    }

    setEnrollmentState('enrolling');
    setProgress({ current: 0, total: 5, message: 'Starting enrollment...' });
    stopPreview(); // Stop preview during enrollment

    try {
      const success = await doorLockApi.addUserFromWebcam(
        userName.trim(),
        (progressData: EnrollmentProgress) => {
          setProgress(progressData);
        }
      );

      if (success) {
        setEnrollmentState('success');
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        setEnrollmentState('error');
        setErrorMessage('Failed to enroll user. Please try again.');
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      setEnrollmentState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Enrollment failed. Please try again.');
    }
  };

  const handleClose = () => {
    stopPreview();
    setEnrollmentState('preview');
    setProgress({ current: 0, total: 5, message: '' });
    setErrorMessage('');
    setPreviewImage(null);
    onClose();
  };

  const handleRetry = () => {
    setEnrollmentState('preview');
    setErrorMessage('');
    setProgress({ current: 0, total: 5, message: '' });
    startPreview();
  };

  const renderPreviewContent = () => (
    <>
      <View style={styles.previewContainer}>
        <Text style={styles.modalTitle}>Face Recognition Preview</Text>
        <Text style={styles.subtitle}>Position yourself in front of the camera</Text>
        
        <View style={styles.webcamContainer}>
          {previewImage ? (
            <Image 
              source={{ uri: previewImage }} 
              style={styles.webcamPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.webcamPlaceholder}>
              <Camera size={48} color="#00D4FF" />
              <Text style={styles.placeholderText}>Loading camera...</Text>
            </View>
          )}
          
          {/* Face guide overlay */}
          <View style={styles.faceGuideOverlay}>
            <View style={styles.faceGuide}>
              <Text style={styles.guideText}>Align your face here</Text>
            </View>
          </View>
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Enrollment Instructions</Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instructionItem}>✓ Ensure good lighting</Text>
            <Text style={styles.instructionItem}>✓ Keep only one face visible</Text>
            <Text style={styles.instructionItem}>✓ Look directly at the camera</Text>
            <Text style={styles.instructionItem}>✓ Stay still during capture</Text>
          </View>
          
          <View style={styles.infoBox}>
            <Zap size={16} color="#00D4FF" />
            <Text style={styles.infoText}>
              The system will capture 5 photos automatically for improved accuracy
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.modalActions}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={handleClose}
          style={styles.modalButton}
          icon={<X size={18} color="#FFFFFF" />}
        />
        <Button
          title="Start Enrollment"
          variant="primary"
          onPress={handleStartEnrollment}
          style={styles.modalButton}
          icon={<User size={18} color="#121214" />}
          disabled={!previewImage}
        />
      </View>
    </>
  );

  const renderEnrollingContent = () => (
    <>
      <View style={styles.enrollingContainer}>
        <Text style={styles.modalTitle}>Enrolling User</Text>
        <Text style={styles.subtitle}>{userName}</Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressText}>
              {progress.current}/{progress.total}
            </Text>
          </View>
          
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(progress.current / progress.total) * 100}%` }
              ]} 
            />
          </View>
          
          <Text style={styles.progressMessage}>{progress.message}</Text>
        </View>

        <View style={styles.enrollmentTips}>
          <AlertTriangle size={20} color="#FF9500" />
          <Text style={styles.tipsText}>
            Please remain still and keep looking at the camera
          </Text>
        </View>
      </View>
    </>
  );

  const renderSuccessContent = () => (
    <>
      <View style={styles.successContainer}>
        <CheckCircle2 size={64} color="#00FF88" />
        <Text style={styles.modalTitle}>Enrollment Successful!</Text>
        <Text style={styles.subtitle}>
          {userName} has been enrolled successfully
        </Text>
        
        <View style={styles.successInfo}>
          <Text style={styles.successDetail}>
            ✓ {progress.total} photos captured
          </Text>
          <Text style={styles.successDetail}>
            ✓ Face encoding created
          </Text>
          <Text style={styles.successDetail}>
            ✓ User authorized for access
          </Text>
        </View>
      </View>
    </>
  );

  const renderErrorContent = () => (
    <>
      <View style={styles.errorContainer}>
        <X size={64} color="#FF3B30" />
        <Text style={styles.modalTitle}>Enrollment Failed</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>

      <View style={styles.modalActions}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={handleClose}
          style={styles.modalButton}
        />
        <Button
          title="Try Again"
          variant="primary"
          onPress={handleRetry}
          style={styles.modalButton}
          icon={<RefreshCw size={18} color="#121214" />}
        />
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <Card style={styles.modalCard} elevated>
          {enrollmentState === 'preview' && renderPreviewContent()}
          {enrollmentState === 'enrolling' && renderEnrollingContent()}
          {enrollmentState === 'success' && renderSuccessContent()}
          {enrollmentState === 'error' && renderErrorContent()}
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    padding: 24,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  previewContainer: {
    alignItems: 'center',
  },
  webcamContainer: {
    position: 'relative',
    width: 300,
    height: 225,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  webcamPreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as any,
  },
  webcamPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  placeholderText: {
    color: '#8E8E93',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 12,
  },
  faceGuideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 120,
    height: 150,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#00FF88',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
  },
  guideText: {
    color: '#00FF88',
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  instructionsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  instructionsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionsList: {
    marginBottom: 16,
  },
  instructionItem: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 6,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  infoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#00D4FF',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  enrollingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#00D4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  progressText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#00D4FF',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00D4FF',
    borderRadius: 3,
  },
  progressMessage: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  enrollmentTips: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  tipsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#FF9500',
    marginLeft: 8,
    flex: 1,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successInfo: {
    marginTop: 24,
    alignSelf: 'stretch',
  },
  successDetail: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#00FF88',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 24,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});
