import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// one variable font, the width axis gives us the condensed style
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "PackLib — find a place to study at NC State",
  description:
    "An independent NC State study-space explorer: every room and reading space in Hunt and Hill libraries, with live headcounts.",
};

const ARRIVED =
  "try{var d=document.documentElement,s=sessionStorage;if(s.arrived)d.dataset.arrived='1';else{s.arrived='1';setTimeout(function(){d.dataset.arrived='1'},3000)}}catch(e){}";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // marks later page loads in a session so the intro animation only plays once
    <html lang="en" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ARRIVED }} />
      </head>
      <body className="flex min-h-full flex-col lg:h-dvh lg:overflow-hidden">
        {children}
      </body>
    </html>
  );
}
