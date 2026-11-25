const headerEl = document.getElementById('site-header');
const RELEASE_CACHE_TTL_MS = 15 * 60 * 1000;

function updateHeaderScroll() {
  if (!headerEl) return;
  headerEl.classList.toggle('is-scrolled', window.scrollY > 18);
}

function readCachedTag(repo) {
  try {
    const raw = sessionStorage.getItem(`xseek:release:${repo}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.tag !== 'string' || Date.now() - parsed.ts > RELEASE_CACHE_TTL_MS) {
      return null;
    }
    return parsed.tag;
  } catch {
    return null;
  }
}

function writeCachedTag(repo, tag) {
  try {
    sessionStorage.setItem(`xseek:release:${repo}`, JSON.stringify({ tag, ts: Date.now() }));
  } catch {
    // Ignore storage quota or private-mode failures.
  }
}

async function fetchLatestTag(repo) {
  const cached = readCachedTag(repo);
  if (cached) return cached;

  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) return null;

  const data = await response.json();
  const tag = typeof data?.tag_name === 'string' ? data.tag_name.trim() : '';
  if (!tag) return null;

  writeCachedTag(repo, tag);
  return tag;
}

async function hydrateGitHubReleases() {
  const nodes = Array.from(document.querySelectorAll('[data-github-release]'));
  if (!nodes.length) return;

  const byRepo = new Map();
  for (const el of nodes) {
    const repo = el.dataset.githubRelease;
    if (!repo) continue;
    if (!byRepo.has(repo)) byRepo.set(repo, []);
    byRepo.get(repo).push(el);
  }

  await Promise.all(
    Array.from(byRepo.entries()).map(async ([repo, targets]) => {
      try {
        const tag = await fetchLatestTag(repo);
        if (!tag) return;
        for (const el of targets) {
          el.textContent = tag;
        }
      } catch {
        // Keep static fallback version on network or rate-limit errors.
      }
    }),
  );
}

window.addEventListener('scroll', updateHeaderScroll, { passive: true });
updateHeaderScroll();
hydrateGitHubReleases();
