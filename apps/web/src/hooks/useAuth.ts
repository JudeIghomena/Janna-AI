"use client";
import { useState, useEffect } from "react";
import {
  getCurrentUser,
  signOut as amplifySignOut,
  fetchAuthSession,
} from "aws-amplify/auth";
import { useRouter } from "next/navigation";

interface AuthUser {
  userId: string;
  username: string;
  email?: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser()
      .then((u) =>
        setUser({
          userId: u.userId,
          username: u.username,
          email: u.signInDetails?.loginId,
        })
      )
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    await amplifySignOut();
    router.push("/login");
  };

  return { user, loading, signOut };
}
