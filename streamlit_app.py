import streamlit as st
import json
import re
import os
from pathlib import Path
from typing import List, Dict, Any
import requests
from dotenv import load_dotenv

# --- Initialization ---
load_dotenv()
ROOT = Path(__file__).parent

# --- Logic Re-implementation (Python) ---

def parse_price(raw: Any) -> int:
    if isinstance(raw, (int, float)): return int(raw)
    cleaned = re.sub(r"[^\d]", "", str(raw or ""))
    return int(cleaned) if cleaned else 0

def parse_rating(raw: Any) -> float:
    if isinstance(raw, (int, float)): return float(raw)
    match = re.search(r"([0-5](?:\.\d+)?)", str(raw or ""))
    return float(match.group(1)) if match else 0.0

def canonicalize_cuisines(raw: Any) -> List[str]:
    if not raw: return []
    if isinstance(raw, list): return [str(c).strip() for c in raw if c]
    tokens = [t.strip() for t in re.split(r"[,/]", str(raw)) if t.strip()]
    seen = set()
    out = []
    for token in tokens:
        normalized = " ".join(word.capitalize() for word in token.split())
        if normalized not in seen:
            seen.add(normalized)
            out.append(normalized)
    return out

def load_data():
    runs_dir = ROOT / "phase1" / "artifacts" / "ingestion-runs"
    if not runs_dir.exists(): return []
    
    snapshots = sorted(list(runs_dir.glob("*-raw-snapshot.json")), key=os.path.getmtime, reverse=True)
    if not snapshots: return []
    
    with open(snapshots[0], "r", encoding="utf-8") as f:
        data = json.load(f)
    
    rows = data.get("rows", [])
    normalized = []
    for row in rows:
        normalized.append({
            "name": str(row.get("name") or "").strip(),
            "place": str(row.get("place") or row.get("location") or "").strip(),
            "price_for_two": parse_price(row.get("price_for_two") or row.get("approx_cost(for two people)") or 0),
            "rating": parse_rating(row.get("rating") or row.get("rate") or 0),
            "cuisines": canonicalize_cuisines(row.get("cuisines") or []),
        })
    return normalized

def rank_candidates(restaurants, pref):
    ranked = []
    pref_cuisines = set([str(c).lower() for c in pref.get("cuisines", []) if c])
    pref_place = str(pref.get("place") or "").lower()
    pref_price = pref.get("price", 0)
    pref_rating = pref.get("rating", 0)

    for r in restaurants:
        # Simple Filtering
        r_place = str(r.get("place") or "").lower()
        place_ok = not pref_place or pref_place in r_place
        price_ok = not pref_price or r.get("price_for_two", 0) <= pref_price
        rating_ok = not pref_rating or r.get("rating", 0) >= pref_rating
        
        r_cuisines = [str(c).lower() for c in r.get("cuisines", [])]
        cuisine_ok = not pref_cuisines or any(c in pref_cuisines for c in r_cuisines)

        if place_ok and price_ok and rating_ok and cuisine_ok:
            # Scoring
            cuisine_score = 0
            if pref_cuisines:
                matches = sum(1 for c in r_cuisines if c in pref_cuisines)
                cuisine_score = matches / len(pref_cuisines)
            
            rating_score = r.get("rating", 0) / 5.0
            price_score = 1.0
            r_price = r.get("price_for_two", 0)
            if pref_price and r_price > pref_price:
                price_score = max(0, 1 - (r_price - pref_price) / pref_price)
            
            score = (cuisine_score * 0.4) + (rating_score * 0.3) + (price_score * 0.2) + (1.0 * 0.1)
            r["match_score"] = round(score, 4)
            ranked.append(r)
    
    return sorted(ranked, key=lambda x: x.get("match_score", 0), reverse=True)[:20]

def generate_groq_recommendations(apiKey, model, preference, candidates):
    if not apiKey:
        return {
            "recommendations": candidates[:5],
            "summary": "Fallback recommendations (Groq key missing)"
        }
    
    prompt = f"""You are a food expert. Recommend the top 5 restaurants from the candidates below based on these preferences:
Budget: {preference.get('price')} INR
Place: {preference.get('place')}
Min Rating: {preference.get('rating')}
Cuisines: {', '.join(preference.get('cuisines', []))}

Candidates:
{json.dumps(candidates, indent=2)}

Respond ONLY with a JSON object:
{{
  \"recommendations\": [ {{ \"name\": \"...\", \"reason\": \"...\" }}, ... ],
  \"summary\": \"...\"
}}"""

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {apiKey}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "response_format": { "type": "json_object" }
            },
            timeout=10
        )
        res_data = response.json()
        return json.loads(res_data['choices'][0]['message']['content'])
    except Exception as e:
        return {"recommendations": candidates[:5], "summary": f"Error calling LLM: {str(e)}"}

# --- Streamlit UI ---

st.set_page_config(page_title="Zomato NextLeap | AI Recommendations", layout="wide")

st.markdown("""
    <style>
    .main { background-color: #0f172a; color: #f1f5f9; }
    .stButton>button { background-color: #ff4757; color: white; border-radius: 12px; border: none; }
    .stTextInput>div>div>input { background-color: #1e293b; color: white; border-radius: 10px; }
    .stNumberInput>div>div>input { background-color: #1e293b; color: white; border-radius: 10px; }
    </style>
""", unsafe_allow_html=True)

st.title("Zomato NextLeap 🚀")
st.subheader("AI-Powered Restaurant Recommendations")

restaurants = load_data()
if not restaurants:
    st.error("No restaurant data found. Please run the ingestion pipeline first.")
    st.stop()

# Sidebar for Inputs
with st.sidebar:
    st.header("User Preferences")
    price = st.number_input("Max Budget (₹)", min_value=0, value=1500, step=100)
    place = st.text_input("Locality", placeholder="e.g. Banashankari")
    rating = st.slider("Min Rating", min_value=0.0, max_value=5.0, value=4.0, step=0.1)
    cuisine_raw = st.text_input("Cuisines (comma separated)", placeholder="e.g. Italian, North Indian")
    cuisines = [c.strip() for c in cuisine_raw.split(",") if c.strip()]

    discover = st.button("Discover Restaurants")

if discover:
    pref = {"price": price, "place": place, "rating": rating, "cuisines": cuisines}
    
    with st.spinner("Finding the best restaurants for you..."):
        ranked = rank_candidates(restaurants, pref)
        
        if not ranked:
            st.warning("No restaurants found matching your criteria.")
        else:
            apiKey = os.getenv("GROQ_API_KEY")
            model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            
            results = generate_groq_recommendations(apiKey, model, pref, ranked)
            
            st.success(results.get("summary", "Recommendations ready!"))
            
            cols = st.columns(2)
            for i, rec in enumerate(results.get("recommendations", [])):
                # Find the full restaurant data to get details
                full_r = next((r for r in ranked if r['name'] == rec['name']), {})
                
                with cols[i % 2]:
                    with st.container(border=True):
                        st.markdown(f"### {rec['name']}")
                        st.write(f"📍 {full_r.get('place', 'N/A')} | ⭐ {full_r.get('rating', 'N/A')}")
                        st.write(f"💰 Price for two: ₹{full_r.get('price_for_two', 'N/A')}")
                        st.write(f"🍴 {', '.join(full_r.get('cuisines', []))}")
                        st.info(rec.get("reason", ""))
