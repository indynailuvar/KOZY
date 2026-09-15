# scrapers/explore_mamikos_pw.py
import json, re, time
from playwright.sync_api import sync_playwright

URLS = ["https://mamikos.com/cari/surabaya"]

def parse_cards(page):
    cards = page.query_selector_all("article, [class*='card' i], [class*='Card' i], a[href*='kost'], a[href*='info-kost']")
    out = []
    for c in cards:
        txt = re.sub(r"\s+", " ", c.inner_text() or "").strip()
        m = re.search(r"Rp\s?([\d.,]+)", txt)
        if not m or len(txt) < 10: continue
        harga = int(re.sub(r"[^\d]", "", m.group(1)))
        if not (50_000 <= harga <= 20_000_000): continue
        a = c if c.evaluate("el => el.tagName") == "A" else c.query_selector("a")
        href = a.get_attribute("href") if a else None
        out.append({"name": txt.split("Rp")[0].strip()[:80] or txt[:80],
                    "price": harga,
                    "url": ("https://mamikos.com" + href) if href and href.startswith("/") else href,
                    "raw_text": txt[:200]})
    return out

def main():
    semua = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36")
        for u in URLS:
            print(f"Fetching {u}")
            try:
                pg.goto(u, wait_until="domcontentloaded", timeout=45000)
                pg.wait_for_timeout(4000)
                if "just a moment" in (pg.title() or "").lower():
                    print("  ⚠ Terhalang anti-bot (Cloudflare). Stop."); break
                for _ in range(3):
                    pg.mouse.wheel(0, 3000); pg.wait_for_timeout(1500)
                cards = parse_cards(pg)
                print(f"  kartu terbaca: {len(cards)}")
                semua.extend(cards)
            except Exception as e:
                print("  error:", str(e)[:100])
            time.sleep(3)
        b.close()
    seen, uniq = set(), []
    for r in semua:
        k = r["url"] or r["name"]
        if k not in seen: seen.add(k); uniq.append(r)
    json.dump(uniq, open("mamikos_listings.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f" Saved mamikos_listings.json: {len(uniq)} listing")

if __name__ == "__main__":
    main()