# scrapers/explore_olx.py
import requests, json, time

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"}
BASE = "https://www.olx.co.id/api/relevance/v4/search"
QUERIES = ["kost surabaya", "kos sewa surabaya", "kos bulanan surabaya", "kost disewakan surabaya"]
JUAL = ["dijual", "jual cepat", "shm", "sertifikat", "luas tanah", "harga jual"]
SEWA = ["disewa", "disewakan", "sewakan", "bulanan", "per bulan", "harian"]

def is_sewa(ad):
    text = ((ad.get("title") or "") + " " + (ad.get("description") or "")).lower()
    params = " ".join(str(p.get("value", "")) for p in ad.get("parameters", [])).lower()
    if any(w in text or w in params for w in JUAL): return False
    if any(w in text or w in params for w in SEWA): return True
    raw = (ad.get("price") or {}).get("value", {}).get("raw")
    return bool(raw) and 100_000 <= raw <= 20_000_000 and ("kos" in text or "kost" in text)

def scrape():
    semua, sewa = [], []
    for q in QUERIES:
        for page in range(1, 4):
            try:
                r = requests.get(f"{BASE}?query={q.replace(' ', '%20')}&page={page}",
                                 headers=HEADERS, timeout=30)
                if r.status_code != 200:
                    print(f"  {q} p{page}: HTTP {r.status_code} -> lewati"); break
                ads = r.json().get("data", [])
            except Exception as e:
                print(f"  {q} p{page}: error {e}"); break
            if not ads: break
            for ad in ads:
                semua.append(ad)
                if is_sewa(ad):
                    raw = (ad.get("price") or {}).get("value", {}).get("raw")
                    loc = (ad.get("locations") or [{}])[0]
                    sewa.append({"title": ad.get("title"), "price": int(raw),
                                 "lat": loc.get("lat"), "lon": loc.get("lon"),
                                 "url": ad.get("url"), "query": q})
            time.sleep(2)
        time.sleep(2)

    json.dump(semua, open("olx_raw.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(sewa,  open("olx_sewa.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nTotal iklan diambil : {len(semua)}")
    print(f"Iklan SEWA lolos    : {len(sewa)}")
    harga = [(a.get("price") or {}).get("value", {}).get("raw") for a in semua]
    harga = [h for h in harga if h]
    if harga: print(f"Rentang harga mentah: Rp {min(harga):,.0f} s/d Rp {max(harga):,.0f}")
    print("Contoh judul yang TIDAK lolos:")
    for a in semua[:5]:
        print("   -", a.get("title"), "|", (a.get("price") or {}).get("value", {}).get("display"))

if __name__ == "__main__":
    scrape()