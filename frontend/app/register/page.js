"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthProvider";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(username, email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err.status === 409 ? "That email or username is already taken." : "Something went wrong.");
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
        <h1 className="font-display text-2xl font-semibold text-white mb-1">Create your account</h1>
        <p className="text-textDim text-sm mb-6">Start at 50 treasure, zero dives logged.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-mid/60 border border-white/10 text-white placeholder:text-textDim focus:outline-none focus:border-cyan"
          />
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
            minLength={6}
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
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="text-textDim text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-cyan hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
