import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

function Root() {
  // If no Clerk key (local dev), render without Clerk
  if (!CLERK_KEY) {
    return <App />;
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <App />
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
