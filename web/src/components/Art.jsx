// Ilustrasi flat KOZY — hanya nuansa biru.

export function HeroArt() {
  return (
    <svg viewBox="0 0 440 360" className="art" role="img" aria-label="Ilustrasi rumah kos dan hasil cek harga">
      <defs>
        <filter id="ha-sh" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#1D4ED8" floodOpacity="0.12" />
        </filter>
      </defs>
      <circle cx="240" cy="180" r="170" fill="#F3F7FF" />
      <g fill="#E3ECFD">
        <rect x="118" y="96" width="52" height="176" rx="10" />
        <rect x="178" y="62" width="58" height="210" rx="10" />
        <rect x="330" y="84" width="54" height="188" rx="10" />
      </g>
      <rect x="96" y="270" width="320" height="6" rx="3" fill="#DCE7FE" />

      <g>
        <rect x="238" y="160" width="124" height="112" rx="12" fill="#fff" stroke="#DCE7FE" strokeWidth="2" />
        <path d="M226 168 300 116l74 52z" fill="#2563EB" />
        <rect x="254" y="182" width="26" height="22" rx="5" fill="#EFF4FF" />
        <rect x="320" y="182" width="26" height="22" rx="5" fill="#EFF4FF" />
        <rect x="287" y="220" width="26" height="52" rx="6" fill="#DCE7FE" />
      </g>

      <g transform="translate(300 40)" filter="url(#ha-sh)">
        <path d="M0 0c-16 0-28 12-28 28 0 21 28 44 28 44s28-23 28-44C28 12 16 0 0 0z" fill="#2563EB" />
        <circle cy="28" r="10" fill="#fff" />
      </g>

      <g filter="url(#ha-sh)">
        <rect x="60" y="150" width="150" height="150" rx="22" fill="#fff" />
        <rect x="80" y="172" width="58" height="18" rx="9" fill="#EFF4FF" />
        <text x="109" y="185" textAnchor="middle" fontSize="10" fontWeight="700" fill="#2563EB" letterSpacing="0.5">
          Wajar
        </text>
        <rect x="80" y="202" width="64" height="6" rx="3" fill="#E5E9F0" />
        <text x="80" y="236" fontSize="24" fontWeight="800" fill="#0F172A" letterSpacing="-1">
          Rp920rb
        </text>
        <rect x="80" y="252" width="110" height="1.5" fill="#EEF2F6" />
        <rect x="80" y="264" width="48" height="6" rx="3" fill="#E5E9F0" />
        <rect x="160" y="264" width="30" height="6" rx="3" fill="#BFD3FB" />
        <rect x="80" y="278" width="40" height="6" rx="3" fill="#E5E9F0" />
        <rect x="160" y="278" width="30" height="6" rx="3" fill="#BFD3FB" />
      </g>

      <g filter="url(#ha-sh)">
        <rect x="286" y="292" width="136" height="48" rx="14" fill="#fff" />
        <circle cx="308" cy="316" r="11" fill="#EFF4FF" />
        <path d="M303 316l3.5 3.5 6.5-7" stroke="#2563EB" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="326" y="312" fontSize="11" fontWeight="700" fill="#0F172A">
          Harga wajar
        </text>
        <text x="326" y="327" fontSize="9.5" fontWeight="500" fill="#64748B">
          28 kos pembanding
        </text>
      </g>
    </svg>
  );
}

const BENDA = {
  kipas: (
    <>
      <circle cx="24" cy="18" r="11" />
      <path d="M24 18c0-6 4-8 6-5s-2 5-6 5zM24 18c-5 3-9 0-7-3s5 0 7 3zM24 18c3 5 0 9-3 7s0-5 3-7z" />
      <path d="M24 29v10M16 40h16" />
    </>
  ),
  rak: (
    <>
      <path d="M10 8v32M38 8v32M10 12h28M10 40h28" />
      <path d="M17 12v5l-4 6h8l-4-6M28 12v5l-4 7h9l-5-7" />
    </>
  ),
  lemari: (
    <>
      <rect x="12" y="7" width="24" height="34" rx="3" />
      <path d="M12 16h24M12 24h24M12 32h24M22 11.5h4M22 20h4M22 28h4M22 36.5h4" />
    </>
  ),
  meja: (
    <>
      <path d="M7 28h34M11 28l-3 11M37 28l3 11" />
      <rect x="15" y="15" width="18" height="11" rx="1.5" />
    </>
  ),
  lampu: (
    <>
      <path d="M15 40h14M22 40V26l10-10" />
      <path d="M28 10l10 4-6 8z" />
    </>
  ),
  masak: (
    <>
      <path d="M11 21h26v12a7 7 0 0 1-7 7H18a7 7 0 0 1-7-7z" />
      <path d="M10 21a14 8 0 0 1 28 0" />
      <path d="M22 13h4" />
    </>
  ),
  jemuran: (
    <>
      <path d="M12 40 24 10l12 30M16 30h16M19 22h10" />
    </>
  ),
  karpet: (
    <>
      <rect x="8" y="14" width="32" height="20" rx="4" />
      <path d="M13 19h22M13 24h22M13 29h22" />
    </>
  ),
  cermin: (
    <>
      <ellipse cx="24" cy="19" rx="9" ry="13" />
      <path d="M24 32v6M17 41l7-3 7 3" />
    </>
  ),
  tirai: (
    <>
      <path d="M7 9h34" />
      <path d="M10 9c0 10 2 22 5 31h5c-2-9-3-21-2-31M38 9c0 10-2 22-5 31h-5c2-9 3-21 2-31" />
    </>
  ),
  kasur: (
    <>
      <rect x="7" y="20" width="34" height="14" rx="4" />
      <rect x="10" y="15" width="12" height="7" rx="3" />
    </>
  ),
  listrik: (
    <>
      <rect x="7" y="18" width="30" height="13" rx="4" />
      <path d="M13 23v3M19 23v3M25 23v3M31 23v3" />
    </>
  ),
  gantungan: (
    <>
      <path d="M8 16h32" />
      <path d="M14 16v6a3 3 0 0 0 6 0M28 16v6a3 3 0 0 0 6 0" />
    </>
  ),
};

export function ProductArt({ kategori }) {
  return (
    <svg viewBox="0 0 48 48" className="prod-img" aria-hidden="true">
      <rect width="48" height="48" rx="10" fill="#F3F7FF" />
      <g fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {BENDA[kategori] || BENDA.rak}
      </g>
    </svg>
  );
}
