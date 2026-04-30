document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("page-ready");
  enhanceDetailUx();

  const app = document.getElementById("detailApp");
  const slug = window.StreamUI.getQueryParam("slug");
  const anime = await window.StreamUI.getAnimeBySlug(slug);

  app?.classList.remove("is-loading");

  if (!anime) {
    app.innerHTML = `<div class="container"><div class="empty-state">Title unavailable.</div></div>`;
    return;
  }

  const requestedSeason = Number(window.StreamUI.getQueryParam("season", anime.seasons?.[0]?.seasonNumber || 1));
  let activeSeason = anime.seasons.find((season) => Number(season.seasonNumber) === requestedSeason) || anime.seasons[0];

  window.StreamUI.setMeta(`${anime.title} · KageStream`, anime.description);

  render();

  function render() {
    const firstEpisode = window.StreamUI.getFirstEpisode(anime);
    const watchState = window.StreamStorage.getWatchState(anime.slug);
    const resumeHref = watchState
      ? window.StreamUI.watchHref(anime, watchState.season, watchState.episode)
      : firstEpisode
        ? window.StreamUI.watchHref(anime, firstEpisode.season, firstEpisode.episode)
        : "#";

    const totalEpisodes = window.StreamUI.flattenEpisodes(anime).length || anime.episodes || 0;

    app.innerHTML = `
      <div class="container">
        <section
          class="detail-banner"
          style="background-image:
            linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.18)),
            url('${escapeAttr(anime.cover || anime.poster || "")}')"
        >
          <div class="detail-layout">
            <div class="detail-poster">
              <img src="${escapeAttr(anime.poster || anime.cover || "")}" alt="${escapeAttr(anime.title)} poster" loading="eager" decoding="async" />
            </div>

            <div class="detail-copy">
              <div class="pill-row">
                ${anime.year ? `<span class="pill">${escapeHtml(anime.year)}</span>` : ""}
                <span class="pill">${escapeHtml(totalEpisodes)} tập</span>
                ${(anime.genres || []).slice(0, 5).map((genre) => `<span class="pill">${escapeHtml(genre)}</span>`).join("")}
              </div>

              <h1 class="detail-title">${escapeHtml(anime.title)}</h1>
              <p class="detail-description">${escapeHtml(anime.description || "")}</p>

              <div class="detail-actions">
                <a class="btn btn-primary" href="${resumeHref}">
                  ${watchState ? "Tiếp tục xem" : "Bắt đầu xem"}
                </a>
                <a class="btn btn-secondary" href="index.html">Về Home</a>
              </div>
            </div>
          </div>
        </section>

        <section class="detail-content">
          <div class="content-card">
            <h3>Danh sách tập</h3>

            <div class="season-tabs" id="seasonTabs" role="tablist" aria-label="Seasons">
              ${anime.seasons.map((season) => `
                <button
                  class="season-tab ${Number(season.seasonNumber) === Number(activeSeason.seasonNumber) ? "is-active" : ""}"
                  data-season="${season.seasonNumber}"
                  type="button"
                  role="tab"
                  aria-selected="${Number(season.seasonNumber) === Number(activeSeason.seasonNumber)}"
                >
                  ${escapeHtml(season.title || `Season ${season.seasonNumber}`)}
                </button>
              `).join("")}
            </div>

            <div class="episode-grid">
              ${activeSeason.episodes.map((episode) => {
                const progress = window.StreamStorage.getProgress(anime.slug, activeSeason.seasonNumber, episode.number);
                const watchedText = progress ? `${progress.percent || 0}% đã xem` : "Sẵn sàng phát";

                return `
                  <article class="episode-card">
                    <div class="episode-top">
                      <span>${window.StreamUI.formatEpisodeLabel(activeSeason.seasonNumber, episode.number)}</span>
                      <span>${escapeHtml(episode.duration || "")}</span>
                    </div>

                    <h4>${escapeHtml(episode.title || anime.title)}</h4>
                    <p>${escapeHtml(episode.description || anime.description || "")}</p>

                    ${
                      progress
                        ? `
                          <div class="progress-bar" aria-label="${progress.percent || 0}% watched">
                            <span style="width:${progress.percent || 0}%"></span>
                          </div>
                        `
                        : ""
                    }

                    <div class="episode-card-footer">
                      <span class="pill">${watchedText}</span>
                      <a
                        class="btn btn-primary"
                        href="${window.StreamUI.watchHref(anime, activeSeason.seasonNumber, episode.number)}"
                      >
                        Play
                      </a>
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          </div>

          <aside class="detail-sidebar">
            <div class="content-card">
              <h3>Overview</h3>
              <div class="stat-list">
                <div class="stat-item">
                  <small>Title</small>
                  <strong>${escapeHtml(anime.title)}</strong>
                </div>
                <div class="stat-item">
                  <small>Genres</small>
                  <strong>${escapeHtml(window.StreamUI.genresLine(anime.genres || [])) || "—"}</strong>
                </div>
                <div class="stat-item">
                  <small>Seasons</small>
                  <strong>${anime.seasons.length}</strong>
                </div>
                <div class="stat-item">
                  <small>Episodes</small>
                  <strong>${escapeHtml(totalEpisodes)}</strong>
                </div>
                <div class="stat-item">
                  <small>Release Year</small>
                  <strong>${escapeHtml(anime.year || "—")}</strong>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    `;

    bindSeasonTabs();
  }

  function bindSeasonTabs() {
    const tabs = app.querySelectorAll(".season-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const seasonNumber = Number(tab.dataset.season);
        const nextSeason = anime.seasons.find((season) => Number(season.seasonNumber) === seasonNumber);

        if (nextSeason) {
          activeSeason = nextSeason;
          history.replaceState({}, "", window.StreamUI.buildUrl("detail.html", {
            slug: anime.slug,
            season: activeSeason.seasonNumber
          }));
          render();
          document.querySelector(".detail-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }
});

function enhanceDetailUx() {
  const header = document.querySelector(".site-header");
  const setHeaderState = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });
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
