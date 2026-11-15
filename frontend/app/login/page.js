"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err.status === 401 ? "Wrong email or password." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-abyss px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-xs text-textDim hover:text-cyan mb-6 inline-block">
          ← Back
        </Link>
        <h1 className="font-display text-2xl font-semibold text-white mb-1">Welcome back</h1>
        <p className="text-textDim text-sm mb-6">Log in to pick up where you left off.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-mid/60 border border-white/10 text-white placeholder:text-textDim focus:outline-none focus:border-cyan"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-mid/60 border border-white/10 text-white placeholder:text-textDim focus:outline-none focus:border-cyan"
          />
          {error && <p className="text-coral text-sm">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg bg-cyan text-abyss font-semibold disabled:opacity-60"
          >
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-textDim text-sm mt-6">
          New here?{" "}
          <Link href="/register" className="text-cyan hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
