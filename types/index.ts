export interface FaceLocation {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FaceDetectionResult {
  name: string;
  confidence: number;
  is_authorized: boolean;
  location: FaceLocation;
}

export interface FrameResult {
  faces: FaceDetectionResult[];
  timestamp: string;
  door_status: {
    is_unlocked: boolean;
    pin: number;
    duration: number;
  };
}
