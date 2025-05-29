// Door status types
export type DoorStatus = {
  locked: boolean;
  systemOnline: boolean;
  cameraOnline: boolean;
  lastActivity: string;
};

// User type
export type User = {
  id: string;
  name: string;
  photo: string;
  addedDate: string;
};

// Access event type
export type AccessEvent = {
  id: string;
  userName: string;
  userPhoto: string;
  timestamp: string;
  status: 'success' | 'failed';
  confidence: number;
};

// Camera feed type
export type CameraFeed = {
  streamUrl: string;
  status: 'online' | 'offline';
  resolution: string;
};

// Mock data for the app
export const mockDoorStatus: DoorStatus = {
  locked: true,
  systemOnline: true,
  cameraOnline: true,
  lastActivity: new Date().toISOString(),
};

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    photo: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
    addedDate: '2024-01-10T08:00:00Z',
  },
  {
    id: '2',
    name: 'Jane Smith',
    photo: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
    addedDate: '2024-01-15T14:30:00Z',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    photo: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600',
    addedDate: '2024-02-05T11:45:00Z',
  },
  {
    id: '4',
    name: 'Sarah Williams',
    photo: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=600',
    addedDate: '2024-02-20T09:15:00Z',
  },
];

export const mockAccessHistory: AccessEvent[] = [
  {
    id: '1',
    userName: 'John Doe',
    userPhoto: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-15T10:30:00Z',
    status: 'success',
    confidence: 0.95,
  },
  {
    id: '2',
    userName: 'Unknown Person',
    userPhoto: 'https://images.pexels.com/photos/5952651/pexels-photo-5952651.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-15T09:15:00Z',
    status: 'failed',
    confidence: 0.42,
  },
  {
    id: '3',
    userName: 'Jane Smith',
    userPhoto: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-14T18:45:00Z',
    status: 'success',
    confidence: 0.93,
  },
  {
    id: '4',
    userName: 'Mike Johnson',
    userPhoto: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-14T16:20:00Z',
    status: 'success',
    confidence: 0.91,
  },
  {
    id: '5',
    userName: 'Unknown Person',
    userPhoto: 'https://images.pexels.com/photos/5952651/pexels-photo-5952651.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-14T15:10:00Z',
    status: 'failed',
    confidence: 0.38,
  },
  {
    id: '6',
    userName: 'Sarah Williams',
    userPhoto: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-14T12:05:00Z',
    status: 'success',
    confidence: 0.96,
  },
];

// Mock camera stream URL (for demonstration only)
export const mockCameraFeed: CameraFeed = {
  streamUrl: 'https://images.pexels.com/photos/271816/pexels-photo-271816.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  status: 'online',
  resolution: '720p',
};