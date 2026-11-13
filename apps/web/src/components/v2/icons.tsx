// Launch v2 icons, copied path for path from "Svika Mbare Sun/launch-v2".
// Bespoke chunky rounded SVG only; the forward and back arrows are THE arrow
// of DESIGN.md §3 and its mirror. Decorative unless a label is passed.

interface IconProps {
  size?: number;
}

export function ArrowV2({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 10.1c0-.72.58-1.3 1.3-1.3H12V6.1c0-1.28 1.5-1.94 2.42-1.05l6.28 6.05c.6.58.6 1.54 0 2.12l-6.28 6.05C13.5 20.16 12 19.5 12 18.22V15.5H5.3A1.3 1.3 0 0 1 4 14.2z" />
    </svg>
  );
}

export function BackV2({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 10.1c0-.72-.58-1.3-1.3-1.3H12V6.1c0-1.28-1.5-1.94-2.42-1.05L3.3 11.1c-.6.58-.6 1.54 0 2.12l6.28 6.05C10.5 20.16 12 19.5 12 18.22V15.5h6.7a1.3 1.3 0 0 0 1.3-1.3z" />
    </svg>
  );
}

export function SearchV2({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.6-4.6" />
    </svg>
  );
}

export function MoonV2({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.3 14.6A8.5 8.5 0 0 1 9.4 3.7a.9.9 0 0 0-1.2-1.1A10 10 0 1 0 21.4 15.8a.9.9 0 0 0-1.1-1.2z" />
    </svg>
  );
}

export function SunV2({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1.8a1.2 1.2 0 0 1 1.2 1.2v1.4a1.2 1.2 0 0 1-2.4 0V3A1.2 1.2 0 0 1 12 1.8zm0 16.6a1.2 1.2 0 0 1 1.2 1.2V21a1.2 1.2 0 0 1-2.4 0v-1.4a1.2 1.2 0 0 1 1.2-1.2zM22.2 12a1.2 1.2 0 0 1-1.2 1.2h-1.4a1.2 1.2 0 0 1 0-2.4H21a1.2 1.2 0 0 1 1.2 1.2zM5.6 12a1.2 1.2 0 0 1-1.2 1.2H3a1.2 1.2 0 0 1 0-2.4h1.4A1.2 1.2 0 0 1 5.6 12z" />
    </svg>
  );
}

export function PinV2({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5a7.5 7.5 0 0 1 7.5 7.5c0 5.2-5.9 10.6-6.6 11.2a1.4 1.4 0 0 1-1.8 0C10.4 20.6 4.5 15.2 4.5 10A7.5 7.5 0 0 1 12 2.5zm0 4.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </svg>
  );
}

/** The rank glyph (filled kombi) used in rank rows. */
export function RankV2({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7.2a3 3 0 0 1 2.5 1.3l2.3 3.4c.3.5.5 1 .5 1.6V16a2 2 0 0 1-2 2h-.6a2.5 2.5 0 0 1-4.8 0H10.4a2.5 2.5 0 0 1-4.8 0H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2zm9.5 0v3.5h4.3l-1.9-2.8a1.5 1.5 0 0 0-1.2-.7z" />
    </svg>
  );
}

/** The outlined kombi used by the Ranks tab. */
export function RanksTabV2({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h7.4a2 2 0 0 1 1.7.9l2.6 3.8c.2.3.3.7.3 1.1V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2z" />
      <circle cx="8" cy="17.5" r="1.8" />
      <circle cx="16" cy="17.5" r="1.8" />
    </svg>
  );
}

export function MeV2({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  );
}

export function SwapV2({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4v15M3.5 7.5 7 4l3.5 3.5M17 20V5M13.5 16.5 17 20l3.5-3.5" />
    </svg>
  );
}

export function ShieldV2({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
    </svg>
  );
}

/** Small "i" for the map attribution button (plan Step 1.7). */
export function InfoV2({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zm0 7.3a1.2 1.2 0 0 0-1.2 1.2v5.2a1.2 1.2 0 0 0 2.4 0V11a1.2 1.2 0 0 0-1.2-1.2zm0-3.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z" />
    </svg>
  );
}
