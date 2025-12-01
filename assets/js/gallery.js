const PLOTS_PER_PAGE = 12;
const DEFAULT_MANIFEST_PATH = 'assets/data/gallery-data.json';
const currentScriptTag = document.currentScript;
const scriptDefinedManifest = currentScriptTag?.dataset?.manifest;

function encodePathSegment(segment = '') {
  return segment
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}

function buildAssetPath(...segments) {
  return segments
    .filter(Boolean)
    .map(encodePathSegment)
    .join('/');
}

function formatSourceLabel(data = {}) {
  if (data.sourceLabel) {
    return data.sourceLabel;
  }
  if (!data.sourceDir) {
    return '';
  }
  const normalized = data.sourceDir.replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')) {
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join('/');
    }
  }
  return data.sourceDir;
}

function resolveManifestPath() {
  if (scriptDefinedManifest) {
    return scriptDefinedManifest;
  }

  if (typeof window !== 'undefined' && window.GALLERY_DATA_PATH) {
    return window.GALLERY_DATA_PATH;
  }

  if (typeof window !== 'undefined') {
    const params = new URL(window.location.href).searchParams;
    const manifestParam = params.get('data');
    if (manifestParam) {
      return manifestParam.endsWith('.json')
        ? manifestParam
        : `assets/data/${manifestParam}.json`;
    }
  }

  return DEFAULT_MANIFEST_PATH;
}

const manifestPath = resolveManifestPath();

let galleryData;
let currentCategory = null;
let currentPage = 0;

const galleryContainer = document.getElementById('gallery-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const paginationInfo = document.getElementById('pagination-info');
const categoryNav = document.getElementById('category-nav');
const categoryMeta = document.getElementById('category-meta');
const galleryMessage = document.getElementById('gallery-message');
const sourcePath = document.getElementById('gallery-source');

function setMessage(message, isError = false) {
  if (!galleryMessage) return;
  if (!message) {
    galleryMessage.classList.remove('is-visible', 'is-error');
    galleryMessage.textContent = '';
    return;
  }
  galleryMessage.textContent = message;
  galleryMessage.classList.add('is-visible');
  galleryMessage.classList.toggle('is-error', Boolean(isError));
}

async function fetchGalleryData() {
  const response = await fetch(manifestPath, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load gallery data (${response.status})`);
  }
  const data = await response.json();
  if (!data.categories || data.categories.length === 0) {
    throw new Error('No categories found in gallery data');
  }
  return data;
}

function getSlugFromLocation() {
  const params = new URL(window.location.href).searchParams;
  return params.get('category');
}

function getInitialCategorySlug() {
  const slugFromUrl = getSlugFromLocation();
  if (slugFromUrl && galleryData.categories.some(cat => cat.slug === slugFromUrl)) {
    return slugFromUrl;
  }
  return galleryData.categories[0].slug;
}

function buildCategoryNav() {
  if (!categoryNav) return;
  categoryNav.innerHTML = '';

  galleryData.categories.forEach(category => {
    const pill = document.createElement('a');
    pill.href = `?category=${encodeURIComponent(category.slug)}`;
    pill.className = 'category-pill';
    pill.dataset.slug = category.slug;
    pill.innerHTML = `
      <span class="pill-label">${category.name}</span>
      <span class="pill-count">${category.items.length}</span>
    `;
    pill.addEventListener('click', event => {
      event.preventDefault();
      if (category.slug !== currentCategory?.slug) {
        setCategory(category.slug);
      }
    });
    categoryNav.appendChild(pill);
  });
}

function setCategory(slug, { skipUrlUpdate = false } = {}) {
  const category =
    galleryData.categories.find(cat => cat.slug === slug) || galleryData.categories[0];

  if (!category) return;

  currentCategory = category;
  currentPage = 0;

  highlightActiveCategory(category.slug);
  updateCategoryMeta();
  renderGallery();
  updatePaginationControls();

  if (!skipUrlUpdate) {
    updateUrl(category.slug);
  }
}

function highlightActiveCategory(slug) {
  if (!categoryNav) return;
  const pills = categoryNav.querySelectorAll('.category-pill');
  pills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.slug === slug);
  });
}

function updateCategoryMeta() {
  if (!categoryMeta || !currentCategory) return;
  categoryMeta.textContent = `${currentCategory.items.length} plots • ${currentCategory.path}`;
}

function renderGallery() {
  if (!galleryContainer) return;
  galleryContainer.innerHTML = '';

  if (!currentCategory || !currentCategory.items.length) {
    setMessage('このカテゴリには表示できるプロットがありません。', false);
    return;
  }

  setMessage('');
  const startIndex = currentPage * PLOTS_PER_PAGE;
  const endIndex = Math.min(startIndex + PLOTS_PER_PAGE, currentCategory.items.length);
  const itemsToShow = currentCategory.items.slice(startIndex, endIndex);

  itemsToShow.forEach(item => {
    const card = createGalleryItem(item, currentCategory);
    galleryContainer.appendChild(card);
  });
}

function createGalleryItem(item, category) {
  const itemEl = document.createElement('div');
  itemEl.className = 'gallery-item';

  const title = document.createElement('h3');
  title.className = 'gallery-item-title';
  title.textContent = item.title;

  const content = document.createElement('div');
  content.className = 'gallery-item-content';

  const src = getItemSrc(item);

  if (item.type === 'html') {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = item.title;
    iframe.loading = 'lazy';
    content.appendChild(iframe);
  } else {
    const img = document.createElement('img');
    img.src = src;
    img.alt = item.title;
    img.loading = 'lazy';
    img.style.width = '100%';
    img.style.height = 'auto';
    content.appendChild(img);
  }

  itemEl.appendChild(title);
  itemEl.appendChild(content);

  const tagSegments = getTagSegments(item, category);
  if (tagSegments.length) {
    const tagsWrapper = document.createElement('div');
    tagsWrapper.className = 'gallery-item-tags';
    tagSegments.forEach((label, index) => {
      const tag = document.createElement('span');
      const tier = Math.min(index + 1, 3);
      tag.className = `gallery-item-tag tag-level-${tier}`;
      tag.textContent = label;
      tagsWrapper.appendChild(tag);
    });
    itemEl.appendChild(tagsWrapper);
  }

  return itemEl;
}

function splitPathSegments(value = '') {
  if (!value) return [];
  return value
    .replace(/\\/g, '/')
    .split('/')
    .flatMap(segment => segment.split(':'))
    .map(part => {
      try {
        return decodeURIComponent(part.trim());
      } catch (error) {
        return part.trim();
      }
    })
    .filter(Boolean);
}

function cleanSegments(list = []) {
  return list
    .map(segment => {
      if (segment === null || segment === undefined) return '';
      return String(segment).trim();
    })
    .filter(Boolean);
}

function coerceToSegments(value) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return cleanSegments(value);
  }

  return cleanSegments(
    String(value)
      .split(/\/|•|\|/g)
      .map(part => part.replace(/^[\s-]+/, ''))
  );
}

function buildPathTagSegments(category, item) {
  const categorySegments = splitPathSegments(category?.path);
  const itemSegments = splitPathSegments(item?.file);

  if (itemSegments.length) {
    const last = itemSegments[itemSegments.length - 1];
    if (/\.[A-Za-z0-9]+$/.test(last)) {
      itemSegments.pop();
    }
  }

  const combined = [...categorySegments, ...itemSegments].filter(Boolean);
  if (!combined.length) {
    return [];
  }

  return cleanSegments(combined.slice(-3));
}

function collectMetaSegments(item, category) {
  const dataset = item.meta?.dataset || category?.meta?.dataset;
  const embedding = item.meta?.embeddingModel || category?.meta?.embeddingModel;
  const cebra = item.meta?.cebra || category?.meta?.cebra;
  const notes = item.meta?.notes || category?.meta?.notes;

  const segments = [];
  if (dataset) segments.push(dataset);
  if (embedding) segments.push(embedding);
  if (cebra) segments.push(cebra);
  else if (notes) segments.push(notes);

  return cleanSegments(segments);
}

function getTagSegments(item, category) {
  const configuredSources = [
    item.tags,
    item.meta?.tags,
    category?.tags,
    category?.meta?.tags,
  ];

  for (const source of configuredSources) {
    const segments = coerceToSegments(source);
    if (segments.length) {
      return segments.slice(0, 3);
    }
  }

  const legacySources = [
    item.tag,
    item.meta?.tag,
    category?.tag,
    category?.meta?.tag,
  ];

  for (const source of legacySources) {
    const segments = coerceToSegments(source);
    if (segments.length) {
      return segments.slice(0, 3);
    }
  }

  const metaSegments = collectMetaSegments(item, category);
  if (metaSegments.length) {
    return metaSegments.slice(0, 3);
  }

  const pathSegments = buildPathTagSegments(category, item);
  if (pathSegments.length) {
    return pathSegments;
  }

  if (item.type === 'html') return ['HTML'];
  const parts = item.filename.split('.');
  const ext = parts.length > 1 ? parts.pop() : item.type;
  return ext ? [String(ext).toUpperCase()] : [];
}

function getItemSrc(item) {
  return buildAssetPath(galleryData.baseUrl, currentCategory?.path, item.file);
}

function getTotalPages() {
  if (!currentCategory) return 0;
  return Math.ceil(currentCategory.items.length / PLOTS_PER_PAGE);
}

function updatePaginationControls() {
  if (!prevBtn || !nextBtn || !paginationInfo) return;

  if (!currentCategory) {
    paginationInfo.textContent = '0 / 0';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const totalPages = getTotalPages();

  if (currentCategory.items.length === 0) {
    paginationInfo.textContent = '0 / 0';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const startIndex = currentPage * PLOTS_PER_PAGE + 1;
  const endIndex = Math.min((currentPage + 1) * PLOTS_PER_PAGE, currentCategory.items.length);
  paginationInfo.textContent = `${startIndex}-${endIndex} / ${currentCategory.items.length}`;

  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage >= totalPages - 1;
}

function scrollToGalleryTop() {
  if (!galleryContainer) return;
  galleryContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function attachEventListeners() {
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage -= 1;
        renderGallery();
        updatePaginationControls();
        scrollToGalleryTop();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = getTotalPages();
      if (currentPage < totalPages - 1) {
        currentPage += 1;
        renderGallery();
        updatePaginationControls();
        scrollToGalleryTop();
      }
    });
  }

  window.addEventListener('popstate', event => {
    const slug = event.state?.category || getSlugFromLocation();
    if (slug && slug !== currentCategory?.slug) {
      setCategory(slug, { skipUrlUpdate: true });
    }
  });
}

function updateUrl(slug, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set('category', slug);
  if (replace) {
    history.replaceState({ category: slug }, '', url);
  } else {
    history.pushState({ category: slug }, '', url);
  }
}

async function initGallery() {
  try {
    setMessage('Loading plots...');
    galleryData = await fetchGalleryData();
    if (sourcePath) {
      const sourceLabel = formatSourceLabel(galleryData);
      if (sourceLabel) {
        sourcePath.textContent = `Source: ${sourceLabel}`;
        sourcePath.style.display = 'block';
      } else {
        sourcePath.textContent = '';
        sourcePath.style.display = 'none';
      }
    }
    buildCategoryNav();
    const initialSlug = getInitialCategorySlug();
    setCategory(initialSlug, { skipUrlUpdate: true });
    updateUrl(initialSlug, true);
    attachEventListeners();
    setMessage('');
  } catch (error) {
    console.error(error);
    setMessage('ギャラリーデータの読み込みに失敗しました。`scripts/build-gallery-data.js` を再実行してください。', true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGallery);
} else {
  initGallery();
}
