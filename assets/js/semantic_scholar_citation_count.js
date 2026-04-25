const citationCountElements = document.querySelectorAll('[data-semantic-scholar-id]');
const semanticScholarIds = new Set();

citationCountElements.forEach((element) => {
    const raw = (element.getAttribute('data-semantic-scholar-id') || '').trim();
    if (!raw || raw.toUpperCase() === 'N/A') {
        element.innerHTML = '<span class="badge badge-pill badge-publication badge-secondary"><i class="ai ai-semantic-scholar"></i> 引用量未获取 (Citations unavailable)</span>';
        return;
    }
    element.setAttribute('data-semantic-scholar-id', raw);
    semanticScholarIds.add(raw);
});

let uncachedSemanticScholarIds = [];
semanticScholarIds.forEach((id) => {
    const cacheKey = `semanticScholarCitationCount:${id}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        const { timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp > 1 * 60 * 60 * 1000) {
            uncachedSemanticScholarIds.push(id);
        }
    } else {
        uncachedSemanticScholarIds.push(id);
    }
});

let showSemanticScholarCitationCount = () => {
    const buildHref = (id) => {
        const lower = id.toLowerCase();
        if (lower.startsWith('doi:')) {
            return `https://doi.org/${id.slice(4)}`;
        }
        if (lower.startsWith('arxiv:')) {
            return `https://arxiv.org/abs/${id.slice(6)}`;
        }
        return `https://www.semanticscholar.org/paper/${id}`;
    };

    semanticScholarIds.forEach((id) => {
        const cacheKey = `semanticScholarCitationCount:${id}`;
        const cachedData = localStorage.getItem(cacheKey);
        if (!cachedData) return;

        const { citationCount } = JSON.parse(cachedData);
        const elements = document.querySelectorAll(`[data-semantic-scholar-id="${id}"]`);
        elements.forEach((element) => {
            const href = buildHref(id);
            element.innerHTML = `<a class="badge badge-pill badge-publication badge-info" href="${href}" target="_blank"><i class="ai ai-semantic-scholar"></i> ${parseInt(citationCount, 10).toLocaleString()} citations</a>`;
        });
    });
};

if (uncachedSemanticScholarIds.length > 0) {
    const idList = Array.from(semanticScholarIds);
    fetch('https://api.semanticscholar.org/graph/v1/paper/batch?fields=citationCount,paperId', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ids: idList
        })
    })
        .then((response) => response.json())
        .then((data) => {
            data.forEach((paper, index) => {
                const requestedId = idList[index];
                if (!paper || paper.citationCount === undefined || paper.citationCount === null) return;

                const cacheData = {
                    citationCount: paper.citationCount,
                    timestamp: Date.now()
                };

                localStorage.setItem(
                    `semanticScholarCitationCount:${requestedId}`,
                    JSON.stringify(cacheData)
                );

                if (paper.paperId && paper.paperId !== requestedId) {
                    localStorage.setItem(
                        `semanticScholarCitationCount:${paper.paperId}`,
                        JSON.stringify(cacheData)
                    );
                }
            });
        })
        .catch((error) => {
            console.error('Error fetching Semantic Scholar data:', error);
        })
        .finally(showSemanticScholarCitationCount);
} else {
    showSemanticScholarCitationCount();
}
