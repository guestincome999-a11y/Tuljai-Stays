import NetInfo from '@react-native-community/netinfo';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const ConnectivityContext = createContext({ offline: false });

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOffline(state.isConnected === false || state.isInternetReachable === false);
      }),
    [],
  );

  return (
    <ConnectivityContext.Provider value={{ offline }}>{children}</ConnectivityContext.Provider>
  );
}

export function useConnectivity(): { offline: boolean } {
  return useContext(ConnectivityContext);
}
