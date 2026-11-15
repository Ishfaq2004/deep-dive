"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../app/AuthProvider";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◎" },
  { href: "/play", label: "Dive", icon: "▽", accent: "cyan" },
  { href: "/shop", label: "Dive Shop", icon: "✦", accent: "gold" },
  { href: "/leaderboard", label: "Leaderboard", icon: "☰", accent: "coral" },
  { href: "/dive-log", label: "Dive Log", icon: "▤" },
];

const ACCENT = { cyan: "text-cyan", gold: "text-gold", coral: "text-coral" };

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <aside className="w-56 shrink-0 bg-sidebar min-h-screen flex flex-col justify-between py-6 px-4 border-r border-white/5">
      <div>
        <div className="font-display text-lg font-semibold text-white mb-8 px-2">
          DEEP <span className="text-cyan">DIVE</span>
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-textDim hover:text-white hover:bg-white/5"
                }`}
              >
                <span className={item.accent ? ACCENT[item.accent] : ""}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-2">
        {user && (
          <div className="mb-3 text-xs text-textDim">
            <div className="text-white font-mono">{user.username}</div>
            <div className="text-gold font-mono">{user.treasure} treasure</div>
          </div>
        )}
        <button
          onClick={() => {
            logout();
            router.push("/");
          }}
          className="text-xs text-textDim hover:text-coral transition-colors"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
