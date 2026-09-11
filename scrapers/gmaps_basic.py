from playwright.sync_api import sync_playwright
import time
import json

def scrape_gmaps(search_query):
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.google.com/maps/search/kost+surabaya/")
        
        print("Loaded Google Maps search")
        page.wait_for_selector('a[href*="/maps/place/"]', timeout=30000)
        time.sleep(5)
        time.sleep(5)
        
        print("Scrolling results...")
        # The scrollable container usually has role="feed" or aria-label="Results for..."
        # We can find it and scroll it to load more.
        
        # Let's just collect whatever we can for now.
        for _ in range(10): # Scroll 10 times
            # Try to hover and scroll
            try:
                page.hover('a[href*="/maps/place/"]')
                page.mouse.wheel(0, 10000)
                time.sleep(2)
            except:
                break
        
        # Now find all places in the list
        listings = page.locator('a[href*="/maps/place/"]').all()
        print(f"Found {len(listings)} listings in view.")
        
        for listing in listings:
            try:
                name = listing.get_attribute('aria-label')
                link = listing.get_attribute('href')
                if name:
                    results.append({
                        "name": name,
                        "link": link
                    })
            except Exception as e:
                pass
                
        browser.close()
        
    return results

if __name__ == "__main__":
    data = scrape_gmaps("kost surabaya")
    with open("gmaps_basic.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(data)} basic records.")
