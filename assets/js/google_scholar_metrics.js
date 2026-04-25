(function () {
  const metricNodes = Array.from(document.querySelectorAll('[data-gs-metric]'));
  if (metricNodes.length === 0) return;

  const userId =
    metricNodes.find((node) => node.dataset.gsUser)?.dataset.gsUser ||
    'iDZcqAIAAAAJ';

  const defaults = {};
  metricNodes.forEach((node) => {
    defaults[node.dataset.gsMetric] = node.textContent.trim();
  });

  const cacheKey = `googleScholarMetrics:${userId}`;
  const cacheMaxAgeMs = 12 * 60 * 60 * 1000;

  function parseIntSafe(value) {
    const normalized = String(value || '').replace(/[^\d]/g, '');
    if (!normalized) return null;
    return Number.parseInt(normalized, 10);
  }

  function parseHtmlMetrics(text) {
    const pick = (label) => {
      const pattern = new RegExp(
        `${label}[\\s\\S]*?<td[^>]*class="gsc_rsb_std"[^>]*>([\\d,]+)<\\/td>`,
        'i'
      );
      const match = text.match(pattern);
      return match ? parseIntSafe(match[1]) : null;
    };

    return {
      citations: pick('Citations'),
      h_index: pick('h-index'),
      h10_index: pick('i10-index'),
    };
  }

  function parseMarkdownMetrics(text) {
    const pick = (label) => {
      const pattern = new RegExp(`${label}\\s*\\|\\s*([\\d,]+)`, 'i');
      const match = text.match(pattern);
      return match ? parseIntSafe(match[1]) : null;
    };

    return {
      citations: pick('Citations'),
      h_index: pick('h-index'),
      h10_index: pick('i10-index'),
    };
  }

  function mergeMetrics(primary, secondary) {
    return {
      citations: primary.citations ?? secondary.citations ?? null,
      h_index: primary.h_index ?? secondary.h_index ?? null,
      h10_index: primary.h10_index ?? secondary.h10_index ?? null,
    };
  }

  function hasAnyMetric(metrics) {
    return (
      Number.isFinite(metrics.citations) ||
      Number.isFinite(metrics.h_index) ||
      Number.isFinite(metrics.h10_index)
    );
  }

  function updateDom(metrics) {
    metricNodes.forEach((node) => {
      const key = node.dataset.gsMetric;
      const value = metrics[key];
      if (Number.isFinite(value)) {
        node.textContent = value.toLocaleString();
      } else if (defaults[key]) {
        node.textContent = defaults[key];
      }
    });
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.metrics || !data.timestamp) return null;
      if (Date.now() - data.timestamp > cacheMaxAgeMs) return null;
      return data.metrics;
    } catch (error) {
      return null;
    }
  }

  function writeCache(metrics) {
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ metrics, timestamp: Date.now() })
      );
    } catch (error) {
      // ignore localStorage write failures
    }
  }

  async function fetchWithTimeout(url, timeoutMs = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchFromScholarMirrors() {
    const scholarUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(
      userId
    )}&hl=en`;

    const mirrorUrls = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(scholarUrl)}`,
      `https://r.jina.ai/http://${scholarUrl.replace(/^https?:\/\//, '')}`,
      `https://r.jina.ai/http://scholar.googleusercontent.com/citations?user=${encodeURIComponent(
        userId
      )}&hl=en`,
    ];

    for (const url of mirrorUrls) {
      try {
        const body = await fetchWithTimeout(url);
        const htmlMetrics = parseHtmlMetrics(body);
        const mdMetrics = parseMarkdownMetrics(body);
        const merged = mergeMetrics(htmlMetrics, mdMetrics);
        if (hasAnyMetric(merged)) return merged;
      } catch (error) {
        // try next source
      }
    }

    return null;
  }

  (async function init() {
    const cached = readCache();
    if (cached) updateDom(cached);

    const live = await fetchFromScholarMirrors();
    if (!live || !hasAnyMetric(live)) return;

    const finalMetrics = {
      citations: live.citations,
      h_index: live.h_index,
      h10_index: live.h10_index,
    };

    writeCache(finalMetrics);
    updateDom(finalMetrics);
  })();
})();
