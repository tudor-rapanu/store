import "./globals.css";
import { PostHogProvider } from "@/components/layout/PostHogProvider";
import { ToastProvider } from "@/components/layout/ToastProvider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Todd's Threads",
    template: "%s | Todd's Threads",
  },
  description: "Independent apparel and accessories, shipped from Romania.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <PostHogProvider>
          <ToastProvider>{children}</ToastProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
