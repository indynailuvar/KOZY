// Ilustrasi benda untuk kartu produk di chat KOZY AI.

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
