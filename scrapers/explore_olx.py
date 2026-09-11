import requests
import json

def scrape_olx():
    # ID for Surabaya is 1000073
    url = "https://www.olx.co.id/api/relevance/v4/search?query=kost%20surabaya"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    print(f"Fetching {url}")
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            data = res.json()
            with open("olx_data.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print("Saved OLX data")
        else:
            print(f"OLX failed: {res.status_code} {res.text[:100]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    scrape_olx()
