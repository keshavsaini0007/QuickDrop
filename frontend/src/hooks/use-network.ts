import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkState {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isOnline: true,
    isInternetReachable: null,
    type: 'unknown',
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((next) => {
      setState({
        isOnline: next.isConnected !== false && next.isInternetReachable !== false,
        isInternetReachable: next.isInternetReachable,
        type: next.type,
      });
    });
    void NetInfo.fetch().then((next) => {
      setState({
        isOnline: next.isConnected !== false && next.isInternetReachable !== false,
        isInternetReachable: next.isInternetReachable,
        type: next.type,
      });
    });
    return unsubscribe;
  }, []);

  return state;
}
