"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function WelcomePage() {
  const router = useRouter();
  const { continueAsGuest } = useAuth();

  async function handleGuest() {
    await continueAsGuest();
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-abyss relative overflow-hidden">
      {/* Soft glows, same cyan/gold/coral wayfinding palette as the rest
          of the app — no new colours invented just for this screen. */}
      <div className="absolute -top-24 -left-24 w-[500px] h-[500px] rounded-full bg-cyan/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-gold/10 blur-3xl" />

      <div className="relative z-10 text-center max-w-md px-6">
        <div className="text-xs tracking-widest text-cyan font-mono mb-3">CIS045-3</div>
        <h1 className="font-display text-5xl font-bold text-white mb-4">
          DEEP <span className="text-cyan">DIVE</span>
        </h1>
        <p className="text-textDim mb-10">
          How deep can you count before the air runs out?
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full py-3 rounded-lg bg-cyan text-abyss font-semibold hover:bg-cyan/90 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="w-full py-3 rounded-lg border border-white/15 bg-mid/60 text-white font-medium hover:bg-mid transition-colors"
          >
            Create an account
          </Link>
          <button
            onClick={handleGuest}
            className="w-full py-2 rounded-lg bg-mid/45 border border-cyan/20 text-textDim hover:text-white transition-colors text-sm"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </main>
  );
}
