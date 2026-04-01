import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HomePage",
  description: "基于 EdgeOne KV 持久化的可配置浏览器起始页。",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        {children}

        <footer className="border-t border-white/10 bg-slate-950/85 px-4 py-4 text-center text-xs text-slate-300 backdrop-blur sm:px-6">
          <p>
            Made with ❤ by{' '}
            <span className="font-semibold text-slate-100">sxwzxc</span>
            {' '}·{' '}
            <a
              href="https://github.com/sxwzxc/MyHomePage"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline"
            >
              GitHub Repository
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
