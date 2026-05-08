import React from "react";

export interface BadgeDef {
  id: string;
  label: string;
  color: string;
  ring: string;
  Icon: React.FC<{ size?: number }>;
}

// ── Award ceremony badge SVG icons ──────────────────────────────

export function StarBadgeIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Ribbon tab at top */}
      <rect x="11" y="0" width="6" height="7" rx="1.5" fill="#d4a017"/>
      <rect x="12.5" y="0" width="3" height="7" rx="1" fill="#f5c542"/>
      {/* Medal circle */}
      <circle cx="14" cy="18" r="10" fill="#f5c542"/>
      <circle cx="14" cy="18" r="8.5" fill="none" stroke="#d4a017" strokeWidth="1"/>
      <circle cx="14" cy="18" r="7" fill="#e8b520"/>
      {/* 5-pointed star */}
      <path
        d="M14 11.5l1.76 5.42h5.7l-4.61 3.35 1.76 5.42L14 22.34l-4.61 3.35 1.76-5.42-4.61-3.35h5.7z"
        fill="#fff8e0" stroke="#d4a017" strokeWidth="0.3"
      />
    </svg>
  );
}

export function FireBadgeIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Ribbon */}
      <rect x="11" y="0" width="6" height="7" rx="1.5" fill="#c0390f"/>
      <rect x="12.5" y="0" width="3" height="7" rx="1" fill="#ff6b35"/>
      {/* Badge circle */}
      <circle cx="14" cy="18" r="10" fill="#ff6b35"/>
      <circle cx="14" cy="18" r="8.5" fill="none" stroke="#c0390f" strokeWidth="1"/>
      <circle cx="14" cy="18" r="7" fill="#e85520"/>
      {/* Flame */}
      <path
        d="M14 11c0 0-3 2.5-3 5.5a3 3 0 006 0c0-1-.5-2-1-2.5 0 1.5-1 2-1 2s1-3-1-5z"
        fill="#fff8e0"
      />
      <path
        d="M13.5 17c0 1 .5 1.5 .5 1.5s.5-.5.5-1.5c0-.8-.3-1.3-.5-1.5-.2.2-.5.7-.5 1.5z"
        fill="#ffee88"
      />
    </svg>
  );
}

export function CheckBadgeIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Ribbon */}
      <rect x="11" y="0" width="6" height="7" rx="1.5" fill="#1a8c3c"/>
      <rect x="12.5" y="0" width="3" height="7" rx="1" fill="#34c759"/>
      {/* Badge circle */}
      <circle cx="14" cy="18" r="10" fill="#34c759"/>
      <circle cx="14" cy="18" r="8.5" fill="none" stroke="#1a8c3c" strokeWidth="1"/>
      <circle cx="14" cy="18" r="7" fill="#28a84a"/>
      {/* Checkmark */}
      <polyline
        points="9.5,18 12.5,21 18.5,14"
        stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export const DEFAULT_BADGES: BadgeDef[] = [
  { id: "star",  label: "Favorite", color: "#f5c542", ring: "#d4a017", Icon: StarBadgeIcon  },
  { id: "fire",  label: "Hot",      color: "#ff6b35", ring: "#c0390f", Icon: FireBadgeIcon  },
  { id: "check", label: "Done",     color: "#34c759", ring: "#1a8c3c", Icon: CheckBadgeIcon },
];
