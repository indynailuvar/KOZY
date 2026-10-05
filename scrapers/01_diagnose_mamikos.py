"""
01 — DIAGNOSA. Jalankan ini SEBELUM menulis scraper apa pun.

Tugasnya cuma satu: MEREKAM BUKTI. Skrip lama gagal karena tidak pernah
melihat halaman yang sebenarnya diterima, jadi halaman 404 pun terbaca
sebagai "0 kartu".

Keluaran (folder bukti/):
  halaman.png        <- tangkapan layar, lihat dengan mata sendiri
  halaman.html       <- HTML akhir setelah JS jalan
  endpoint_*.json    <- SETIAP respons JSON yang isinya mirip daftar kos
  ringkasan.txt      <- status HTTP tiap request + daftar kandidat endpoint

Pasang dulu:  pip install playwright && playwright install chromium
"""

import json, os, re, pathlib
from playwright.sync_api import sync_playwright

# URL YANG BENAR. Yang lama ("/cari/surabaya") mengembalikan 404 —
# itulah sebab "Total iklan diambil: 0".
URL = ("https://mamikos.com/cari/"
       "surabaya-kota-surabaya-jawa-timur-indonesia/all/bulanan/0-15000000")

OUT = pathlib.Path("bukti")
OUT.mkdir(exist_ok=True)

# Kata kunci untuk menebak apakah sebuah respons JSON berisi daftar kos
PETUNJUK = ("price", "harga", "room", "kost", "kos", "monthly", "bulanan", "slug")

log = []
kandidat = []


def tangani_respons(resp):
    """Dipanggil untuk SETIAP respons. Simpan yang berbau JSON daftar kos."""
    url = resp.url
    log.append(f"{resp.status}  {resp.request.method:5s}  {url[:130]}")

    ctype = (resp.headers or {}).get("content-type", "")
    if "json" not in ctype:
        return
    # lewati aset dan pelacak
    if any(x in url for x in (".svg", ".png", ".woff", "google-analytics", "gtm.js")):
        return

    try:
        teks = resp.text()
    except Exception:
        return
    if len(teks) < 500:                      # terlalu kecil untuk daftar kos
        return

    skor = sum(1 for k in PETUNJUK if k in teks.lower())
    # harus ada pola harga nyata, bukan sekadar kata "price"
    ada_harga = re.search(r'"(?:price|harga)[^"]*"\s*:\s*"?\d{5,9}', teks, re.I)

    if skor >= 3 and ada_harga:
        n = len(kandidat) + 1
        berkas = OUT / f"endpoint_{n:02d}.json"
        berkas.write_text(teks, encoding="utf-8")
        kandidat.append({
            "file": berkas.name,
            "method": resp.request.method,
            "url": url,
            "status": resp.status,
            "bytes": len(teks),
            "post_data": resp.request.post_data,          # penting untuk POST
            "headers_request": dict(resp.request.headers),
        })
        print(f"  >>> KANDIDAT #{n}: {resp.request.method} {url[:100]}  ({len(teks)//1024} KB)")


with sync_playwright() as p:
    # headless=False supaya KAMU BISA MELIHAT halamannya.
    # channel="chrome" memakai Chrome asli, bukan Chromium bawaan yang
    # sidik jarinya gampang dikenali sebagai bot.
    browser = p.chromium.launch(headless=False, channel="chrome", slow_mo=100)
    ctx = browser.new_context(locale="id-ID", viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.on("response", tangani_respons)

    print(f"Membuka {URL}")
    resp = page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    print(f"Status halaman utama: {resp.status if resp else '??'}")

    # tunggu jaringan tenang — bukan tunggu detik buta
    try:
        page.wait_for_load_state("networkidle", timeout=30000)
    except Exception:
        print("  (networkidle timeout — tidak apa-apa, lanjut)")

    # gulir beberapa kali; pemuatan daftar biasanya baru jalan saat digulir
    for i in range(6):
        page.mouse.wheel(0, 2500)
        page.wait_for_timeout(1800)

    # klik tombol "Lihat lebih banyak" bila ada — ini yang memicu XHR pencarian
    for i in range(3):
        try:
            tombol = page.get_by_text(re.compile(r"lihat lebih banyak", re.I)).first
            if tombol.is_visible(timeout=3000):
                tombol.click()
                print(f"  klik 'Lihat lebih banyak' ({i+1})")
                page.wait_for_timeout(3500)
        except Exception:
            break

    # ---- simpan bukti ----
    page.screenshot(path=str(OUT / "halaman.png"), full_page=True)
    (OUT / "halaman.html").write_text(page.content(), encoding="utf-8")

    judul = page.title()
    teks_badan = page.inner_text("body")
    jumlah_rp = len(re.findall(r"Rp\s?[\d.]{6,}", teks_badan))

    browser.close()

# ---- ringkasan ----
baris = [
    f"URL          : {URL}",
    f"Judul halaman: {judul}",
    f"Pola 'Rp ...' terlihat di halaman: {jumlah_rp}",
    "",
    f"Kandidat endpoint JSON: {len(kandidat)}",
]
for k in kandidat:
    baris += [
        "",
        f"  berkas   : {k['file']}  ({k['bytes']//1024} KB)",
        f"  method   : {k['method']}",
        f"  url      : {k['url']}",
        f"  post_data: {(k['post_data'] or '')[:400]}",
    ]
baris += ["", "=== SEMUA REQUEST ===", *log]

(OUT / "ringkasan.txt").write_text("\n".join(baris), encoding="utf-8")
json.dump(kandidat, open(OUT / "kandidat.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

print("\n" + "=" * 60)
print(f"Judul halaman : {judul}")
print(f"Pola harga di halaman : {jumlah_rp}")
print(f"Kandidat endpoint     : {len(kandidat)}")
print(f"\nBuka bukti/halaman.png dan bukti/ringkasan.txt sekarang.")
