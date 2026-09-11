import requests
import json
import re
from bs4 import BeautifulSoup

def scrape_mamikos_surabaya():
    url = "https://mamikos.com/cari/surabaya"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    print(f"Fetching {url}...")
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # In Next.js, page data is often in a <script id="__NEXT_DATA__" type="application/json">
        next_data_tag = soup.find('script', id='__NEXT_DATA__')
        
        if next_data_tag:
            print("Found __NEXT_DATA__")
            data = json.loads(next_data_tag.string)
            with open("mamikos_data.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("Saved __NEXT_DATA__ to mamikos_data.json")
        else:
            print("Could not find __NEXT_DATA__. Checking for other scripts...")
            with open("mamikos_page.html", "w", encoding="utf-8") as f:
                f.write(response.text)
            print("Saved page HTML for manual inspection.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    scrape_mamikos_surabaya()
