import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { APP_CONFIG } from "./config.js";

const els = {
  authPanel: document.getElementById("auth-panel"),
  appPanel: document.getElementById("app-panel"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  signInBtn: document.getElementById("signin-btn"),
  signUpBtn: document.getElementById("signup-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  authMessage: document.getElementById("auth-message"),
  userChip: document.getElementById("user-chip"),
  searchForm: document.getElementById("search-form"),
  searchName: document.getElementById("search-name"),
  searchSet: document.getElementById("search-set"),
  searchNumber: document.getElementById("search-number"),
  clearSearchBtn: document.getElementById("clear-search-btn"),
  searchMessage: document.getElementById("search-message"),
  searchResults: document.getElementById("search-results"),
  binderGrid: document.getElementById("binder-grid"),
  binderFilter: document.getElementById("binder-filter"),
  manualForm: document.getElementById("manual-form"),
  manualMessage: document.getElementById("manual-message"),
  refreshPricesBtn: document.getElementById("refresh-prices-btn"),
  statTotalCards: document.getElementById("stat-total-cards"),
  statUniqueCards: document.getElementById("stat-unique-cards"),
  statTotalValue: document.getElementById("stat-total-value"),
  statLastAdded: document.getElementById("stat-last-added"),
  startCameraBtn: document.getElementById("start-camera-btn"),
  takePhotoBtn: document.getElementById("take-photo-btn"),
  retakePhotoBtn: document.getElementById("retake-photo-btn"),
  stopCameraBtn: document.getElementById("stop-camera-btn"),
  cameraVideo: document.getElementById("camera-video"),
  cameraCanvas: document.getElementById("camera-canvas"),
  cameraMessage: document.getElementById("camera-message")
};

const state = {
  supabase: null,
  session: null,
  user: null,
  collection: [],
  searchResults: [],
  stream: null,
  lastAddedName: "—"
};

function safeText(v) { return String(v || "").trim(); }
function money(v) { return `$${Number(v || 0).toFixed(2)}`; }

function collectionKey() {
  return state.user ? `pokecollection_${state.user.id}` : "";
}

function setMessage(el, msg = "", isError = false) {
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", !!isError);
}

function getCardPrice(card) {
  return Number(
    card?.tcgplayer?.prices?.holofoil?.market ??
    card?.tcgplayer?.prices?.normal?.market ??
    card?.tcgplayer?.prices?.reverseHolofoil?.market ??
    card?.cardmarket?.prices?.averageSellPrice ??
    0
  );
}

function normalizeCard(card, source = "search") {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    apiCardId: card.id || "",
    name: safeText(card.name),
    setName: safeText(card?.set?.name || card.setName),
    number: safeText(card.number),
    rarity: safeText(card.rarity),
    condition: safeText(card.condition || "Near Mint"),
    quantity: Number(card.quantity || 1),
    price: Number(card.price ?? getCardPrice(card)),
    imageSmall: card?.images?.small || card.imageSmall || "",
    imageLarge: card?.images?.large || card.imageLarge || "",
    storage: safeText(card.storage),
    notes: safeText(card.notes),
    source,
    createdAt: new Date().toISOString()
  };
}

function loadCollection() {
  const key = collectionKey();
  if (!key) {
    state.collection = [];
    renderAll();
    return;
  }
  try {
    state.collection = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    state.collection = [];
  }
  renderAll();
}

function saveCollection() {
  const key = collectionKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(state.collection));
  renderAll();
}

function renderStats() {
  const totalCards = state.collection.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  const totalValue = state.collection.reduce((sum, c) => sum + Number(c.quantity || 0) * Number(c.price || 0), 0);
  els.statTotalCards.textContent = String(totalCards);
  els.statUniqueCards.textContent = String(state.collection.length);
  els.statTotalValue.textContent = money(totalValue);
  els.statLastAdded.textContent = state.lastAddedName || "—";
}

function renderBinder() {
  const q = safeText(els.binderFilter.value).toLowerCase();
  els.binderGrid.replaceChildren();

  const filtered = state.collection.filter(card => {
    const blob = `${card.name} ${card.setName} ${card.number} ${card.storage}`.toLowerCase();
    return blob.includes(q);
  });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "binder-card";
    empty.innerHTML = "<h4>No cards yet</h4><p class='meta'>Add cards from search, manual entry, or photo assist.</p>";
    els.binderGrid.appendChild(empty);
    return;
  }

  for (const card of filtered) {
    const wrap = document.createElement("article");
    wrap.className = "binder-card";
    wrap.innerHTML = `
      <img src="${card.imageSmall || "./assets/card-placeholder.svg"}" alt="${escapeHtml(card.name)}">
      <h4>${escapeHtml(card.name)}</h4>
      <div class="meta">${escapeHtml(card.setName || "Unknown Set")} • ${escapeHtml(card.number || "—")}</div>
      <div class="meta">Qty ${card.quantity} • ${escapeHtml(card.condition || "Near Mint")}</div>
      <div class="price">${money(card.price)}</div>
      <div class="row gap wrap" style="margin-top:10px">
        <button data-id="${card.id}" data-action="plus">+1</button>
        <button data-id="${card.id}" data-action="minus" class="secondary">-1</button>
        <button data-id="${card.id}" data-action="remove" class="ghost">Remove</button>
      </div>
    `;
    els.binderGrid.appendChild(wrap);
  }
}

function renderSearchResults() {
  els.searchResults.replaceChildren();
  if (!state.searchResults.length) return;

  for (const card of state.searchResults) {
    const item = document.createElement("article");
    item.className = "search-card";
    item.innerHTML = `
      <img src="${card?.images?.small || "./assets/card-placeholder.svg"}" alt="${escapeHtml(card.name)}">
      <h4>${escapeHtml(card.name)}</h4>
      <div class="meta">${escapeHtml(card?.set?.name || "")} • ${escapeHtml(card.number || "")}</div>
      <div class="meta">${escapeHtml(card.rarity || "Unknown rarity")}</div>
      <div class="price">${money(getCardPrice(card))}</div>
      <div class="row gap wrap" style="margin-top:10px">
        <button data-action="add-search" data-card-id="${card.id}">Add to Binder</button>
      </div>
    `;
    els.searchResults.appendChild(item);
  }
}

function renderAll() {
  renderStats();
  renderBinder();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function searchCards(event) {
  event.preventDefault();
  setMessage(els.searchMessage, "Searching...");
  els.searchResults.replaceChildren();

  const params = new URLSearchParams();
  if (safeText(els.searchName.value)) params.set("name", safeText(els.searchName.value));
  if (safeText(els.searchSet.value)) params.set("set", safeText(els.searchSet.value));
  if (safeText(els.searchNumber.value)) params.set("number", safeText(els.searchNumber.value));

  if (![...params.keys()].length) {
    setMessage(els.searchMessage, "Enter a name, set, or number first.", true);
    return;
  }

  try {
    const response = await fetch(`/api/cards?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error || `Search failed (${response.status})`);

    state.searchResults = Array.isArray(json.data) ? json.data : [];
    renderSearchResults();
    setMessage(els.searchMessage, state.searchResults.length ? `Found ${state.searchResults.length} result(s).` : "No cards found.");
  } catch (error) {
    state.searchResults = [];
    renderSearchResults();
    setMessage(els.searchMessage, error.message || "Search failed.", true);
  }
}

async function refreshPrices() {
  if (!state.user) {
    setMessage(els.searchMessage, "Log in first to refresh prices for your collection.", true);
    return;
  }
  if (!state.collection.length) {
    setMessage(els.searchMessage, "Your collection is empty.");
    return;
  }

  setMessage(els.searchMessage, "Refreshing prices...");
  let updated = 0;

  for (const card of state.collection) {
    if (!card.apiCardId) continue;
    try {
      const response = await fetch(`/api/card?id=${encodeURIComponent(card.apiCardId)}`, {
        headers: { Accept: "application/json" }
      });
      const json = await response.json();
      if (response.ok && json?.data) {
        card.price = getCardPrice(json.data);
        updated += 1;
      }
    } catch {}
  }

  saveCollection();
  setMessage(els.searchMessage, `Updated ${updated} card price${updated === 1 ? "" : "s"}.`);
}

function ensureLoggedIn(targetMessageEl) {
  if (!state.user) {
    setMessage(targetMessageEl, "Login required. Please sign in first.", true);
    return false;
  }
  return true;
}

function addCardToCollection(rawCard, source = "search") {
  const card = normalizeCard(rawCard, source);
  state.collection.unshift(card);
  state.lastAddedName = card.name;
  saveCollection();
}

function submitManualForm(event) {
  event.preventDefault();
  if (!ensureLoggedIn(els.manualMessage)) return;

  const card = {
    name: document.getElementById("manual-name").value,
    setName: document.getElementById("manual-set").value,
    number: document.getElementById("manual-number").value,
    rarity: document.getElementById("manual-rarity").value,
    condition: document.getElementById("manual-condition").value,
    quantity: document.getElementById("manual-quantity").value,
    price: document.getElementById("manual-price").value,
    storage: document.getElementById("manual-storage").value,
    notes: document.getElementById("manual-notes").value
  };

  if (!safeText(card.name)) {
    setMessage(els.manualMessage, "Enter a card name first.", true);
    return;
  }

  addCardToCollection(card, "manual");
  els.manualForm.reset();
  document.getElementById("manual-quantity").value = 1;
  document.getElementById("manual-price").value = 0;
  setMessage(els.manualMessage, "Card added to your binder.");
}

async function addSearchResult(cardId) {
  if (!ensureLoggedIn(els.searchMessage)) return;
  const card = state.searchResults.find(item => item.id === cardId);
  if (!card) return;
  addCardToCollection(card, "search");
  setMessage(els.searchMessage, `${card.name} added to your binder.`);
}

function updateAppVisibility() {
  const signedIn = !!state.user;
  els.authPanel.classList.toggle("hidden", signedIn);
  els.appPanel.classList.toggle("hidden", !signedIn);
  els.userChip.classList.toggle("hidden", !signedIn);
  els.logoutBtn.classList.toggle("hidden", !signedIn);
  els.userChip.textContent = signedIn ? state.user.email : "";
}

async function signIn() {
  setMessage(els.authMessage, "Signing in...");
  const email = safeText(els.authEmail.value);
  const password = safeText(els.authPassword.value);

  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setMessage(els.authMessage, error.message, true);
    return;
  }

  state.session = data.session;
  state.user = data.user;
  updateAppVisibility();
  loadCollection();
  setMessage(els.authMessage, "Signed in.");
}

async function signUp() {
  setMessage(els.authMessage, "Creating account...");
  const email = safeText(els.authEmail.value);
  const password = safeText(els.authPassword.value);

  const { data, error } = await state.supabase.auth.signUp({ email, password });
  if (error) {
    setMessage(els.authMessage, error.message, true);
    return;
  }

  setMessage(
    els.authMessage,
    data?.session ? "Account created and signed in." : "Account created. Check your email if confirmation is enabled."
  );

  state.session = data.session || null;
  state.user = data.user || null;
  updateAppVisibility();
  loadCollection();
}

async function signOut() {
  await state.supabase.auth.signOut();
  state.session = null;
  state.user = null;
  state.collection = [];
  state.lastAddedName = "—";
  updateAppVisibility();
  renderAll();
  stopCamera();
}

async function initAuth() {
  if (!APP_CONFIG.SUPABASE_URL || APP_CONFIG.SUPABASE_URL.includes("YOUR_PROJECT")) {
    setMessage(els.authMessage, "Edit config.js with your Supabase project URL and anon key.", true);
    return;
  }

  state.supabase = createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
  const { data: sessionData } = await state.supabase.auth.getSession();
  state.session = sessionData.session;
  state.user = sessionData.session?.user || null;
  updateAppVisibility();
  loadCollection();

  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    updateAppVisibility();
    loadCollection();
  });
}

async function startCamera() {
  try {
    stopCamera(false);
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    els.cameraVideo.srcObject = state.stream;
    els.cameraVideo.classList.remove("hidden");
    els.cameraCanvas.classList.add("hidden");
    els.takePhotoBtn.disabled = false;
    els.retakePhotoBtn.disabled = true;
    els.stopCameraBtn.disabled = false;
    setMessage(els.cameraMessage, "Camera ready. Take a photo, then use manual fields to save.");
  } catch (error) {
    setMessage(els.cameraMessage, error.message || "Could not start the camera.", true);
  }
}

function takePhoto() {
  const video = els.cameraVideo;
  const canvas = els.cameraCanvas;
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  els.cameraCanvas.classList.remove("hidden");
  els.cameraVideo.classList.add("hidden");
  els.retakePhotoBtn.disabled = false;
  setMessage(els.cameraMessage, "Photo captured. Enter the card details in the manual form and save.");
}

function stopCamera(clearMsg = true) {
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
  els.cameraVideo.srcObject = null;
  els.cameraVideo.classList.add("hidden");
  els.cameraCanvas.classList.add("hidden");
  els.takePhotoBtn.disabled = true;
  els.retakePhotoBtn.disabled = true;
  els.stopCameraBtn.disabled = true;
  if (clearMsg) setMessage(els.cameraMessage, "Camera stopped.");
}

function retakePhoto() {
  startCamera();
}

function handleBinderActions(event) {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const { action, id, cardId } = btn.dataset;

  if (action === "add-search") {
    addSearchResult(cardId);
    return;
  }

  const index = state.collection.findIndex(card => card.id === id);
  if (index < 0) return;

  if (action === "plus") state.collection[index].quantity += 1;
  if (action === "minus") state.collection[index].quantity = Math.max(1, Number(state.collection[index].quantity) - 1);
  if (action === "remove") state.collection.splice(index, 1);

  saveCollection();
}

function bindEvents() {
  els.signInBtn.addEventListener("click", signIn);
  els.signUpBtn.addEventListener("click", signUp);
  els.logoutBtn.addEventListener("click", signOut);
  els.searchForm.addEventListener("submit", searchCards);
  els.clearSearchBtn.addEventListener("click", () => {
    els.searchForm.reset();
    state.searchResults = [];
    renderSearchResults();
    setMessage(els.searchMessage, "");
  });
  els.refreshPricesBtn.addEventListener("click", refreshPrices);
  els.manualForm.addEventListener("submit", submitManualForm);
  els.searchResults.addEventListener("click", handleBinderActions);
  els.binderGrid.addEventListener("click", handleBinderActions);
  els.binderFilter.addEventListener("input", renderBinder);
  els.startCameraBtn.addEventListener("click", startCamera);
  els.takePhotoBtn.addEventListener("click", takePhoto);
  els.retakePhotoBtn.addEventListener("click", retakePhoto);
  els.stopCameraBtn.addEventListener("click", () => stopCamera());
}

bindEvents();
renderAll();
initAuth();
