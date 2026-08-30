import type { ReactNode } from 'react';

export type IconName =
  | 'audio'
  | 'chat'
  | 'check'
  | 'close'
  | 'copy'
  | 'gear'
  | 'history'
  | 'plus'
  | 'rotate'
  | 'shuffle'
  | 'smile'
  | 'sort';

interface IconProps {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, ReactNode> = {
  audio: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8.5 8.5 0 0 1 0 12"/></>,
  chat: <><path d="M5 17.5 3.5 21l4.2-1.5A9 9 0 1 0 5 17.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></>,
  gear: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  history: <><path d="M4 5.5h16v15H4z"/><path d="M8 3.5v4M16 3.5v4M4 9.5h16M8 13h8M8 17h5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  rotate: <><path d="M4 10a8 8 0 1 1 2 7"/><path d="M4 4v6h6"/></>,
  shuffle: <><path d="M4 7h3c4 0 6 10 10 10h3"/><path d="m17 14 3 3-3 3M4 17h3c1.5 0 2.7-1.3 3.8-3M14 8.5C15 7.6 16 7 17 7h3M17 4l3 3-3 3"/></>,
  smile: <><circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8.5 14.5a5 5 0 0 0 7 0"/></>,
  sort: <><path d="M8 6h12M8 12h9M8 18h6"/><path d="M4 5v14M2 17l2 2 2-2"/></>,
};

export function Icon({ name, size = 22 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}
