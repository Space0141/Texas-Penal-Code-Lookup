(function () {
  const el = document.getElementById('status');
  if (!el) return;

  const refreshMs = window.PENAL_LOOKUP_CONFIG?.refreshMs || 100;
  setInterval(() => {
    const now = new Date().toLocaleTimeString();
    el.textContent = `Website running. Last update: ${now}`;
  }, refreshMs);
})();
