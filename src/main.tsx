import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@/index.css";
import { ConnectivityProvider } from "@/contexts/ConnectivityProvider";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <StrictMode>
    <ConnectivityProvider>
      <App />
    </ConnectivityProvider>
  </StrictMode>
);