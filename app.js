const state = {
  dataset: [],
  filtered: [],
  selectedCode: null,
  query: '',
  resultFilter: 'all'
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
  copyBtn: document.getElementById('copyBtn'),
  minimizeBtn: document.getElementById('minimizeBtn'),
  maximizeBtn: document.getElementById('maximizeBtn'),
  closeBtn: document.getElementById('closeBtn')
};

const SUPPLEMENTAL_ENTRIES = [
  {
    code: '545.351',
    codeSystem: 'Transportation Code',
    title: 'Maximum Speed Requirement',
    statuteText: 'An operator may not drive at a speed greater than is reasonable and prudent under the circumstances then existing.',
    plainEnglish: 'Driving faster than is safe for conditions can be cited as speeding, even if no specific posted limit is exceeded.',
    keywords: ['speeding', 'too fast', 'unsafe speed', 'excessive speed', 'speed violation', 'driving too fast'],
    sourceUrl: 'https://statutes.capitol.texas.gov/Docs/TN/htm/TN.545.htm#545.351'
  },
  {
    code: '545.352',
    codeSystem: 'Transportation Code',
    title: 'Prima Facie Speed Limits',
    statuteText: 'Defines posted and default speed limits and when exceeding those limits is prima facie evidence of unreasonable speed.',
    plainEnglish: 'Covers posted speed limits and default limits by roadway type.',
    keywords: ['speed limit', 'over posted speed', 'school zone speed', 'construction zone speed', '55 in 35'],
    sourceUrl: 'https://statutes.capitol.texas.gov/Docs/TN/htm/TN.545.htm#545.352'
  },
  {
    code: '545.401',
    codeSystem: 'Transportation Code',
    title: 'Reckless Driving',
    statuteText: 'A person commits an offense if the person drives a vehicle in willful or wanton disregard for the safety of persons or property.',
    plainEnglish: 'Dangerous driving behavior may be charged as reckless driving.',
    keywords: ['reckless driving', 'dangerous driving', 'high speed chase', 'aggressive driving'],
    sourceUrl: 'https://statutes.capitol.texas.gov/Docs/TN/htm/TN.545.htm#545.401'
  }
];

init();

async function init() {
  bindEvents();

  const [dataset, aliases] = await Promise.all([
    fetchJson('./data/texas_penal_codes.full.json', []),
    fetchJson('./data/keyword_aliases.json', {})
  ]);

  state.dataset = mergeAliasKeywords(appendSupplementalEntries(dataset), aliases);
  state.filtered = [...state.dataset];
  renderResults(state.filtered);
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

    const codeLabel = selected.codeSystem ? `Texas ${selected.codeSystem}` : 'Texas Penal Code';
    const text = [
      `${codeLabel} ${selected.code}`,
      selected.title,
      '',
      selected.statuteText,
      '',
      `Plain English: ${selected.plainEnglish}`
    ].join('\n');

    await navigator.clipboard.writeText(text);
    ui.copyBtn.textContent = 'Copied';
    setTimeout(() => {
      ui.copyBtn.textContent = 'Copy';
    }, 900);
  });

  [ui.minimizeBtn, ui.maximizeBtn, ui.closeBtn].forEach((btn) => {
    btn?.addEventListener('click', (event) => event.preventDefault());
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    if (event.ctrlKey && key === 'k') {
      event.preventDefault();
      ui.searchInput?.focus();
      ui.searchInput?.select();
    }
  });
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
  const baseResults = query ? rankMatches(state.dataset, query).slice(0, 80) : [...state.dataset];
  state.filtered = applyResultFilter(baseResults, query, state.resultFilter);
  renderResults(state.filtered);

  if (state.filtered.length === 1) {
    selectCode(state.filtered[0].code);
  }
}

function applyResultFilter(items, query, filterType) {
  if (!filterType || filterType === 'all') return items;

  const q = (query || '').toLowerCase();
  if (filterType === 'code') {
    if (!q) return items;
    return items.filter((item) => String(item.code).toLowerCase().includes(q));
  }

  if (filterType === 'text') {
    if (!q) return items;
    return items.filter((item) => {
      if (String(item.code).toLowerCase().includes(q)) return false;
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const summaryMatch = (item.plainEnglish || '').toLowerCase().includes(q);
      const keywordMatch = (item.keywords || []).some((k) => String(k).toLowerCase().includes(q));
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

    if (score > 0) ranked.push({ item, score });
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
    if (result.code === state.selectedCode) li.classList.add('active');

    li.innerHTML = `<strong>${result.code} - ${result.title}</strong><p>${result.plainEnglish}</p>`;
    li.addEventListener('click', () => selectCode(result.code));
    ui.resultsList.appendChild(li);
  }
}

function selectCode(code) {
  state.selectedCode = code;
  const item = getSelected();
  if (!item) return;

  renderResults(state.filtered);
  ui.emptyState?.classList.add('hidden');
  ui.detailCard?.classList.remove('hidden');

  const codeLabel = item.codeSystem
    ? `Texas ${item.codeSystem} \u00A7${item.code}`
    : `Texas Penal Code \u00A7${item.code}`;

  ui.codeNumber.textContent = codeLabel;
  ui.offenseTitle.textContent = item.title;
  ui.statuteText.textContent = item.statuteText;
  ui.plainEnglish.textContent = item.plainEnglish;
  ui.sourceLink.href = item.sourceUrl;
}

function getSelected() {
  return state.dataset.find((item) => item.code === state.selectedCode);
}

function appendSupplementalEntries(items) {
  const list = Array.isArray(items) ? items : [];
  const existing = new Set(list.map((i) => String(i.code)));
  const extras = SUPPLEMENTAL_ENTRIES.filter((i) => !existing.has(String(i.code)));
  return [...list, ...extras];
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

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}