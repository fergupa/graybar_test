import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family HQ",
  description:
    "A multi-agent family chief of staff: calendar, budget, meals, and logistics in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
