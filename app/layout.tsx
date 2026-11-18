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
  title: "PackLib — find a place to study at NC State",
  description:
    "An independent NC State study-space explorer: every room and reading space in Hunt and Hill libraries, with live headcounts.",
  // The name under the icon when it's saved to an iPhone home screen, instead of the long page title.
  appleWebApp: { title: "PackLib" },
};

const ARRIVED =
  "try{var d=document.documentElement,s=sessionStorage;if(s.arrived)d.dataset.arrived='1';else{s.arrived='1';setTimeout(function(){d.dataset.arrived='1'},3000)}}catch(e){}";
// Before first paint: the theme the toggle saved, else the system's. Kept in step with lib/theme.ts.
const THEME =
  "(function(){var t=null;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script marks a session's later page loads so the arrival animation plays only once.
    <html lang="en" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
        <script dangerouslySetInnerHTML={{ __html: ARRIVED }} />
      </head>
      <body className="flex min-h-full flex-col lg:h-dvh lg:overflow-hidden">
        {children}
      </body>
    </html>
  );
}
