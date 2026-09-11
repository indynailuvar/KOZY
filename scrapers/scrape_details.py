# scrapers/scrape_details.py
import json, re, time, random, os
from playwright.sync_api import sync_playwright

INPUT  = "gmaps_all_basic.json"   # pakai file terbesar (848 record unik)
OUTPUT = "gmaps_details.json"

def parse_latlng(link):
    m = re.search(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", link)
    return (float(m.group(1)), float(m.group(2))) if m else (None, None)

def load_existing():
    if os.path.exists(OUTPUT):
        with open(OUTPUT, encoding="utf-8") as f:
            return json.load(f)
    return []

def scrape_details():
    data    = json.load(open(INPUT, encoding="utf-8"))
    results = load_existing()
    done    = {r["link"] for r in results}
    print(f"Total target: {len(data)} | sudah selesai: {len(done)}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/125.0 Safari/537.36",
            locale="id-ID", viewport={"width": 1366, "height": 900})
        page = ctx.new_page()

        for i, item in enumerate(data):
            if item["link"] in done:
                continue
            rec = {"nama": item["name"], "link": item["link"],
                   "alamat": None, "telepon": None, "kategori": None,
                   "rating": None, "jumlah_ulasan": None, "sumber": "Google Maps"}
            rec["latitude"], rec["longitude"] = parse_latlng(item["link"])
            print(f"[{i+1}/{len(data)}] {item['name'][:55]}")
            try:
                page.goto(item["link"], wait_until="domcontentloaded", timeout=45000)
                page.wait_for_selector("h1", timeout=15000)
                time.sleep(random.uniform(1.5, 3.0))

                try: rec["nama"] = page.locator("h1").first.inner_text().strip()
                except: pass
                try: rec["alamat"] = page.locator('button[data-item-id="address"]').first.inner_text().strip()
                except: pass
                try: rec["telepon"] = page.locator('button[data-item-id="phone"]').first.inner_text().strip()
                except: pass
                try: rec["kategori"] = page.locator('button[data-item-id="authority"]').first.inner_text().strip()
                except: pass
                try:
                    rec["rating"] = float(page.locator("div.F7nice span[aria-hidden='true']").first.inner_text().replace(",", "."))
                except: pass
                try:
                    ul = page.locator("div.F7nice span[aria-label*='ulasan']").first.get_attribute("aria-label")
                    rec["jumlah_ulasan"] = int(re.sub(r"[^\d]", "", ul.replace(".", "")) or 0)
                except: pass
            except Exception as e:
                print("   ⚠ error:", str(e)[:80])

            results.append(rec)
            with open(OUTPUT, "w", encoding="utf-8") as f:   # simpan TIAP record
                json.dump(results, f, ensure_ascii=False, indent=2)
            time.sleep(random.uniform(2, 5))                  # rate limiting sopan
        browser.close()
    print(f"✅ Selesai. Total detail: {len(results)}")

if __name__ == "__main__":
    scrape_details()