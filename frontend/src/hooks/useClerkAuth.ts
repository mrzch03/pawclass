import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { setClerkToken } from "../lib/auth";

/**
 * Sync Clerk session token to PawClass auth system.
 * Must be rendered inside ClerkProvider.
 */
export function useClerkAuth() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !getToken) {
      setClerkToken(null);
      setTokenReady(true);
      return;
    }

    let cancelled = false;
    async function syncToken() {
      if (cancelled) return;
      const token = await getToken();
      if (!cancelled) {
        setClerkToken(token);
        setTokenReady(true);
      }
    }

    syncToken();
    const interval = setInterval(syncToken, 50000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSignedIn, isLoaded, getToken]);

  return {
    isSignedIn: isSignedIn || false,
    isLoaded: isLoaded || false,
    tokenReady,
    userId: user?.id || null,
    userName: user?.firstName || user?.username || null,
  };
}
