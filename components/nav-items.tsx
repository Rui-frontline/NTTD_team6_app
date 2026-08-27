/**
 * 画面移動の項目とアイコン。
 *
 * 広い画面は左のサイドバー（components/Sidebar.tsx）、狭い画面は下のタブ
 * （components/BottomNav.tsx）が、どちらもここを回して描く。
 *
 * 項目を足すときはここに1行足すだけでよい。2箇所に持つと、片方にだけ
 * 足して「スマホでは開けない画面」ができる。
 */

/** ナビのアイコン。線画で揃えるため stroke は currentColor にしている */
function iconProps() {
  return {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    className: "h-5 w-5 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function SearchIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function TalkIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 20.5l1.6-3.6A6.7 6.7 0 0 1 4 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7Z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 7h8M8 12h8M8 17h5" />
    </svg>
  );
}

/** 重ねたコイン。ポイントの残高を思わせる形にしている */
function PointIcon() {
  return (
    <svg {...iconProps()}>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
      <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M9 15h6" />
    </svg>
  );
}

export type NavItem = {
  href: string;
  label: string;
  /** 下のタブに出す短い名前。7つ並ぶので、長いと入らない */
  shortLabel: string;
  icon: () => React.ReactElement;
};

export const NAV: NavItem[] = [
  { href: "/discover", label: "探す", shortLabel: "探す", icon: SearchIcon },
  { href: "/talk", label: "トーク", shortLabel: "トーク", icon: TalkIcon },
  { href: "/board", label: "募集", shortLabel: "募集", icon: BoardIcon },
  { href: "/history", label: "履歴", shortLabel: "履歴", icon: HistoryIcon },
  { href: "/ai-talk", label: "AI対話", shortLabel: "AI", icon: AiIcon },
  { href: "/points", label: "ポイント", shortLabel: "pt", icon: PointIcon },
  { href: "/me", label: "マイページ", shortLabel: "マイ", icon: PersonIcon },
];
