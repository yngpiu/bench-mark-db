import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { getFunctions, getProcedures } from "@/lib/schema";
import {
  functionDescriptions,
  procedureDescriptions,
} from "@/lib/vi-labels";

const roboto = Roboto({
  variable: "--font-sans-var",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  const functions = getFunctions();
  const procedures = getProcedures();

  const sections = [
    {
      title: "Lược đồ",
      items: [{ label: "Sơ đồ ER", href: "/" }],
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
    {
      title: "Công cụ nâng cao",
      items: [
        { label: "Benchmark Index", href: "/index-benchmark" },
        { label: "Kiểm tra quy mô dữ liệu", href: "/scale-test" },
      ],
    },
  ];

  return (
    <html lang="vi">
      <body
        className={`${roboto.variable} ${robotoMono.variable} antialiased`}
      >
        <div className="flex min-h-screen">
          <AppSidebar sections={sections} />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
