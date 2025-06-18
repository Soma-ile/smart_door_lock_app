import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TextInput, TouchableOpacity, Platform, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AccessEvent } from '@/utils/mockData';
import { TimelineItem } from '@/components/TimelineItem';
import { formatDate } from '@/utils/dateUtils';
import { doorLockApi } from '@/utils/doorLockApi';
import { Search, X, FilterX, RefreshCw } from 'lucide-react-native';

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [history, setHistory] = useState<AccessEvent[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<AccessEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [userPhotos, setUserPhotos] = useState<{[key: string]: string}>({});

  // Get user photo from cache or fetch from backend
  const getUserPhoto = async (userName: string): Promise<string> => {
    // Return cached photo if available
    if (userPhotos[userName]) {
      return userPhotos[userName];
    }

    try {
      // Fetch users to get photos
      const users = await doorLockApi.getUsers();
      const user = users.find(u => u.name === userName);
      
      if (user && user.photo) {
        const photoUrl = `data:image/jpeg;base64,${user.photo}`;
        setUserPhotos(prev => ({ ...prev, [userName]: photoUrl }));
        return photoUrl;
      }
    } catch (error) {
      console.error('Error fetching user photo:', error);
    }

    // Return placeholder if no photo found
    const placeholder = 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=600';
    setUserPhotos(prev => ({ ...prev, [userName]: placeholder }));
    return placeholder;
  };

  // Load access history
  const loadHistory = async () => {
    try {
      setIsLoading(true);
      
      // Only try to load history if connected
      if (connectionStatus !== 'connected') {
        console.log('Not connected, showing empty history');
        setHistory([]);
        return;
      }

      // Try to get access history from backend
      const historyData = await doorLockApi.getAccessHistory();
      console.log('Loaded access history:', historyData);
      
      // Convert backend history to app format and get photos
      const formattedHistory: AccessEvent[] = await Promise.all(
        historyData.map(async (item: any, index: number) => {
          const userPhoto = await getUserPhoto(item.name || 'Unknown');
          return {
            id: `access_${index}_${Date.now()}`,
            userName: item.name || 'Unknown',
            userPhoto: userPhoto,
            timestamp: new Date(item.timestamp || Date.now()).toISOString(),
            status: (item.is_authorized !== false) ? 'success' : 'failed',
            confidence: item.confidence || 0
          };
        })
      );
      
      // Sort by timestamp (newest first)
      formattedHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setHistory(formattedHistory);
      console.log('Formatted history:', formattedHistory);
      
    } catch (error) {
      console.error('Error loading access history:', error);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for connection status changes
  useEffect(() => {
    const handleConnectionStatus = (data: any) => {
      setConnectionStatus(data.status);
    };

    doorLockApi.on('connectionStatus', handleConnectionStatus);
    
    return () => {
      doorLockApi.off('connectionStatus', handleConnectionStatus);
    };
  }, []);

  // Load history when connected
  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadHistory();
    }
  }, [connectionStatus]);

  // Listen for new access events to update history in real-time
  useEffect(() => {
    const handleNewEvent = async (eventData: any) => {
      // Only add if it's a recognition event with user info
      if (eventData.name && eventData.name !== 'Unknown') {
        const userPhoto = await getUserPhoto(eventData.name);
        const newEvent: AccessEvent = {
          id: `live_${Date.now()}_${Math.random()}`,
          userName: eventData.name,
          userPhoto: userPhoto,
          timestamp: new Date().toISOString(),
          status: (eventData.is_authorized !== false) ? 'success' : 'failed',
          confidence: eventData.confidence || 0
        };

        setHistory(prev => [newEvent, ...prev].slice(0, 100)); // Keep latest 100 events
      }
    };

    const handleUnlockEvent = async (data: any) => {
      if (data.user && data.user !== 'Manual') {
        const userPhoto = await getUserPhoto(data.user);
        const newEvent: AccessEvent = {
          id: `unlock_${Date.now()}_${Math.random()}`,
          userName: data.user,
          userPhoto: userPhoto,
          timestamp: new Date().toISOString(),
          status: 'success',
          confidence: 1.0
        };

        setHistory(prev => [newEvent, ...prev].slice(0, 100));
      }
    };

    doorLockApi.on('recognition', handleNewEvent);
    doorLockApi.on('door_unlocked', handleUnlockEvent);

    return () => {
      doorLockApi.off('recognition', handleNewEvent);
      doorLockApi.off('door_unlocked', handleUnlockEvent);
    };
  }, []);

  // Filter history based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHistory(history);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = history.filter(item => 
      item.userName.toLowerCase().includes(query) ||
      formatDate(item.timestamp).toLowerCase().includes(query)
    );
    
    setFilteredHistory(filtered);
  }, [searchQuery, history]);
  
  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.title}>Access History</Text>
      </View>
      
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or date"
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* History Timeline */}
      {filteredHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FilterX size={48} color="#8E8E93" />
          <Text style={styles.emptyText}>No matching records found</Text>
          <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
            <Text style={styles.clearButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TimelineItem 
              event={item} 
              isLast={index === filteredHistory.length - 1}
            />
          )}
          contentContainerStyle={styles.listContent}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  listContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
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
    marginTop: 16,
  },
  clearButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 20,
  },
  clearButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#00D4FF',
  },
});
