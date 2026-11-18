import { ImageResponse } from "next/og";

// iOS ignores SVG icons, so this renders the logo from app/icon.svg to a PNG at build time.
// square with no rounding since iOS rounds the corners itself
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#171717" }}>
        <svg width="132" height="132" viewBox="1 3 30 30" stroke="#171717" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M5 24L16 29.5L27 24v2.5L16 32L5 26.5Z" fill="#a8a8a8" />
          <path d="M5 24L16 18.5L27 24L16 29.5Z" fill="#ffffff" />
          <path d="M5 19L16 24.5L27 19v2.5L16 27L5 21.5Z" fill="#a8a8a8" />
          <path d="M5 19L16 13.5L27 19L16 24.5Z" fill="#ffffff" />
          <path d="M5 10L16 15.5L27 10v2.5L16 18L5 12.5Z" fill="#9a0000" />
          <path d="M5 10L16 4.5L27 10L16 15.5Z" fill="#e01e1e" />
        </svg>
      </div>
    ),
    size,
  );
}
