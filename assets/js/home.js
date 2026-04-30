document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("page-ready");
  enhanceGlobalUx();

  const heroSection = document.getElementById("heroSection");
  const trendingRail = document.getElementById("trendingRail");
  const animeGrid = document.getElementById("animeGrid");
  const searchInput = document.getElementById("searchInput");
  const searchStatus = document.getElementById("searchStatus");
  const featuredBtn = document.getElementById("headerFeaturedBtn");

  let library = [];

  try {
    library = await window.StreamUI.loadLibrary();
  } catch (error) {
    console.error("home load error:", error);
  }

  [heroSection, trendingRail, animeGrid].forEach((el) => el?.classList.remove("is-loading"));

  const featured = library[0] || null;

  if (!library.length) {
    heroSection.innerHTML = `<div class="empty-state">Library unavailable.</div>`;
    trendingRail.innerHTML = `<div class="empty-state">No episodes available.</div>`;
    animeGrid.innerHTML = `<div class="empty-state">No titles found.</div>`;
    return;
  }

  renderHero(featured);
  renderTrending(library);
  renderGrid(library);

  if (featuredBtn && featured) {
    featuredBtn.href = window.StreamUI.detailHref(featured);
  }

  searchInput?.addEventListener("input", () => {
    const term = searchInput.value.trim().toLowerCase();

    const filtered = library.filter((anime) => {
      const haystack = [
        anime.title,
        anime.description,
        anime.year,
        anime.episodes,
        ...(anime.genres || [])
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });

    renderGrid(filtered);

    if (searchStatus) {
      searchStatus.textContent = term
        ? `${filtered.length} kết quả cho “${searchInput.value.trim()}”.`
        : "Nhấn / để tìm nhanh.";
    }
  });

  function renderHero(anime) {
    if (!anime) return;

    const firstEpisode = window.StreamUI.getFirstEpisode(anime);
    const watchState = window.StreamStorage.getWatchState(anime.slug);
    const continueHref = watchState
      ? window.StreamUI.watchHref(anime, watchState.season, watchState.episode)
      : firstEpisode
        ? window.StreamUI.watchHref(anime, firstEpisode.season, firstEpisode.episode)
        : window.StreamUI.detailHref(anime);

    const totalSeasons = anime.seasons?.length || 0;
    const genres = (anime.genres || []).slice(0, 3);

    heroSection.innerHTML = `
      <article
        class="hero-card"
        style="background-image:
          linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.20)),
          url('${escapeAttr(anime.cover || anime.poster || "")}')"
      >
        <div class="hero-stats" aria-label="Featured stats">
          <div class="hero-stat">
            <small>Episodes</small>
            <strong>${escapeHtml(anime.episodes || window.StreamUI.flattenEpisodes(anime).length || "—")}</strong>
          </div>
          <div class="hero-stat">
            <small>Seasons</small>
            <strong>${totalSeasons || "—"}</strong>
          </div>
        </div>

        <div class="hero-content">
          <div class="hero-meta">
            ${anime.year ? `<span class="pill">${escapeHtml(anime.year)}</span>` : ""}
            ${genres.map((genre) => `<span class="pill">${escapeHtml(genre)}</span>`).join("")}
          </div>

          <h1 class="hero-title">${escapeHtml(anime.title)}</h1>
          <p class="hero-description">${escapeHtml(anime.description || "")}</p>

          <div class="hero-actions">
            <a class="btn btn-primary" href="${continueHref}">
              ${watchState ? "Tiếp tục xem" : "Xem ngay"}
            </a>
            <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">Chi tiết</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderTrending(items) {
    const trendingEpisodes = items
      .flatMap((anime) => window.StreamUI.flattenEpisodes(anime).map((ep) => ({ anime, ep })))
      .slice(0, 6);

    if (!trendingEpisodes.length) {
      trendingRail.innerHTML = `<div class="empty-state">No episodes available.</div>`;
      return;
    }

    trendingRail.innerHTML = trendingEpisodes
      .map(({ anime, ep }) => `
        <a
          class="rail-card"
          href="${window.StreamUI.watchHref(anime, ep.seasonNumber, ep.number)}"
          style="background-image:
            linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.86)),
            url('${escapeAttr(anime.cover || anime.poster || "")}')"
          aria-label="Watch ${escapeAttr(anime.title)} episode ${escapeAttr(ep.number)}"
        >
          <div class="rail-card-content">
            <span class="pill">${window.StreamUI.formatEpisodeLabel(ep.seasonNumber, ep.number)}</span>
            <h3>${escapeHtml(ep.title || anime.title)}</h3>
          </div>
        </a>
      `)
      .join("");
  }

  function renderGrid(items) {
    if (!items.length) {
      animeGrid.innerHTML = `<div class="empty-state">No titles matched your search.</div>`;
      return;
    }

    animeGrid.innerHTML = items
      .map((anime) => {
        const watchState = window.StreamStorage.getWatchState(anime.slug);
        const progress = watchState
          ? window.StreamStorage.getProgress(anime.slug, watchState.season, watchState.episode)
          : null;

        const firstEpisode = window.StreamUI.getFirstEpisode(anime);
        const continueHref = watchState
          ? window.StreamUI.watchHref(anime, watchState.season, watchState.episode)
          : firstEpisode
            ? window.StreamUI.watchHref(anime, firstEpisode.season, firstEpisode.episode)
            : window.StreamUI.detailHref(anime);

        const genres = (anime.genres || []).slice(0, 3);

        return `
          <article class="anime-card">
            <a class="poster-frame" href="${window.StreamUI.detailHref(anime)}" aria-label="${escapeAttr(anime.title)} details">
              <img src="${escapeAttr(anime.poster || anime.cover || "")}" alt="${escapeAttr(anime.title)} poster" loading="lazy" decoding="async" />
            </a>

            <div class="card-topline">
              <span>${escapeHtml(anime.year || "")}</span>
              <span>${escapeHtml(anime.episodes || window.StreamUI.flattenEpisodes(anime).length || 0)} tập</span>
            </div>

            <h3 class="card-title">${escapeHtml(anime.title)}</h3>
            <p class="card-description">${escapeHtml(anime.description || "")}</p>

            <div class="pill-row">
              ${genres.map((genre) => `<span class="pill">${escapeHtml(genre)}</span>`).join("")}
            </div>

            ${
              progress
                ? `
                  <div>
                    <div class="watch-stamp">Đang xem · ${progress.percent || 0}%</div>
                    <div class="progress-bar" style="margin-top:10px;">
                      <span style="width:${progress.percent || 0}%"></span>
                    </div>
                  </div>
                `
                : ""
            }

            <div class="card-actions">
              <a class="btn btn-primary" href="${continueHref}">
                ${watchState ? "Tiếp tục" : "Xem"}
              </a>
              <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">Chi tiết</a>
            </div>
          </article>
        `;
      })
      .join("");
  }
});

function enhanceGlobalUx() {
  const header = document.querySelector(".site-header");
  const setHeaderState = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }

      if (event.key === "Escape" && document.activeElement === searchInput) {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.blur();
      }
    });
  }

  createBackToTop();
}

function createBackToTop() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const button = document.createElement("button");
  button.className = "back-to-top";
  button.type = "button";
  button.setAttribute("aria-label", "Back to top");
  button.textContent = "↑";
  document.body.appendChild(button);

  const toggle = () => button.classList.toggle("is-visible", window.scrollY > 520);
  toggle();

  window.addEventListener("scroll", toggle, { passive: true });
  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });
}

function escapeHtml(value = "") {
  return window.StreamUI?.escapeHtml
    ? window.StreamUI.escapeHtml(value)
    : String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
