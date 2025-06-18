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
    name: 'Chioma Okwu',
    photo: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
    addedDate: '2024-01-10T08:00:00Z',
  },
  {
    id: '2',
    name: 'Adunni Adebayo',
    photo: 'https://images.pexels.com/photos/1462980/pexels-photo-1462980.jpeg?auto=compress&cs=tinysrgb&w=600',
    addedDate: '2024-01-15T14:30:00Z',
  },
  {
    id: '3',
    name: 'Kelechi Nwosu',
    photo: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=600',
    addedDate: '2024-02-05T11:45:00Z',
  },
  {
    id: '4',
    name: 'Folake Oseni',
    photo: 'https://images.pexels.com/photos/1848565/pexels-photo-1848565.jpeg?auto=compress&cs=tinysrgb&w=600',
    addedDate: '2024-02-20T09:15:00Z',
  },
];

export const mockAccessHistory: AccessEvent[] = [
  {
    id: '1',
    userName: 'Chioma Okwu',
    userPhoto: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-15T10:30:00Z',
    status: 'success',
    confidence: 0.95,
  },
  {
    id: '2',
    userName: 'Unknown Person',
    userPhoto: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-15T09:15:00Z',
    status: 'failed',
    confidence: 0.42,
  },
  {
    id: '3',
    userName: 'Adunni Adebayo',
    userPhoto: 'https://images.pexels.com/photos/1462980/pexels-photo-1462980.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-14T18:45:00Z',
    status: 'success',
    confidence: 0.93,
  },
  {
    id: '4',
    userName: 'Kelechi Nwosu',
    userPhoto: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-14T16:20:00Z',
    status: 'success',
    confidence: 0.91,
  },
  {
    id: '5',
    userName: 'Emeka Okafor',
    userPhoto: 'https://images.pexels.com/photos/1933873/pexels-photo-1933873.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-14T15:10:00Z',
    status: 'success',
    confidence: 0.89,
  },
  {
    id: '6',
    userName: 'Folake Oseni',
    userPhoto: 'https://images.pexels.com/photos/1848565/pexels-photo-1848565.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-14T12:05:00Z',
    status: 'success',
    confidence: 0.96,
  },
  {
    id: '7',
    userName: 'Unknown Person',
    userPhoto: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-13T20:30:00Z',
    status: 'failed',
    confidence: 0.35,
  },
  {
    id: '8',
    userName: 'Ngozi Eze',
    userPhoto: 'https://images.pexels.com/photos/1722198/pexels-photo-1722198.jpeg?auto=compress&cs=tinysrgb&w=600',
    timestamp: '2024-03-13T14:15:00Z',
    status: 'success',
    confidence: 0.92,
  },
];

// Mock camera stream URL (for demonstration only)
export const mockCameraFeed: CameraFeed = {
  streamUrl: 'https://images.pexels.com/photos/271816/pexels-photo-271816.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  status: 'online',
  resolution: '720p',
};
