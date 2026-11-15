"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../app/AuthProvider";

// Wrap any page that needs a logged-in user. It reads the SAME auth state
// every other page reads — it doesn't re-check a token itself, it just
// reacts to what AuthProvider already decided.
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="min-h-screen bg-abyss flex items-center justify-center text-textDim">Loading…</div>;
  }
  return children;
}
