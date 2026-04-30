document.addEventListener("DOMContentLoaded", async () => {
  const heroSection = document.getElementById("heroSection");
  const trendingRail = document.getElementById("trendingRail");
  const animeGrid = document.getElementById("animeGrid");
  const searchInput = document.getElementById("searchInput");
  const featuredButton = document.getElementById("headerFeaturedBtn");

  if (!heroSection || !trendingRail || !animeGrid) return;

  let library = [];

  try {
    library = await window.StreamUI.loadLibrary();
  } catch (error) {
    console.error("load library error:", error);
    renderUnavailable();
    return;
  }

  const featured = library[0] || null;

  if (!library.length) {
    renderUnavailable();
    return;
  }

  renderHero(featured);
  renderTrending(library);
  renderGrid(library);
  bindSearch(library);

  function escapeHtml(value = "") {
    if (window.StreamUI?.escapeHtml) return window.StreamUI.escapeHtml(value);
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(value = "") {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getEpisodeTotal(anime) {
    if (anime?.episodes) return anime.episodes;
    return (anime?.seasons || []).reduce((total, season) => total + (season.episodes || []).length, 0);
  }

  function getSeasonTotal(anime) {
    return anime?.seasons?.length || 0;
  }

  function getImage(anime, type = "cover") {
    if (!anime) return "";
    return type === "poster"
      ? anime.poster || anime.cover || ""
      : anime.cover || anime.poster || "";
  }

  function getContinueHref(anime) {
    const firstEpisode = window.StreamUI.getFirstEpisode(anime);
    const watchState = window.StreamStorage.getWatchState(anime.slug);

    return watchState
      ? window.StreamUI.watchHref(anime, watchState.season, watchState.episode)
      : firstEpisode
        ? window.StreamUI.watchHref(anime, firstEpisode.season, firstEpisode.episode)
        : window.StreamUI.detailHref(anime);
  }

  function renderUnavailable() {
    heroSection.innerHTML = `<div class="empty-state">Library unavailable.</div>`;
    trendingRail.innerHTML = `<div class="empty-state">No episodes available.</div>`;
    animeGrid.innerHTML = `<div class="empty-state">No titles found.</div>`;
  }

  function renderHero(anime) {
    if (!anime) return;

    const watchState = window.StreamStorage.getWatchState(anime.slug);
    const continueHref = getContinueHref(anime);
    const cover = getImage(anime, "cover");
    const poster = getImage(anime, "poster");
    const genres = anime.genres || [];
    const episodeTotal = getEpisodeTotal(anime);
    const seasonTotal = getSeasonTotal(anime);

    if (featuredButton) {
      featuredButton.href = continueHref;
      featuredButton.textContent = watchState ? "Continue" : "Featured";
    }

    heroSection.innerHTML = `
      <article class="hero-card">
        <div class="hero-bg" aria-hidden="true">
          <img src="${escapeHtml(cover)}" alt="" />
        </div>

        <div class="hero-content">
          <div class="hero-kicker">
            <span class="hero-dot" aria-hidden="true"></span>
            Featured anime
          </div>

          <h1 class="hero-title">${escapeHtml(anime.title)}</h1>

          <p class="hero-description">${escapeHtml(anime.description || "")}</p>

          <div class="hero-meta">
            ${anime.year ? `<span>${escapeHtml(anime.year)}</span>` : ""}
            ${episodeTotal ? `<span>${episodeTotal} tập</span>` : ""}
            ${genres.slice(0, 3).map((genre) => `<span>${escapeHtml(genre)}</span>`).join("")}
          </div>

          <div class="hero-actions">
            <a class="btn btn-primary" href="${continueHref}">
              ${watchState ? "Tiếp tục xem" : "Xem ngay"}
            </a>
            <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">Chi tiết</a>
          </div>
        </div>

        <aside class="hero-side" aria-label="Featured image and stats">
          <figure class="hero-media">
            <img src="${escapeHtml(cover || poster)}" alt="${escapeHtml(anime.title)} cover" />
          </figure>

          <div class="hero-stat-grid">
            <div class="hero-stat">
              <small>Episodes</small>
              <strong>${episodeTotal || "—"}</strong>
            </div>
            <div class="hero-stat">
              <small>Seasons</small>
              <strong>${seasonTotal || "—"}</strong>
            </div>
          </div>
        </aside>
      </article>
    `;
  }

  function renderTrending(items) {
    const trendingEpisodes = items
      .flatMap((anime) =>
        window.StreamUI.flattenEpisodes(anime).map((ep) => ({
          anime,
          ep
        }))
      )
      .slice(0, 8);

    if (!trendingEpisodes.length) {
      trendingRail.innerHTML = `<div class="empty-state">No episodes available.</div>`;
      return;
    }

    trendingRail.innerHTML = trendingEpisodes
      .map(({ anime, ep }) => {
        const cover = getImage(anime, "cover");
        const label = window.StreamUI.formatEpisodeLabel
          ? window.StreamUI.formatEpisodeLabel(ep.seasonNumber, ep.number)
          : `S${ep.seasonNumber} · E${ep.number}`;

        return `
          <a
            class="rail-card"
            href="${window.StreamUI.watchHref(anime, ep.seasonNumber, ep.number)}"
            aria-label="Watch ${escapeHtml(anime.title)} ${escapeHtml(label)}"
          >
            <img class="rail-cover" src="${escapeHtml(cover)}" alt="" loading="lazy" />

            <div class="rail-card-content">
              <span class="rail-label">${escapeHtml(label)}</span>
              <h3>${escapeHtml(ep.title || anime.title)}</h3>
              <p>${escapeHtml(anime.title)}</p>
            </div>
          </a>
        `;
      })
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

        const continueHref = watchState
          ? window.StreamUI.watchHref(anime, watchState.season, watchState.episode)
          : window.StreamUI.detailHref(anime);

        const poster = getImage(anime, "poster");
        const episodeTotal = getEpisodeTotal(anime);

        return `
          <article class="anime-card">
            <a class="poster-frame" href="${window.StreamUI.detailHref(anime)}" aria-label="${escapeHtml(anime.title)} details">
              <img src="${escapeHtml(poster)}" alt="${escapeHtml(anime.title)} poster" loading="lazy" />
              ${progress ? `<span class="poster-badge">${progress.percent || 0}%</span>` : ""}
            </a>

            <div class="card-body">
              <div class="card-topline">
                <span>${escapeHtml(anime.year || "")}</span>
                <span>${episodeTotal || 0} tập</span>
              </div>

              <h3 class="card-title">${escapeHtml(anime.title)}</h3>
              <p class="card-description">${escapeHtml(anime.description || "")}</p>

              <div class="pill-row card-genres">
                ${(anime.genres || [])
                  .slice(0, 3)
                  .map((genre) => `<span class="pill">${escapeHtml(genre)}</span>`)
                  .join("")}
              </div>

              ${
                progress
                  ? `
                    <div class="resume-block">
                      <div class="watch-stamp">Resume · ${progress.percent || 0}% watched</div>
                      <div class="progress-bar">
                        <span style="width:${progress.percent || 0}%"></span>
                      </div>
                    </div>
                  `
                  : ""
              }

              <div class="card-actions">
                <a class="btn btn-primary" href="${continueHref}">
                  ${watchState ? "Tiếp tục" : "Mở"}
                </a>
                <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">Chi tiết</a>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function bindSearch(items) {
    if (!searchInput) return;

    searchInput.setAttribute("autocomplete", "off");
    searchInput.setAttribute("spellcheck", "false");

    searchInput.addEventListener("input", () => {
      const term = normalize(searchInput.value.trim());

      const filtered = items.filter((anime) => {
        const haystack = normalize([
          anime.title,
          anime.description,
          anime.year,
          ...(anime.genres || [])
        ].join(" "));

        return haystack.includes(term);
      });

      renderGrid(filtered);
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

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
});
