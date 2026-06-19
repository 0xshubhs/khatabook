import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Khatabook Clone",
  description: "Digital ledger for small shopkeepers",
};

// Mobile-first: designed for a ~390px phone viewport (SPEC §8).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <Providers>
          <div className="mx-auto min-h-screen max-w-[430px] bg-gray-50">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
