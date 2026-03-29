document.addEventListener("DOMContentLoaded", async () => {
  const heroSection = document.getElementById("heroSection");
  const trendingRail = document.getElementById("trendingRail");
  const animeGrid = document.getElementById("animeGrid");
  const searchInput = document.getElementById("searchInput");

  const library = await window.StreamUI.loadLibrary();
  const featured = library[0] || null;

  if (!library.length) {
    heroSection.innerHTML = `<div class="empty-state">Library unavailable.</div>`;
    animeGrid.innerHTML = `<div class="empty-state">No titles found.</div>`;
    return;
  }

  renderHero(featured);
  renderTrending(library);
  renderGrid(library);

  searchInput.addEventListener("input", () => {
    const term = searchInput.value.trim().toLowerCase();

    const filtered = library.filter((anime) => {
      const haystack = [
        anime.title,
        anime.description,
        anime.year,
        ...(anime.genres || [])
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });

    renderGrid(filtered);
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

    heroSection.innerHTML = `
      <article
        class="hero-card"
        style="background-image:
          linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.25)),
          url('${anime.cover}')"
      >
        <div class="hero-content">
          <h1 class="hero-title">${window.StreamUI.escapeHtml(anime.title)}</h1>

          <p class="hero-description">${window.StreamUI.escapeHtml(anime.description)}</p>

          <div class="hero-actions">
            <a class="btn btn-primary" href="${continueHref}">
              ${watchState ? "Continue Watching" : "Play Now"}
            </a>
            <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">View Details</a>
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
      .map(({ anime, ep }) => {
        return `
          <a
            class="rail-card"
            href="${window.StreamUI.watchHref(anime, ep.seasonNumber, ep.number)}"
            style="background-image:
              linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.85)),
              url('${anime.cover}'); position: relative;"
          >
            <div class="rail-card-content" style="position: absolute; bottom: 12px; left: 15px; padding: 0;">
              <h3 style="margin: 0; font-size: 15px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.9); color: #fff;">${window.StreamUI.escapeHtml(ep.title)}</h3>
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

        return `
          <article class="anime-card">
            <a class="poster-frame" href="${window.StreamUI.detailHref(anime)}" aria-label="${window.StreamUI.escapeHtml(anime.title)} details">
              <img src="${anime.poster}" alt="${window.StreamUI.escapeHtml(anime.title)} poster" loading="lazy" />
            </a>

            <div class="card-topline">
              <span>${anime.year || ""}</span>
              <span>${anime.episodes} Episodes</span>
            </div>

            <h3 class="card-title">${window.StreamUI.escapeHtml(anime.title)}</h3>
            <p class="card-description">${window.StreamUI.escapeHtml(anime.description)}</p>

            <div class="pill-row">
              ${(anime.genres || []).map((genre) => `<span class="pill">${window.StreamUI.escapeHtml(genre)}</span>`).join("")}
            </div>

            ${
              progress
                ? `
                  <div>
                    <div class="watch-stamp">Resume</div>
                    <div class="progress-bar" style="margin-top:10px;">
                      <span style="width:${progress.percent || 0}%"></span>
                    </div>
                  </div>
                `
                : ""
            }

            <div class="card-actions">
              <a class="btn btn-primary" href="${continueHref}">
                ${watchState ? "Continue" : "Open"}
              </a>
              <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">Details</a>
            </div>
          </article>
        `;
      })
      .join("");
  }
});document.addEventListener("DOMContentLoaded", async () => {
  const heroSection = document.getElementById("heroSection");
  const trendingRail = document.getElementById("trendingRail");
  const animeGrid = document.getElementById("animeGrid");
  const searchInput = document.getElementById("searchInput");

  const library = await window.StreamUI.loadLibrary();
  const featured = library[0] || null;

  if (!library.length) {
    heroSection.innerHTML = `<div class="empty-state">Library unavailable.</div>`;
    animeGrid.innerHTML = `<div class="empty-state">No titles found.</div>`;
    return;
  }

  renderHero(featured);
  renderTrending(library);
  renderGrid(library);

  searchInput.addEventListener("input", () => {
    const term = searchInput.value.trim().toLowerCase();

    const filtered = library.filter((anime) => {
      const haystack = [
        anime.title,
        anime.description,
        anime.year,
        ...(anime.genres || [])
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });

    renderGrid(filtered);
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

    heroSection.innerHTML = `
      <article
        class="hero-card"
        style="background-image:
          linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.25)),
          url('${anime.cover}');
          background-position: top center; /* CHỈNH SỬA TẠI ĐÂY: Căn từ trên xuống */
          background-size: cover;" /* CHỈNH SỬA TẠI ĐÂY: Phủ kín ảnh */
      >
        <div class="hero-content">
          <h1 class="hero-title">${window.StreamUI.escapeHtml(anime.title)}</h1>

          <p class="hero-description">${window.StreamUI.escapeHtml(anime.description)}</p>

          <div class="hero-actions">
            <a class="btn btn-primary" href="${continueHref}">
              ${watchState ? "Continue Watching" : "Play Now"}
            </a>
            <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">View Details</a>
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
      .map(({ anime, ep }) => {
        return `
          <a
            class="rail-card"
            href="${window.StreamUI.watchHref(anime, ep.seasonNumber, ep.number)}"
            style="background-image:
              linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.85)),
              url('${anime.cover}'); position: relative;"
          >
            <div class="rail-card-content" style="position: absolute; bottom: 12px; left: 15px; padding: 0;">
              <h3 style="margin: 0; font-size: 15px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.9); color: #fff;">${window.StreamUI.escapeHtml(ep.title)}</h3>
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

        return `
          <article class="anime-card">
            <a class="poster-frame" href="${window.StreamUI.detailHref(anime)}" aria-label="${window.StreamUI.escapeHtml(anime.title)} details">
              <img src="${anime.poster}" alt="${window.StreamUI.escapeHtml(anime.title)} poster" loading="lazy" />
            </a>

            <div class="card-topline">
              <span>${anime.year || ""}</span>
              <span>${anime.episodes} Episodes</span>
            </div>

            <h3 class="card-title">${window.StreamUI.escapeHtml(anime.title)}</h3>
            <p class="card-description">${window.StreamUI.escapeHtml(anime.description)}</p>

            <div class="pill-row">
              ${(anime.genres || []).map((genre) => `<span class="pill">${window.StreamUI.escapeHtml(genre)}</span>`).join("")}
            </div>

            ${
              progress
                ? `
                  <div>
                    <div class="watch-stamp">Resume</div>
                    <div class="progress-bar" style="margin-top:10px;">
                      <span style="width:${progress.percent || 0}%"></span>
                    </div>
                  </div>
                `
                : ""
            }

            <div class="card-actions">
              <a class="btn btn-primary" href="${continueHref}">
                ${watchState ? "Continue" : "Open"}
              </a>
              <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">Details</a>
            </div>
          </article>
        `;
      })
      .join("");
  }
});