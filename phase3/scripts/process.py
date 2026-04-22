import json
import re
import os
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(".")
INPUT_DIR = ROOT / "phase1" / "artifacts" / "ingestion-runs"
OUTPUT_DIR = ROOT / "phase2" / "artifacts" / "curated-runs"

def normalize_text(value):
    return " ".join(str(value or "").strip().split())

def parse_price(raw):
    if isinstance(raw, (int, float)): return int(raw)
    cleaned = re.sub(r"[^\d]", "", str(raw or ""))
    if not cleaned: return None
    return int(cleaned)

def parse_rating(raw):
    if isinstance(raw, (int, float)):
        if 0 <= raw <= 5: return float(raw)
        return None
    match = re.search(r"([0-5](?:\.\d+)?)", str(raw or ""))
    return float(match.group(1)) if match else None

def to_title_case(text):
    return " ".join(word.capitalize() for word in text.split())

def parse_cuisines(raw):
    if not raw: return []
    if isinstance(raw, list): 
        tokens = [normalize_text(str(c)) for c in raw if c]
    else:
        tokens = [normalize_text(t) for t in re.split(r"[,/]", str(raw)) if t.strip()]
    
    out = []
    seen = set()
    for t in tokens:
        normalized = to_title_case(t)
        if normalized and normalized not in seen:
            seen.add(normalized)
            out.append(normalized)
    return out

def map_source_record(source_row):
    row = source_row.get("row", source_row)
    return {
        "name": normalize_text(row.get("name")),
        "place": normalize_text(row.get("location") or row.get("place")),
        "price_for_two": parse_price(row.get("approx_cost(for two people)") or row.get("price") or row.get("price_for_two")),
        "rating": parse_rating(row.get("rate") or row.get("rating")),
        "cuisines": parse_cuisines(row.get("cuisines")),
        "source": "huggingface"
    }

def validate_restaurant(record):
    errors = []
    if not record["name"]: errors.push("name is required")
    if not record["place"]: errors.push("place is required")
    if record["price_for_two"] is None or record["price_for_two"] < 0:
        errors.append("price_for_two must be a non-negative integer")
    if record["rating"] is None or not (0 <= record["rating"] <= 5):
        errors.append("rating must be a number between 0 and 5")
    if not record["cuisines"]:
        errors.append("cuisines must be a non-empty array")
    return {"valid": not errors, "errors": errors}

def main():
    if not INPUT_DIR.exists():
        print(f"Input directory {INPUT_DIR} does not exist.")
        return

    snapshots = sorted(list(INPUT_DIR.glob("*-raw-snapshot.json")), key=os.path.getmtime, reverse=True)
    if not snapshots:
        print("No raw snapshots found.")
        return

    latest_snapshot = snapshots[0]
    print(f"Processing latest snapshot: {latest_snapshot.name}")
    
    with open(latest_snapshot, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    rows = data.get("rows", [])
    curated = []
    rejected = []
    
    for input_row in rows:
        try:
            normalized = map_source_record(input_row)
            v = validate_restaurant(normalized)
            if v["valid"]:
                curated.append(normalized)
            else:
                rejected.append({"input": input_row, "errors": v["errors"]})
        except Exception as e:
            rejected.append({"input": input_row, "errors": [str(e)]})
            
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = int(time.time() * 1000)
    output_filename = f"phase2-{timestamp}-curated-snapshot.json"
    
    output_data = {
        "sourceSnapshot": latest_snapshot.name,
        "processedAt": datetime.utcnow().isoformat() + "Z",
        "stats": {
            "total": len(rows),
            "curated": len(curated),
            "rejected": len(rejected)
        },
        "restaurants": curated
    }
    
    with open(OUTPUT_DIR / output_filename, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Normalization successful. Saved {len(curated)} curated records to {output_filename}")
    print(f"Rejected {len(rejected)} records.")

if __name__ == "__main__":
    main()
