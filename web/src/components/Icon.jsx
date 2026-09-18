const P = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  pin: <><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  checkc: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4.5" /><path d="M12 8h.01" /></>,
  lock: <><rect x="4.5" y="11" width="15" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></>,
  unlock: <><rect x="4.5" y="11" width="15" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 7.7-1.5" /></>,
  down: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  left: <path d="m15 6-6 6 6 6" />,
  arrowr: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  shieldc: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m8.8 12 2.2 2.2 4.4-4.4" /></>,
  db: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  bars: <><path d="M5 20v-6" /><path d="M10 20V9" /><path d="M15 20v-9" /><path d="M20 20V4" /></>,
  calc: <><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><path d="M8.5 6.5h7" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5" /></>,
  scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="11.5" cy="11.5" r="3.5" /><path d="m16 16-2-2" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  chat: <><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><path d="M14 14h3v3h-3zM20.5 14v.01M14 20.5h.01M17 20.5h3.5V17" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  file: <><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" /><path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h5" /></>,
  award: <><circle cx="12" cy="9" r="6" /><path d="m8.6 14-1.4 8 4.8-2.8 4.8 2.8-1.4-8" /></>,
  cal: <><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M20.5 3.5v5h-5" /></>,
  cloudoff: <><path d="m3 3 18 18" /><path d="M6.2 6.6A6.5 6.5 0 0 0 7 19h11" /><path d="M21.3 16.3A4.5 4.5 0 0 0 17.5 10h-1.1A6.5 6.5 0 0 0 9.6 5.1" /></>,
  snow: <><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" /></>,
  bath: <><path d="M3.5 12h17v2.5A5.5 5.5 0 0 1 15 20H9a5.5 5.5 0 0 1-5.5-5.5z" /><path d="M6 12V5.5a2.5 2.5 0 0 1 4.6-1.3" /></>,
  wifi: <><path d="M5 12.6a10 10 0 0 1 14 0" /><path d="M8.5 16.1a5 5 0 0 1 7 0" /><path d="M1.8 9.1a14.5 14.5 0 0 1 20.4 0" /><path d="M12 19.6h.01" /></>,
  bed: <><path d="M2.5 19V6M2.5 15.5h19V19M21.5 15.5V12a3 3 0 0 0-3-3H10v6.5" /><circle cx="6.3" cy="11.3" r="1.9" /></>,
  park: <><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><path d="M9.5 16.5v-9h3.5a2.8 2.8 0 0 1 0 5.6H9.5" /></>,
  door: <><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" /><path d="M3 21h18" /><path d="M15 12h.01" /></>,
  ruler: <><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z" /><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2" /></>,
  grad: <><path d="M22 9 12 4 2 9l10 5 10-5z" /><path d="M6 11.2V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.8" /></>,
  brief: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7M3 12.5h18" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5.5A2.5 2.5 0 0 1 7.5 3H15" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" /><path d="M3.5 3.5v5h5" /><path d="M12 7.5V12l3.5 2" /></>,
  map: <><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  store: <><path d="M4 10v10h16V10" /><path d="M3 10 5 4h14l2 6" /><path d="M10 20v-5h4v5" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  play: <path d="M7 4.5v15l12-7.5z" />,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6 7l1 13h10l1-13" /></>,
  medical: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  book: <><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19" /></>,
  dots: <><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></>,
  building: <><rect x="4.5" y="3" width="15" height="18" rx="2" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10.5 21v-3h3v3" /></>,
  hospital: <><path d="M3 21h18" /><path d="M5 21V8l7-4.5L19 8v13" /><path d="M12 9.5v5M9.5 12h5" /></>,
  basket: <><path d="M4.5 10h15l-1.6 8.6a2 2 0 0 1-2 1.6H8.1a2 2 0 0 1-2-1.6z" /><path d="M9 10l3-5.5L15 10" /><path d="M9.5 14v2.5M14.5 14v2.5" /></>,
  train: <><rect x="5.5" y="3" width="13" height="14" rx="3" /><path d="M5.5 10.5h13M9 21l-2-4M15 21l2-4" /><path d="M9 13.8h.01M15 13.8h.01" /></>,
  bus: <><rect x="4" y="3.5" width="16" height="14" rx="3" /><path d="M4 11h16M7.5 20.5v-3M16.5 20.5v-3" /><path d="M8 14.3h.01M16 14.3h.01" /></>,
  school: <><path d="M3 10.5 12 5l9 5.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-4.5h4V20" /><path d="M12 9v2" /></>,
  access: <><circle cx="12" cy="4.5" r="1.8" /><path d="M12 7.5v6h4.5l2 5" /><path d="M12 10.5h4" /><path d="M9.3 11.4a5.2 5.2 0 1 0 5.5 7.3" /></>,
  volume: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
  sparkles: <><path d="M11 3.5 12.9 8.6 18 10.5l-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z" /><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
  send: <><path d="M21.5 2.5 10.5 13.5" /><path d="M21.5 2.5 14.5 21.5l-4-8-8-4z" /></>,
  scale: <><path d="M12 3.5v17M7.5 20.5h9M4.5 7h15" /><path d="M4.5 7 2 13a3 3 0 0 0 5 0z" /><path d="M19.5 7 17 13a3 3 0 0 0 5 0z" /></>,
  coins: <><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M9 14v2.5c0 1.7 2.7 3 6 3s6-1.3 6-3V12c0-1.6-2.4-2.9-5.5-3" /></>,
  shirt: <path d="M8.5 3.5 4 6.5l2 4.5 2-1V20.5h8V10l2 1 2-4.5-4.5-3a3.5 3.5 0 0 1-7 0z" />,
  utensils: <><path d="M5 3v7a2 2 0 0 0 2 2h1v9M8 3v5M11 3v7a2 2 0 0 1-2 2" /><path d="M18.5 21V3c-2 1.2-3.2 3.3-3.2 6.2V14h3.2" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10.5 13.5" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  wallet: <><path d="M19 7V5.5A2.5 2.5 0 0 0 16.5 3h-11a2.5 2.5 0 0 0 0 5H20a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 18.5v-13" /><path d="M16.5 14h.01" /></>,
  sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1.5 14h5M9.5 8h5M17.5 16h5" /></>,
  up: <path d="m6 15 6-6 6 6" />,
  mars: <><circle cx="10" cy="14" r="6" /><path d="M14.5 9.5 20 4M15 4h5v5" /></>,
  venus: <><circle cx="12" cy="9" r="6" /><path d="M12 15v7M9 19h6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sofa: <><path d="M20 9V6.5A2.5 2.5 0 0 0 17.5 4h-11A2.5 2.5 0 0 0 4 6.5V9" /><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z" /><path d="M4 18v2M20 18v2M12 4v9" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  arrowup: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
  trendup: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
  trenddown: <><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></>,
};

export default function Icon({ name, size = 20, className = '', strokeWidth = 2, ...rest }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {P[name]}
    </svg>
  );
}
