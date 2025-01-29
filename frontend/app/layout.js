import "./globals.css";
import { UserProvider } from "@auth0/nextjs-auth0/client";

export const metadata = {
  title: 'itrainU',
  icons: {
    icon: '/logo.png', 
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}