from playwright.sync_api import sync_playwright
import time
import json

queries = [
    "kost wonokromo surabaya",
    "kost gubeng surabaya",
    "kost keputih surabaya",
    "kost ketintang surabaya",
    "kost rungkut surabaya",
    "kost mulyorejo surabaya",
    "kost ngagel surabaya",
    "kost tegalsari surabaya",
    "kost jambangan surabaya",
    "kost sawahan surabaya",
    "kost wiyung surabaya",
    "kost lakarsantri surabaya",
    "kost benowo surabaya",
    "kost gayungan surabaya",
    "kost sukolilo surabaya",
    "kost gunung anyar surabaya"
]

def scrape_multiple_queries():
    results = []
    seen_links = set()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        for q in queries:
            print(f"Searching for: {q}")
            url = f"https://www.google.com/maps/search/{q.replace(' ', '+')}/"
            try:
                page.goto(url)
                page.wait_for_selector('a[href*="/maps/place/"]', timeout=15000)
                time.sleep(3)
                
                # Scroll results
                for _ in range(8):
                    try:
                        page.hover('a[href*="/maps/place/"]')
                        page.mouse.wheel(0, 10000)
                        time.sleep(2)
                    except:
                        break
                        
                listings = page.locator('a[href*="/maps/place/"]').all()
                print(f"  Found {len(listings)} listings.")
                
                for listing in listings:
                    try:
                        name = listing.get_attribute('aria-label')
                        link = listing.get_attribute('href')
                        if name and link and link not in seen_links:
                            seen_links.add(link)
                            results.append({
                                "name": name,
                                "link": link
                            })
                    except Exception as e:
                        pass
                        
            except Exception as e:
                print(f"  Error on {q}: {e}")
                
        browser.close()
        
    with open("gmaps_all_basic.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(results)} total unique basic records.")

if __name__ == "__main__":
    scrape_multiple_queries()
