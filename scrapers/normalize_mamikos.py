# scrapers/normalize_mamikos.py  (FILE BARU)
import json, re

def walk(node, out):
    if isinstance(node, dict):
        name  = node.get("name") or node.get("title") or node.get("judul")
        price = node.get("price") or node.get("harga") or node.get("priceText")
        url   = node.get("url") or node.get("link") or node.get("slug")
        lat, lng = node.get("latitude") or node.get("lat"), node.get("longitude") or node.get("lng")
        if name and price and (url or lat):
            p = price if isinstance(price, (int, float)) else re.sub(r"[^\d]", "", str(price))
            try: p = int(p)
            except Exception: p = None
            if p and 50_000 <= p <= 20_000_000:
                out.append({"name": str(name), "price": p, "url": str(url or ""),
                            "lat": lat, "lng": lng,
                            "address": node.get("address") or node.get("alamat"),
                            "facilities": node.get("facilities") or node.get("fasilitas")})
        for v in node.values(): walk(v, out)
    elif isinstance(node, list):
        for v in node: walk(v, out)

raw = json.load(open("mamikos_data.json", encoding="utf-8"))
out = []; walk(raw, out)
seen, uniq = set(), []
for r in out:
    k = r["url"] or r["name"]
    if k not in seen: seen.add(k); uniq.append(r)
json.dump(uniq, open("mamikos_listings.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
print(f"Mamikos listings ternormalisasi: {len(uniq)}")