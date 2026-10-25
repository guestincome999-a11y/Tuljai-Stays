import NetInfo from '@react-native-community/netinfo';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface ConnectivityContextValue {
  isOffline: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({ isOffline: false });

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ isOffline }), [isOffline]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityContextValue {
  return useContext(ConnectivityContext);
}
