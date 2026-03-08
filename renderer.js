const CACHE_KEY = 'penal_lookup_cache_v2';
const KEYWORD_ALIAS_PATH = 'data/keyword_aliases.json';
const FAVORITES_KEY = 'penal_lookup_favorites_v1';

const SUPPLEMENTAL_ENTRIES = [
  {
    code: '545.351',
    codeSystem: 'Transportation Code',
    title: 'Maximum Speed Requirement',
    statuteText:
      'An operator may not drive at a speed greater than is reasonable and prudent under the circumstances then existing.',
    plainEnglish:
      'Driving faster than is safe for conditions can be cited as speeding, even if no specific posted limit is exceeded.',
    keywords: [
      'speeding',
      'too fast',
      'unsafe speed',
      'excessive speed',
      'speed violation',
      'driving too fast',
      'over speed'
    ],
    sourceUrl: 'https://statutes.capitol.texas.gov/Docs/TN/htm/TN.545.htm#545.351'
  },
  {
    code: '545.352',
    codeSystem: 'Transportation Code',
    title: 'Prima Facie Speed Limits',
    statuteText:
      'Defines posted and default speed limits and when exceeding those limits is prima facie evidence of unreasonable speed.',
    plainEnglish:
      'Covers posted speed limits (for example, 55 in a 35) and default speed limits in specific areas.',
    keywords: [
      'speed limit',
      'posted speed',
      'over posted speed',
      'school zone speed',
      'construction zone speed',
      '55 in 35',
      'speeding ticket'
    ],
    sourceUrl: 'https://statutes.capitol.texas.gov/Docs/TN/htm/TN.545.htm#545.352'
  },
  {
    code: '545.401',
    codeSystem: 'Transportation Code',
    title: 'Reckless Driving',
    statuteText:
      'A person commits an offense if the person drives a vehicle in willful or wanton disregard for the safety of persons or property.',
    plainEnglish:
      'Dangerous driving behavior (high-speed, aggressive, or hazardous) can be charged as reckless driving.',
    keywords: [
      'reckless driving',
      'dangerous driving',
      'high speed chase',
      'aggressive driving',
      'willful disregard',
      'swerving traffic'
    ],
    sourceUrl: 'https://statutes.capitol.texas.gov/Docs/TN/htm/TN.545.htm#545.401'
  }
];

const state = {
  dataset: [],
  cache: loadCache(),
  filtered: [],
  selectedCode: null,
  query: '',
  resultFilter: 'all',
  favoriteCodes: loadFavorites()
};

const ui = {
  searchInput: document.getElementById('searchInput'),
  clearBtn: document.getElementById('clearBtn'),
  resultsList: document.getElementById('resultsList'),
  resultCount: document.getElementById('resultCount'),
  resultFilter: document.getElementById('resultFilter'),
  emptyState: document.getElementById('emptyState'),
  detailCard: document.getElementById('detailCard'),
  codeNumber: document.getElementById('codeNumber'),
  offenseTitle: document.getElementById('offenseTitle'),
  statuteText: document.getElementById('statuteText'),
  plainEnglish: document.getElementById('plainEnglish'),
  sourceLink: document.getElementById('sourceLink'),
  cacheStatus: document.getElementById('cacheStatus'),
  copyBtn: document.getElementById('copyBtn'),
  favoriteBtn: document.getElementById('favoriteBtn'),
  favoritesBar: document.getElementById('favoritesBar'),
  favoritesList: document.getElementById('favoritesList'),
  favoritesEmpty: document.getElementById('favoritesEmpty'),
  favoritesCount: document.getElementById('favoritesCount'),
  minimizeBtn: document.getElementById('minimizeBtn'),
  maximizeBtn: document.getElementById('maximizeBtn'),
  closeBtn: document.getElementById('closeBtn')
};

const appApi = buildAppApi();

init();

async function init() {
  bindEvents();

  try {
    state.dataset = await appApi.loadDataset();
    state.dataset = appendSupplementalEntries(state.dataset);
    const aliases = await loadKeywordAliases();
    state.dataset = mergeAliasKeywords(state.dataset, aliases);
    state.filtered = [...state.dataset];
    state.favoriteCodes = state.favoriteCodes.filter((code) => state.dataset.some((item) => String(item.code) === String(code)));
    saveFavorites(state.favoriteCodes);
    renderResults(state.filtered);
    renderFavorites();
  } catch (error) {
    console.error(error);
    state.dataset = [];
    state.filtered = [];
    renderResults([]);
    renderFavorites();
    ui.emptyState.textContent = 'Failed to load penal code dataset.';
  }
}

function bindEvents() {
  ui.searchInput?.addEventListener('input', debounce(onSearchChange, 70));
  ui.resultFilter?.addEventListener('change', onFilterChange);

  ui.clearBtn?.addEventListener('click', () => {
    ui.searchInput.value = '';
    onSearchChange();
    ui.searchInput.focus();
  });

  ui.copyBtn?.addEventListener('click', async () => {
    const selected = getSelected();
    if (!selected) return;

    const codeLabel = selected.codeSystem
      ? `Texas ${selected.codeSystem}`
      : 'Texas Penal Code';

    const text = [
      `${codeLabel} ${selected.code}`,
      selected.title,
      '',
      getStatuteFor(selected),
      '',
      `Plain English: ${selected.plainEnglish}`
    ].join('\n');

    await navigator.clipboard.writeText(text);
    ui.copyBtn.textContent = 'Copied';
    setTimeout(() => {
      ui.copyBtn.textContent = 'Copy';
    }, 900);
  });

  ui.favoriteBtn?.addEventListener('click', () => {
    const selected = getSelected();
    if (!selected) return;
    toggleFavorite(selected.code);
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    if (event.ctrlKey && key === 'k') {
      event.preventDefault();
      ui.searchInput?.focus();
      ui.searchInput?.select();
      return;
    }

    if ((event.ctrlKey && key === 'r') || event.key === 'F5') {
      event.preventDefault();
      window.location.reload();
    }
  });

  if (window.windowControls) {
    ui.minimizeBtn?.addEventListener('click', async () => {
      await window.windowControls.minimize();
    });

    ui.maximizeBtn?.addEventListener('click', async () => {
      const isMaximized = await window.windowControls.maximizeToggle();
      updateMaximizeButton(isMaximized);
    });

    ui.closeBtn?.addEventListener('click', async () => {
      await window.windowControls.close();
    });

    window.windowControls.isMaximized().then((isMaximized) => {
      updateMaximizeButton(isMaximized);
    });
  } else {
    document.querySelector('.window-bar')?.classList.add('hidden');
  }
}

function onSearchChange() {
  state.query = ui.searchInput?.value.trim() || '';
  updateResults();
}

function onFilterChange() {
  state.resultFilter = ui.resultFilter?.value || 'all';
  updateResults();
}

function updateResults() {
  const query = state.query;
  const baseResults = query
    ? rankMatches(state.dataset, query).slice(0, 80)
    : [...state.dataset];

  state.filtered = applyResultFilter(baseResults, query, state.resultFilter);
  renderResults(state.filtered);
  renderFavorites();

  if (state.filtered.length === 1) {
    selectCode(state.filtered[0].code);
  }
}

function applyResultFilter(items, query, filterType) {
  if (!filterType || filterType === 'all') {
    return items;
  }

  const q = (query || '').toLowerCase();

  if (filterType === 'code') {
    if (!q) return items;
    return items.filter((item) => String(item.code).toLowerCase().includes(q));
  }

  if (filterType === 'text') {
    if (!q) return items;
    return items.filter((item) => {
      const codeMatch = String(item.code).toLowerCase().includes(q);
      if (codeMatch) return false;

      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const summaryMatch = (item.plainEnglish || '').toLowerCase().includes(q);
      const keywordMatch = (item.keywords || []).some((k) =>
        String(k).toLowerCase().includes(q)
      );
      return titleMatch || summaryMatch || keywordMatch;
    });
  }

  return items;
}

function rankMatches(items, rawQuery) {
  const query = rawQuery.toLowerCase();
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const codeLike = /^\d{1,3}(\.\d{1,3})?$/;

  const ranked = [];

  for (const item of items) {
    let score = 0;
    const code = String(item.code || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const summary = (item.plainEnglish || '').toLowerCase();
    const keywords = (item.keywords || []).map((k) => String(k).toLowerCase());

    if (codeLike.test(query)) {
      if (code === query) score += 200;
      else if (code.startsWith(query)) score += 130;
      else if (code.includes(query)) score += 70;
    }

    if (title.includes(query)) score += 80;
    if (summary.includes(query)) score += 50;

    for (const token of queryTokens) {
      if (keywords.includes(token)) score += 35;
      if (keywords.some((k) => k.includes(token))) score += 20;
      if (summary.includes(token)) score += 8;
      if (title.includes(token)) score += 12;
    }

    if (score > 0) {
      ranked.push({ item, score });
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code));
  return ranked.map((r) => r.item);
}

function renderResults(results) {
  if (!ui.resultCount || !ui.resultsList) return;

  ui.resultCount.textContent = String(results.length);
  ui.resultsList.innerHTML = '';

  if (!results.length) {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.textContent = 'No matches found. Try different wording.';
    ui.resultsList.appendChild(li);
    return;
  }

  for (const result of results) {
    const li = document.createElement('li');
    li.className = 'result-item';
    if (result.code === state.selectedCode) {
      li.classList.add('active');
    }

    const head = document.createElement('div');
    head.className = 'result-item-head';

    const title = document.createElement('strong');
    title.textContent = `${result.code} - ${result.title}`;

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'result-fav-btn';
    const isFavorite = state.favoriteCodes.includes(String(result.code));
    if (isFavorite) {
      favBtn.classList.add('active');
    }
    favBtn.textContent = isFavorite ? 'Saved' : 'Save';
    favBtn.title = isFavorite ? 'Remove favorite' : 'Add favorite';
    favBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(result.code);
    });

    const summary = document.createElement('p');
    summary.textContent = result.plainEnglish;

    head.appendChild(title);
    head.appendChild(favBtn);
    li.appendChild(head);
    li.appendChild(summary);

    li.addEventListener('click', () => selectCode(result.code));
    ui.resultsList.appendChild(li);
  }
}

async function selectCode(code) {
  state.selectedCode = code;
  const item = getSelected();
  if (!item) return;

  renderResults(state.filtered);
  renderFavorites();
  ui.emptyState?.classList.add('hidden');
  ui.detailCard?.classList.remove('hidden');

  const codeLabel = item.codeSystem
    ? `Texas ${item.codeSystem} \u00A7${item.code}`
    : `Texas Penal Code \u00A7${item.code}`;

  if (ui.codeNumber) ui.codeNumber.textContent = codeLabel;
  if (ui.offenseTitle) ui.offenseTitle.textContent = item.title;
  if (ui.plainEnglish) ui.plainEnglish.textContent = item.plainEnglish;
  if (ui.sourceLink) ui.sourceLink.href = item.sourceUrl;
  updateFavoriteButton(item.code);

  const cached = state.cache[item.code];
  if (cached && cached.statuteText) {
    if (ui.statuteText) ui.statuteText.textContent = cached.statuteText;
    if (ui.cacheStatus) ui.cacheStatus.textContent = 'Loaded from local cache.';
    return;
  }

  if (ui.statuteText) ui.statuteText.textContent = item.statuteText;
  if (ui.cacheStatus) ui.cacheStatus.textContent = 'Fetching official source...';

  const remote = await appApi.fetchStatute(item.sourceUrl);
  if (remote.ok && remote.text) {
    const normalized = remote.text.slice(0, 1800);
    state.cache[item.code] = { statuteText: normalized, updatedAt: Date.now() };
    saveCache(state.cache);
    if (ui.statuteText) ui.statuteText.textContent = normalized;
    if (ui.cacheStatus) ui.cacheStatus.textContent = 'Official source cached for offline use.';
  } else if (ui.cacheStatus) {
    ui.cacheStatus.textContent = 'Using local statute excerpt (offline-ready).';
  }
}

function getSelected() {
  return state.dataset.find((item) => item.code === state.selectedCode);
}

function getStatuteFor(item) {
  return state.cache[item.code]?.statuteText || item.statuteText;
}

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

function updateMaximizeButton(isMaximized) {
  if (!ui.maximizeBtn) return;
  ui.maximizeBtn.textContent = String.fromCharCode(0x2610);
  ui.maximizeBtn.title = isMaximized ? 'Restore' : 'Maximize';
}

async function loadKeywordAliases() {
  try {
    const response = await fetch(KEYWORD_ALIAS_PATH);
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

function mergeAliasKeywords(items, aliases) {
  if (!aliases || typeof aliases !== 'object') return items;
  return items.map((item) => {
    const baseKeywords = Array.isArray(item.keywords) ? item.keywords : [];
    const extraKeywords = Array.isArray(aliases[item.code]) ? aliases[item.code] : [];
    if (!extraKeywords.length) return item;

    const merged = new Set();
    for (const k of baseKeywords) merged.add(String(k).toLowerCase());
    for (const k of extraKeywords) merged.add(String(k).toLowerCase());

    return { ...item, keywords: Array.from(merged) };
  });
}

function appendSupplementalEntries(items) {
  const list = Array.isArray(items) ? items : [];
  const existing = new Set(list.map((i) => String(i.code)));
  const extras = SUPPLEMENTAL_ENTRIES.filter((i) => !existing.has(String(i.code)));
  return [...list, ...extras];
}

function buildAppApi() {
  return {
    loadDataset: window.penalApi?.loadDataset || loadDatasetFallback,
    fetchStatute: window.penalApi?.fetchStatute || fetchStatuteFallback
  };
}

async function loadDatasetFallback() {
  const paths = ['data/texas_penal_codes.full.json', 'data/texas_penal_codes.sample.json'];
  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Keep trying fallback sources.
    }
  }
  throw new Error('Dataset could not be loaded in web mode.');
}

async function fetchStatuteFallback() {
  return { ok: false, error: 'Remote statute fetch is unavailable in web mode.' };
}


function loadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map((code) => String(code)) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favoriteCodes) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteCodes));
}

function toggleFavorite(code) {
  const normalized = String(code);
  const exists = state.favoriteCodes.includes(normalized);

  if (exists) {
    state.favoriteCodes = state.favoriteCodes.filter((c) => c !== normalized);
  } else {
    state.favoriteCodes = [normalized, ...state.favoriteCodes];
  }

  saveFavorites(state.favoriteCodes);
  renderResults(state.filtered);
  renderFavorites();
  updateFavoriteButton(normalized);
}

function renderFavorites() {
  if (!ui.favoritesList || !ui.favoritesEmpty || !ui.favoritesCount) return;

  ui.favoritesList.innerHTML = '';
  const favoriteItems = getFavoriteItems();
  ui.favoritesCount.textContent = String(favoriteItems.length);

  if (!favoriteItems.length) {
    ui.favoritesEmpty.classList.remove('hidden');
    return;
  }

  ui.favoritesEmpty.classList.add('hidden');

  for (const item of favoriteItems) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'favorite-chip';
    chip.textContent = `${item.code} - ${item.title}`;

    if (item.code === state.selectedCode) {
      chip.classList.add('active');
    }

    chip.addEventListener('click', () => {
      selectCode(item.code);
    });

    ui.favoritesList.appendChild(chip);
  }
}

function updateFavoriteButton(code) {
  if (!ui.favoriteBtn) return;
  const isFavorite = state.favoriteCodes.includes(String(code));
  ui.favoriteBtn.textContent = isFavorite ? 'Unfavorite' : 'Favorite';
  ui.favoriteBtn.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
}

function getFavoriteItems() {
  const byCode = new Map(state.dataset.map((item) => [String(item.code), item]));
  return state.favoriteCodes.map((code) => byCode.get(String(code))).filter(Boolean);
}









