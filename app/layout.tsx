import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One variable family; its width axis gives the condensed "door plaque" cut.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "StudyScape — find a place to study in Hunt Library",
  description:
    "An independent NC State study-space explorer: every room and reading space in Hunt Library, by level.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="flex min-h-full flex-col lg:h-dvh lg:overflow-hidden">
        {children}
      </body>
    </html>
  );
}
