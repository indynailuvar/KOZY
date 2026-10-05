"""
02 — PEMANEN MAMIKOS (jalur DOM).

Dipakai kalau skrip 01 menunjukkan halaman termuat normal. Skrip ini tidak
bergantung pada endpoint internal: ia membaca kartu yang sudah dirender,
persis seperti yang dilihat manusia. Lebih lambat, tapi tidak gampang patah.

Kalau skrip 01 menemukan kandidat endpoint JSON, pakai itu — jauh lebih
cepat dan datanya lebih lengkap. Skrip ini cadangan yang pasti jalan.

Keluaran: mamikos_listings.json
"""

import json, re, pathlib, time
from playwright.sync_api import sync_playwright

URL = ("https://mamikos.com/cari/"
       "surabaya-kota-surabaya-jawa-timur-indonesia/all/bulanan/0-15000000")

OUT = pathlib.Path("mamikos_listings.json")
MAKS_KLIK = 60          # tiap klik "Lihat lebih banyak" menambah ~20 kos
JEDA_MS = 2500          # jeda sopan antar klik


# JS yang dijalankan DI DALAM halaman. Cara ini jauh lebih tahan banting
# daripada menebak nama kelas CSS: kita cari semua tautan menuju detail kos,
# lalu naik ke kotak induknya dan ambil teksnya.
EKSTRAK = r"""
() => {
  const hasil = [];
  const tautan = document.querySelectorAll('a[href*="/room/"], a[href*="/kost-"], a[href*="/kos-"]');
  const sudah = new Set();

  for (const a of tautan) {
    const href = a.href;
    if (!href || sudah.has(href)) continue;

    // naik maksimal 6 tingkat sampai ketemu kotak yang memuat harga
    let kotak = a, teks = '';
    for (let i = 0; i < 6 && kotak; i++) {
      teks = (kotak.innerText || '').replace(/\s+/g, ' ').trim();
      if (/Rp\s?[\d.]{6,}/.test(teks)) break;
      kotak = kotak.parentElement;
    }
    if (!/Rp\s?[\d.]{6,}/.test(teks)) continue;
    sudah.add(href);

    hasil.push({
      url: href,
      teks: teks.slice(0, 600),
      gambar_alt: (kotak.querySelector('img') || {}).alt || null
    });
  }
  return hasil;
}
"""


def bersihkan(baris):
    """Ubah satu blok teks kartu menjadi baris data."""
    teks = baris["teks"]

    m = re.search(r"Rp\s?([\d.]{6,})", teks)
    if not m:
        return None
    harga = int(re.sub(r"[^\d]", "", m.group(1)))
    if not (100_000 <= harga <= 30_000_000):
        return None

    # nama = potongan sebelum harga, buang label promosi yang sering nempel
    nama = teks.split("Rp")[0]
    for label in ("Promo", "Diskon", "Kos Andalan", "Dikelola Mamikos",
                  "Singgahsini", "APIK", "Baru", "Sisa"):
        nama = nama.replace(label, " ")
    nama = re.sub(r"\s+", " ", nama).strip(" ·-|,")[:120]

    tipe = None
    for t in ("Putra", "Putri", "Campur"):
        if re.search(rf"\b{t}\b", teks, re.I):
            tipe = t.lower()
            break

    # fasilitas yang biasa disebut di kartu
    fasilitas = [f for f in ("AC", "K. Mandi Dalam", "Kamar Mandi Dalam", "WiFi",
                             "Wifi", "Kasur", "Lemari", "Meja", "Termasuk listrik")
                 if f.lower() in teks.lower()]

    slug = re.sub(r"^https?://[^/]+/", "", baris["url"]).strip("/")

    return {
        "nama": nama,
        "harga_bulanan": harga,
        "tipe": tipe,
        "fasilitas_kartu": sorted(set(f.lower() for f in fasilitas)),
        "url": baris["url"],
        "slug": slug,
        "sumber": "Mamikos",
        "teks_mentah": teks[:300],      # simpan, berguna saat mengecek ulang
    }


def main():
    mentah = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, channel="chrome")
        ctx = browser.new_context(locale="id-ID", viewport={"width": 1440, "height": 950})
        page = ctx.new_page()

        print("Membuka halaman pencarian...")
        resp = page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        if not resp or resp.status != 200:
            print(f"GAGAL: status {resp.status if resp else '??'} — URL salah atau diblokir.")
            print("Jalankan 01_diagnose_mamikos.py dulu.")
            browser.close()
            return

        try:
            page.wait_for_load_state("networkidle", timeout=30000)
        except Exception:
            pass
        page.wait_for_timeout(3000)

        sebelumnya = 0
        for putaran in range(MAKS_KLIK):
            page.mouse.wheel(0, 4000)
            page.wait_for_timeout(1200)

            mentah = page.evaluate(EKSTRAK)
            print(f"  putaran {putaran+1:2d} — kartu terbaca: {len(mentah)}")

            # berhenti kalau tiga putaran berturut-turut tidak nambah
            if len(mentah) == sebelumnya:
                try:
                    tombol = page.get_by_text(re.compile(r"lihat lebih banyak", re.I)).first
                    if tombol.is_visible(timeout=2500):
                        tombol.click()
                        page.wait_for_timeout(JEDA_MS)
                        continue
                except Exception:
                    pass
                print("  tidak ada tambahan lagi, berhenti.")
                break
            sebelumnya = len(mentah)
            page.wait_for_timeout(JEDA_MS)

        page.screenshot(path="mamikos_akhir.png", full_page=False)
        browser.close()

    # ---- bersihkan & simpan ----
    hasil, terlihat = [], set()
    for b in mentah:
        r = bersihkan(b)
        if r and r["url"] not in terlihat:
            terlihat.add(r["url"])
            hasil.append(r)

    OUT.write_text(json.dumps(hasil, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n" + "=" * 55)
    print(f"Kartu mentah  : {len(mentah)}")
    print(f"Baris bersih  : {len(hasil)}  -> {OUT}")
    if hasil:
        h = sorted(r["harga_bulanan"] for r in hasil)
        print(f"Harga         : Rp {h[0]:,} – Rp {h[-1]:,}  (median Rp {h[len(h)//2]:,})"
              .replace(",", "."))
        berfasilitas = sum(1 for r in hasil if r["fasilitas_kartu"])
        print(f"Ada fasilitas : {berfasilitas}/{len(hasil)}")


if __name__ == "__main__":
    main()
