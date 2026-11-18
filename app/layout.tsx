import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Archivo } from "next/font/google";
import "./globals.css";

// one variable font, the width axis gives us the condensed style
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const title = "PackLib — find a place to study at NC State";
const description =
  "An independent NC State study-space explorer: every room and reading space in Hunt and Hill libraries, with live headcounts.";

export const metadata: Metadata = {
  // share links need absolute image URLs
  metadataBase: new URL("https://packlib.srujanponnapalli.com"),
  title,
  description,
  openGraph: { title, description, siteName: "PackLib" },
  twitter: { card: "summary_large_image" },
  // name shown under the icon when saved to an iPhone home screen (instead of the full title)
  appleWebApp: { title: "PackLib" },
};

const ARRIVED =
  "try{var d=document.documentElement,s=sessionStorage;if(s.arrived)d.dataset.arrived='1';else{s.arrived='1';setTimeout(function(){d.dataset.arrived='1'},3000)}}catch(e){}";
// set the theme before first paint: saved choice, else system. keep in sync with lib/theme.ts
const THEME =
  "(function(){var t=null;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // marks later page loads in a session so the intro animation only plays once
    <html lang="en" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
        <script dangerouslySetInnerHTML={{ __html: ARRIVED }} />
      </head>
      <body className="flex min-h-full flex-col lg:h-dvh lg:overflow-hidden">
        {children}
        {/* cookieless page views (Vercel Web Analytics), nothing is sent from localhost */}
        <Analytics />
      </body>
    </html>
  );
}
