import type { Metadata } from "next";
import { Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { getTables, getFunctions, getProcedures } from "@/lib/schema";
import {
  tableLabels,
  functionDescriptions,
  procedureDescriptions,
} from "@/lib/vi-labels";

const roboto = Roboto({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bảng điều khiển CSDL",
  description: "Đo hiệu năng PostgreSQL — Function vs Backend Query",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tables = getTables();
  const functions = getFunctions();
  const procedures = getProcedures();

  const sections = [
    {
      title: "Lược đồ",
      items: [
        { label: "Sơ đồ ER", href: "/" },
        ...tables.map((t) => ({
          label: tableLabels[t.name] ?? t.name,
          href: `/#${t.name}`,
        })),
      ],
    },
    {
      title: "Hàm (Functions)",
      items: functions.map((f) => ({
        label: functionDescriptions[f.name]?.title ?? f.name,
        href: `/functions/${f.name}`,
      })),
    },
    {
      title: "Thủ tục (Procedures)",
      items: procedures.map((p) => ({
        label: procedureDescriptions[p.name]?.title ?? p.name,
        href: `/procedures/${p.name}`,
      })),
    },
  ];

  return (
    <html lang="vi">
      <body
        className={`${roboto.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen">
          <AppSidebar sections={sections} />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
