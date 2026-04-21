import {
  validatePreferenceInput,
  buildPreferencePayload,
  formatRecommendationForCard,
  dedupeUiRecommendations,
} from "../src/uiLogic.mjs";

const API_BASE = window.RECOMMENDATION_API_BASE || "http://localhost:3000";

const form = document.getElementById("prefForm");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const submitBtn = document.getElementById("submitBtn");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "status error" : "status loading";
  if (!text) {
    statusEl.style.display = "none";
  } else {
    statusEl.style.display = "block";
  }
}

class SuggestionEngine {
  constructor(inputEl, suggestionEl, dataset) {
    this.inputEl = inputEl;
    this.suggestionEl = suggestionEl;
    this.dataset = dataset;
    this.activeIndex = -1;
    this.debounceTimer = null;

    this.init();
  }

  init() {
    this.inputEl.addEventListener("input", () => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.onInput(), 300);
    });

    this.inputEl.addEventListener("keydown", (e) => this.onKeyDown(e));

    document.addEventListener("click", (e) => {
      if (!this.inputEl.contains(e.target) && !this.suggestionEl.contains(e.target)) {
        this.hide();
      }
    });
  }

  onInput() {
    const value = this.inputEl.value.trim().toLowerCase();
    if (!value) {
      this.hide();
      return;
    }

    const matches = this.dataset.filter((item) => String(item).toLowerCase().includes(value));
    this.render(matches, value);
  }

  render(matches, query) {
    if (!matches.length) {
      this.suggestionEl.innerHTML = '<div class="no-matches">No matches found</div>';
    } else {
      this.suggestionEl.innerHTML = matches
        .slice(0, 8)
        .map((match, idx) => {
          const text = String(match);
          const regex = new RegExp(`(${query})`, "gi");
          const highlighted = text.replace(regex, '<span class="match">$1</span>');
          return `<div class="suggestion-item" data-index="${idx}" data-value="${text}">${highlighted}</div>`;
        })
        .join("");
    }

    this.suggestionEl.style.display = "block";
    this.activeIndex = -1;

    const items = this.suggestionEl.querySelectorAll(".suggestion-item");
    items.forEach((item) => {
      item.addEventListener("click", () => this.select(item.dataset.value));
    });
  }

  onKeyDown(e) {
    const items = this.suggestionEl.querySelectorAll(".suggestion-item");
    if (this.suggestionEl.style.display !== "block" || !items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % items.length;
      this.updateActive(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + items.length) % items.length;
      this.updateActive(items);
    } else if (e.key === "Enter") {
      if (this.activeIndex > -1) {
        e.preventDefault();
        this.select(items[this.activeIndex].dataset.value);
      }
    }
  }

  updateActive(items) {
    items.forEach((item, idx) => {
      item.classList.toggle("active", idx === this.activeIndex);
    });
  }

  select(value) {
    this.inputEl.value = value;
    this.hide();
  }

  hide() {
    this.suggestionEl.style.display = "none";
    this.activeIndex = -1;
  }
}

// Load metadata and init engines
async function initEngines() {
  try {
    const response = await fetch(`${API_BASE}/metadata`);
    const metadata = await response.json();

    new SuggestionEngine(document.getElementById("place"), document.getElementById("place-suggestions"), metadata.places);
    new SuggestionEngine(document.getElementById("cuisine"), document.getElementById("cuisine-suggestions"), metadata.cuisines);
    new SuggestionEngine(document.getElementById("price"), document.getElementById("price-suggestions"), metadata.prices);
    new SuggestionEngine(document.getElementById("rating"), document.getElementById("rating-suggestions"), metadata.ratings);
  } catch (err) {
    console.error("Failed to load metadata", err);
  }
}

initEngines();

function renderRecommendations(recommendations, summary) {
  if (!recommendations.length) {
    resultsEl.innerHTML = `<div class="card" style="text-align:center;"><p class="text-muted">No recommendations found matching your criteria.</p></div>`;
    return;
  }
  const cards = recommendations
    .map((rec) => formatRecommendationForCard(rec))
    .map(
      (card, idx) => `
      <div class="rec-card" style="animation-delay: ${idx * 0.1}s">
        <h3>${card.title}</h3>
        <p class="meta">${card.subtitle}</p>
        <div style="margin-bottom:16px;">${card.cuisines.split(', ').map(c => `<span class="pill">${c}</span>`).join('')}</div>
        <p class="reason">${card.reason}</p>
      </div>
    `
    )
    .join("");
  resultsEl.innerHTML = `
    <div class="summary-card">${summary}</div>
    <div class="rec-grid">
      ${cards}
    </div>
  `;
}

async function fetchRecommendations(payload) {
  const response = await fetch(`${API_BASE}/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.error || `API Error ${response.status}`;
    throw new Error(errorMsg);
  }
  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultsEl.innerHTML = "";

  const input = {
    price: form.price.value,
    place: form.place.value,
    rating: form.rating.value,
    cuisine: form.cuisine.value,
  };
  const validation = validatePreferenceInput(input);
  if (!validation.valid) {
    setStatus(validation.errors.join(" "), true);
    return;
  }

  try {
    submitBtn.disabled = true;
    setStatus("Analysing restaurants and generating recommendations...");
    const payload = buildPreferencePayload(input);
    const result = await fetchRecommendations(payload);
    const deduped = dedupeUiRecommendations(result.recommendations ?? []);
    renderRecommendations(deduped, result.summary ?? "Recommendations");
    setStatus(""); 
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    submitBtn.disabled = false;
  }
});
