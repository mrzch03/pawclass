import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { setClerkToken } from "../lib/auth";

/**
 * Sync Clerk session token to PawClass auth system.
 * Must be rendered inside ClerkProvider.
 */
export function useClerkAuth() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!isSignedIn || !getToken) {
      setClerkToken(null);
      return;
    }

    let cancelled = false;
    async function syncToken() {
      if (cancelled) return;
      const token = await getToken();
      if (!cancelled) setClerkToken(token);
    }

    syncToken();
    const interval = setInterval(syncToken, 50000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSignedIn, getToken]);

  return {
    isSignedIn: isSignedIn || false,
    isLoaded: isLoaded || false,
    userId: user?.id || null,
    userName: user?.firstName || user?.username || null,
  };
}
