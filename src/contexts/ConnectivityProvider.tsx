import { createContext, useContext, useEffect, useState } from "react";

const ConnectivityContext = createContext({
  online: true,
});

export const ConnectivityProvider = ({ children }: { children: React.ReactNode }) => {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={{ online }}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => useContext(ConnectivityContext);
