import "./globals.css";
import { AuthProvider } from "./AuthProvider";
import { GameSocketProvider } from "./GameSocketProvider";

export const metadata = {
  title: "Deep Dive",
  description: "A counting-fish diving game — CIS045-3 coursework",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* One provider at the root: every page below reads the same
            logged-in user + JWT from one place instead of each page
            re-fetching /me or re-parsing localStorage itself. */}
        <AuthProvider>
          <GameSocketProvider>{children}</GameSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
