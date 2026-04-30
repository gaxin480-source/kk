document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("page-ready");
  enhanceWatchChrome();

  const app = document.getElementById("watchApp");
  if (!app) return;

  const FALLBACK_MEDIA_ORIGIN = "https://pub-dab99a826eda429485b516030cfc5e7d.r2.dev/";

  let anime = null;
  let seasonNumber = 1;
  let episodeNumber = 1;
  let allEpisodes = [];
  let currentEpisode = null;
  let currentIndex = -1;
  let hls = null;
  let boundVideo = null;
  let lastProgressSavedAt = 0;

  try {
    const slug = window.StreamUI?.getQueryParam("slug");
    anime = await window.StreamUI?.getAnimeBySlug(slug);
    app.classList.remove("is-loading");

    if (!anime) {
      renderUnavailable("Playback unavailable.");
      return;
    }

    seasonNumber = Number(window.StreamUI.getQueryParam("season", anime.seasons?.[0]?.seasonNumber || 1));
    episodeNumber = Number(window.StreamUI.getQueryParam("episode", anime.seasons?.[0]?.episodes?.[0]?.number || 1));

    const detailLink = document.getElementById("backToDetail");
    if (detailLink) {
      detailLink.href = window.StreamUI.buildUrl("detail.html", { slug: anime.slug });
    }

    allEpisodes = window.StreamUI.flattenEpisodes(anime);
    resolveCurrentEpisode();
    renderShell();
    await attachPlayer();
  } catch (err) {
    console.error("watch init error:", err);
    app?.classList.remove("is-loading");
    renderUnavailable("Playback unavailable.");
  }

  function renderUnavailable(message) {
    app.innerHTML = `<div class="watch-stage"><div class="empty-state">${escapeHtml(message || "Playback unavailable.")}</div></div>`;
  }

  function resolveCurrentEpisode() {
    const found = allEpisodes.find((ep) =>
      Number(ep.seasonNumber) === Number(seasonNumber) &&
      Number(ep.number) === Number(episodeNumber)
    );

    const fallback = found || allEpisodes[0];
    if (!fallback) return;

    seasonNumber = Number(fallback.seasonNumber);
    episodeNumber = Number(fallback.number);
    currentEpisode = fallback;
    currentIndex = allEpisodes.findIndex((ep) =>
      Number(ep.seasonNumber) === Number(seasonNumber) &&
      Number(ep.number) === Number(episodeNumber)
    );
  }

  function renderShell() {
    const previousEpisode = allEpisodes[currentIndex - 1] || null;
    const nextEpisode = allEpisodes[currentIndex + 1] || null;
    const settings = window.StreamStorage?.getSettings?.() || { autoplayNext: true };
    const activeProgress = window.StreamStorage?.getProgress?.(anime.slug, seasonNumber, episodeNumber);
    const totalEpisodes = allEpisodes.length;

    window.StreamUI?.setMeta?.(
      `${anime.title} · Tập ${episodeNumber} · KageStream`,
      currentEpisode?.description || anime.description || anime.title || "KageStream"
    );

    app.innerHTML = `
      <section class="watch-stage">
        <section class="watch-top">
          <div class="watch-top-content">
            <div>
              <p class="watch-kicker">Now Playing</p>
              <h1 class="watch-title">${escapeHtml(anime.title)}</h1>
              <p class="watch-subtitle">
                ${escapeHtml(currentEpisode?.title || `Tập ${episodeNumber}`)}
                ${currentEpisode?.duration ? ` · ${escapeHtml(currentEpisode.duration)}` : ""}
              </p>
            </div>
            <div class="watch-head-actions">
              <a class="btn btn-secondary" href="${window.StreamUI.detailHref(anime)}">Chi tiết</a>
              <a class="btn btn-ghost" href="index.html">Thư viện</a>
            </div>
          </div>
        </section>

        <section class="watch-layout">
          <div class="player-column">
            <div class="player-shell">
              <div class="player-chrome">
                <strong>${window.StreamUI.formatEpisodeLabel(seasonNumber, episodeNumber)}</strong>
                <div class="player-chip-row">
                  <span class="player-chip">${currentIndex + 1}/${totalEpisodes}</span>
                  ${activeProgress ? `<span class="player-chip">${activeProgress.percent || 0}% đã xem</span>` : ""}
                  <span class="player-chip shortcut-help"><kbd>Space</kbd> Play/Pause</span>
                </div>
              </div>

              <div class="video-frame" id="videoFrame">
                <video
                  id="videoPlayer"
                  controls
                  playsinline
                  webkit-playsinline
                  preload="metadata"
                  crossorigin="anonymous"
                  poster="${escapeAttr(anime.cover || anime.poster || "")}"
                ></video>
                <div id="playerOverlay" class="player-overlay" aria-live="polite"></div>
              </div>

              <div class="player-control-bar">
                <div class="player-groups">
                  <a class="btn btn-secondary nav-action ${previousEpisode ? "" : "is-disabled"}"
                    ${previousEpisode ? `href="${window.StreamUI.watchHref(anime, previousEpisode.seasonNumber, previousEpisode.number)}"` : `href="#" aria-disabled="true"`}>
                    ← Tập trước
                  </a>
                  <a class="btn btn-primary nav-action ${nextEpisode ? "" : "is-disabled"}"
                    ${nextEpisode ? `href="${window.StreamUI.watchHref(anime, nextEpisode.seasonNumber, nextEpisode.number)}"` : `href="#" aria-disabled="true"`}>
                    Tập tiếp →
                  </a>
                </div>

                <label class="control-pill">
                  <input id="autoplayNext" type="checkbox" ${settings.autoplayNext !== false ? "checked" : ""}>
                  Tự phát tập sau
                </label>
              </div>

              <div class="player-info">
                <h2 class="player-anime-title">${escapeHtml(currentEpisode?.title || anime.title)}</h2>
                <div class="player-episode">Tập ${episodeNumber}</div>
                <p class="player-description">${escapeHtml(currentEpisode?.description || anime.description || "")}</p>
              </div>
            </div>

            <div class="watch-bottom">
              <div class="episode-nav">
                <a class="btn btn-secondary nav-action ${previousEpisode ? "" : "is-disabled"}"
                  ${previousEpisode ? `href="${window.StreamUI.watchHref(anime, previousEpisode.seasonNumber, previousEpisode.number)}"` : `href="#" aria-disabled="true"`}>
                  Previous
                </a>
                <a class="btn btn-primary nav-action ${nextEpisode ? "" : "is-disabled"}"
                  ${nextEpisode ? `href="${window.StreamUI.watchHref(anime, nextEpisode.seasonNumber, nextEpisode.number)}"` : `href="#" aria-disabled="true"`}>
                  Next
                </a>
              </div>
              <div class="watch-hint">Phím tắt: <kbd>Space</kbd> phát/dừng · <kbd>F</kbd> fullscreen · <kbd>M</kbd> mute · <kbd>←</kbd>/<kbd>→</kbd> tua 10s</div>
            </div>
          </div>

          <aside class="sidebar">
            <div class="sidebar-head">
              <h3>Episodes</h3>
              <span class="sidebar-count">${totalEpisodes} tập</span>
            </div>

            <div class="episode-list">
              ${allEpisodes.map((episode) => {
                const active = Number(episode.seasonNumber) === Number(seasonNumber) && Number(episode.number) === Number(episodeNumber);
                const progress = window.StreamStorage?.getProgress?.(anime.slug, episode.seasonNumber, episode.number);
                const thumb = episode.thumbnail || episode.cover || anime.cover || anime.poster || "";

                return `
                  <button
                    type="button"
                    class="episode-button ${active ? "is-active" : ""}"
                    data-season="${episode.seasonNumber}"
                    data-episode="${episode.number}"
                    aria-current="${active ? "true" : "false"}"
                  >
                    <div class="episode-thumb">
                      <img src="${escapeAttr(thumb)}" loading="lazy" decoding="async" alt="" />
                    </div>
                    <div class="episode-button-body">
                      <div class="episode-button-top">
                        <span class="episode-index">Tập ${escapeHtml(episode.number)}</span>
                        <span class="episode-time">${escapeHtml(episode.duration || "")}</span>
                      </div>
                      <h4 class="episode-title">${escapeHtml(episode.title || anime.title)}</h4>
                      <p class="episode-description">${progress ? `${progress.percent || 0}% đã xem` : escapeHtml(episode.description || "")}</p>
                      ${progress ? `<div class="progress-bar"><span style="width:${progress.percent || 0}%"></span></div>` : ""}
                    </div>
                  </button>
                `;
              }).join("")}
            </div>
          </aside>
        </section>
      </section>
    `;

    bindUiControls();
  }

  function bindUiControls() {
    app.querySelectorAll(".episode-button").forEach((button) => {
      button.addEventListener("click", async () => {
        seasonNumber = Number(button.dataset.season);
        episodeNumber = Number(button.dataset.episode);

        resolveCurrentEpisode();

        history.replaceState({}, "", window.StreamUI.watchHref(anime, seasonNumber, episodeNumber));

        renderShell();
        await attachPlayer();
        document.getElementById("videoFrame")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    app.querySelector("#autoplayNext")?.addEventListener("change", (event) => {
      window.StreamStorage?.saveSettings?.({ autoplayNext: Boolean(event.target.checked) });
    });
  }

  function pickFirstString(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();

      if (Array.isArray(value)) {
        for (const item of value) {
          const nested = pickFirstString(item);
          if (nested) return nested;
        }
      }

      if (value && typeof value === "object") {
        const nested = pickFirstString(
          value.src,
          value.url,
          value.file,
          value.stream,
          value.hls,
          value.master,
          value.playlist,
          value.m3u8,
          value.video
        );
        if (nested) return nested;
      }
    }
    return "";
  }

  function getEpisodeStream(episode) {
    return pickFirstString(
      episode?.stream,
      episode?.src,
      episode?.url,
      episode?.file,
      episode?.master,
      episode?.playlist,
      episode?.hls,
      episode?.m3u8,
      episode?.video,
      episode?.playback,
      episode?.sources?.hls,
      episode?.sources?.master,
      episode?.sources?.stream,
      episode?.sources?.src,
      episode?.sources?.url,
      episode?.sources?.m3u8,
      episode?.sources
    );
  }

  function getEpisodeSubtitles(episode) {
    return pickFirstString(
      episode?.subtitles,
      episode?.subtitle,
      episode?.captions,
      episode?.vtt,
      episode?.subtitleVtt,
      episode?.sources?.subtitles,
      episode?.sources?.subtitle,
      episode?.sources?.captions,
      episode?.sources?.vtt
    );
  }

  function getEpisodeThumbnails(episode) {
    return pickFirstString(
      episode?.thumbnails,
      episode?.thumbnailVtt,
      episode?.previewVtt,
      episode?.spritesVtt,
      episode?.sources?.thumbnails,
      episode?.sources?.thumbnailVtt,
      episode?.sources?.previewVtt
    );
  }

  function isAbsoluteUrl(value) {
    return /^https?:\/\//i.test(value || "");
  }

  function resolveAssetUrl(rawPath, extraBases = []) {
    if (!rawPath || typeof rawPath !== "string") return "";

    const path = rawPath.trim();
    if (!path) return "";

    if (isAbsoluteUrl(path)) return path;

    const bases = [
      ...extraBases,
      currentEpisode?.streamRoot,
      currentEpisode?.mediaRoot,
      currentEpisode?.cdnRoot,
      currentEpisode?.baseUrl,
      anime?.streamRoot,
      anime?.mediaRoot,
      anime?.cdnRoot,
      anime?.baseUrl,
      window.StreamUI?.STREAM_MEDIA_ORIGIN,
      window.StreamUI?.MEDIA_ORIGIN,
      window.STREAM_MEDIA_ORIGIN,
      FALLBACK_MEDIA_ORIGIN,
      `${window.location.origin}/`
    ].filter(Boolean);

    for (const base of bases) {
      try {
        return new URL(path, base).href;
      } catch (_) {}
    }

    return "";
  }

  function showOverlay(message, loading = false) {
    const overlay = document.getElementById("playerOverlay");
    if (!overlay) return;

    overlay.innerHTML = loading
      ? `<div><div class="loader-ring" aria-hidden="true"></div><p style="margin:14px 0 0;">${escapeHtml(message || "Đang tải...")}</p></div>`
      : `<div>${escapeHtml(message || "")}</div>`;
    overlay.classList.add("is-visible");
  }

  function hideOverlay() {
    const overlay = document.getElementById("playerOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-visible");
    overlay.innerHTML = "";
  }

  function bindVideoEvents(video) {
    if (boundVideo && boundVideo !== video) {
      unbindVideoEvents(boundVideo);
    }

    const onTimeUpdate = () => {
      if (!window.StreamStorage) return;

      const now = Date.now();
      if (now - lastProgressSavedAt < 5000) return;
      lastProgressSavedAt = now;

      try {
        window.StreamStorage.saveProgress({
          slug: anime.slug,
          season: seasonNumber,
          episode: episodeNumber,
          currentTime: video.currentTime,
          duration: video.duration,
          completed: false
        });
      } catch (err) {
        console.warn("saveProgress error:", err);
      }
    };

    const onEnded = () => {
      try {
        window.StreamStorage?.saveProgress?.({
          slug: anime.slug,
          season: seasonNumber,
          episode: episodeNumber,
          currentTime: video.duration || 0,
          duration: video.duration || 0,
          completed: true
        });
      } catch (_) {}

      const next = allEpisodes[currentIndex + 1];
      const autoplayNext = window.StreamStorage?.getSettings?.()?.autoplayNext !== false;
      if (!next || !autoplayNext) return;

      window.location.href = window.StreamUI.watchHref(anime, next.seasonNumber, next.number);
    };

    const onLoadedMetadata = () => {
      hideOverlay();

      const saved = window.StreamStorage?.getProgress?.(anime.slug, seasonNumber, episodeNumber);
      if (!saved?.currentTime || saved.completed) return;

      const safeResume = Number(saved.currentTime) > 5 &&
        Number(saved.currentTime) < Number(video.duration || 0) - 8;

      if (safeResume) {
        try {
          video.currentTime = saved.currentTime;
        } catch (_) {}
      }
    };

    const onWaiting = () => showOverlay("Đang tải video...", true);
    const onCanPlay = () => hideOverlay();

    const onError = () => {
      const mediaError = video.error;
      console.error("video element error:", mediaError);
      showOverlay("Không thể phát video. Hãy kiểm tra URL stream hoặc CORS.");
    };

    unbindVideoEvents(video);

    video.__onTimeUpdate = onTimeUpdate;
    video.__onEnded = onEnded;
    video.__onLoadedMetadata = onLoadedMetadata;
    video.__onWaiting = onWaiting;
    video.__onCanPlay = onCanPlay;
    video.__onError = onError;

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);

    video.addEventListener("click", () => {
      video.paused ? video.play().catch(() => {}) : video.pause();
    });

    boundVideo = video;
  }

  function unbindVideoEvents(video) {
    if (!video) return;

    const pairs = [
      ["timeupdate", "__onTimeUpdate"],
      ["ended", "__onEnded"],
      ["loadedmetadata", "__onLoadedMetadata"],
      ["waiting", "__onWaiting"],
      ["canplay", "__onCanPlay"],
      ["error", "__onError"]
    ];

    pairs.forEach(([eventName, prop]) => {
      if (video[prop]) {
        video.removeEventListener(eventName, video[prop]);
        video[prop] = null;
      }
    });
  }

  async function attachPlayer() {
    const video = document.getElementById("videoPlayer");
    if (!video || !currentEpisode) return;

    hideOverlay();
    showOverlay("Đang tải video...", true);

    const rawStream = getEpisodeStream(currentEpisode);
    if (!rawStream) {
      console.error("Episode thiếu field stream:", currentEpisode);
      video.removeAttribute("src");
      video.load();
      showOverlay("Episode này chưa có đường dẫn video.");
      return;
    }

    const streamUrl = resolveAssetUrl(rawStream);
    const rawSubtitle = getEpisodeSubtitles(currentEpisode);
    const subtitleUrl = rawSubtitle ? resolveAssetUrl(rawSubtitle) : "";
    const rawThumbnail = getEpisodeThumbnails(currentEpisode);
    const thumbnailUrl = rawThumbnail ? resolveAssetUrl(rawThumbnail) : "";

    if (!streamUrl) {
      console.error("Không resolve được stream URL:", rawStream, currentEpisode, anime);
      showOverlay("Không resolve được URL video.");
      return;
    }

    if (hls) {
      try { hls.destroy(); } catch (_) {}
      hls = null;
    }

    removeThumbnailPreview();

    try { video.pause(); } catch (_) {}
    video.querySelectorAll("track").forEach((track) => track.remove());
    video.removeAttribute("src");
    video.load();

    const isM3u8 = /\.m3u8($|\?)/i.test(streamUrl);

    if (isM3u8 && !window.Hls && window.hlsLoaderReady) {
      try {
        await window.hlsLoaderReady;
      } catch (error) {
        console.warn("HLS loader error:", error);
      }
    }

    const useHlsJs = isM3u8 && window.Hls && window.Hls.isSupported();

    if (useHlsJs) {
      hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        autoStartLoad: true
      });

      hls.on(window.Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(streamUrl);
      });

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        hideOverlay();
      });

      hls.on(window.Hls.Events.ERROR, (event, data) => {
        console.error("HLS error:", data);

        if (!data?.fatal) return;

        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          showOverlay("Lỗi tải stream HLS. Đang thử lại...", true);
          try { hls.startLoad(); } catch (_) {}
          return;
        }

        if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          showOverlay("Lỗi giải mã video. Đang khôi phục...", true);
          try { hls.recoverMediaError(); } catch (_) {}
          return;
        }

        showOverlay("Không thể phát stream HLS.");
        try { hls.destroy(); } catch (_) {}
        hls = null;
      });

      hls.attachMedia(video);
    } else if (isM3u8 && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
    } else if (!isM3u8) {
      video.src = streamUrl;
    } else {
      console.error("Browser không hỗ trợ HLS:", streamUrl);
      showOverlay("Trình duyệt không hỗ trợ HLS hoặc Hls.js chưa tải được.");
      return;
    }

    if (subtitleUrl) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = "Tiếng Việt";
      track.srclang = "vi";
      track.src = subtitleUrl;
      track.default = true;
      video.appendChild(track);
    }

    bindVideoEvents(video);

    if (!useHlsJs) {
      video.load();
    }

    await setupThumbnailPreview(video, thumbnailUrl);

    try {
      window.StreamStorage?.saveWatchState?.(anime.slug, seasonNumber, episodeNumber);
    } catch (err) {
      console.warn("saveWatchState error:", err);
    }
  }

  async function setupThumbnailPreview(video, thumbnailUrl) {
    removeThumbnailPreview();

    if (!thumbnailUrl) return;

    let cues = [];
    try {
      cues = await loadThumbnailVtt(thumbnailUrl);
    } catch (err) {
      console.warn("Failed to load thumbnails:", err);
      return;
    }

    if (!cues.length) return;

    const wrapper = video.parentElement;
    if (!wrapper) return;

    wrapper.style.position = "relative";

    const preview = document.createElement("div");
    preview.id = "video-thumb-preview";

    const img = document.createElement("img");
    const timeLabel = document.createElement("div");

    preview.appendChild(img);
    preview.appendChild(timeLabel);
    wrapper.appendChild(preview);

    const progressHandler = (event) => {
      const rect = video.getBoundingClientRect();
      if (!rect.width || !video.duration || !isFinite(video.duration)) return;

      const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
      const hoverTime = ratio * video.duration;
      const cue = findThumbnailCue(cues, hoverTime);

      if (!cue) {
        preview.style.display = "none";
        return;
      }

      img.src = cue.src;
      timeLabel.textContent = formatTime(hoverTime);
      preview.style.left = `${ratio * rect.width}px`;
      preview.style.display = "block";
    };

    const leaveHandler = () => {
      preview.style.display = "none";
    };

    video.__thumbMoveHandler = progressHandler;
    video.__thumbLeaveHandler = leaveHandler;
    video.__thumbPreviewEl = preview;

    video.addEventListener("mousemove", progressHandler);
    video.addEventListener("mouseleave", leaveHandler);
    video.addEventListener("seeking", leaveHandler);
    video.addEventListener("play", leaveHandler);
  }

  function removeThumbnailPreview() {
    const oldVideo = boundVideo || document.getElementById("videoPlayer");
    if (!oldVideo) return;

    if (oldVideo.__thumbMoveHandler) {
      oldVideo.removeEventListener("mousemove", oldVideo.__thumbMoveHandler);
      oldVideo.__thumbMoveHandler = null;
    }

    if (oldVideo.__thumbLeaveHandler) {
      oldVideo.removeEventListener("mouseleave", oldVideo.__thumbLeaveHandler);
      oldVideo.removeEventListener("seeking", oldVideo.__thumbLeaveHandler);
      oldVideo.removeEventListener("play", oldVideo.__thumbLeaveHandler);
      oldVideo.__thumbLeaveHandler = null;
    }

    if (oldVideo.__thumbPreviewEl?.parentNode) {
      oldVideo.__thumbPreviewEl.parentNode.removeChild(oldVideo.__thumbPreviewEl);
      oldVideo.__thumbPreviewEl = null;
    }
  }

  async function loadThumbnailVtt(vttUrl) {
    const response = await fetch(vttUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Cannot load VTT: ${vttUrl}`);
    }

    const text = await response.text();
    const baseUrl = vttUrl.substring(0, vttUrl.lastIndexOf("/") + 1);
    const lines = text.replace(/\r/g, "").split("\n");
    const cues = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line || line === "WEBVTT") continue;

      if (line.includes("-->")) {
        const parts = line.split("-->");
        const start = parseVttTime(parts[0].trim());
        const end = parseVttTime(parts[1].trim());

        let src = "";
        i++;

        while (i < lines.length && !lines[i].trim()) i++;

        if (i < lines.length) src = lines[i].trim();

        if (src) {
          cues.push({
            start,
            end,
            src: new URL(src, baseUrl).href
          });
        }
      }
    }

    return cues;
  }

  function parseVttTime(value) {
    const clean = String(value || "").split(" ")[0].trim();
    const match = clean.match(/^(?:(\d+):)?(\d+):(\d+)\.(\d+)$/);
    if (!match) return 0;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    const millis = Number(match[4] || 0);

    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }

  function findThumbnailCue(cues, time) {
    return cues.find((cue) => time >= cue.start && time <= cue.end) || cues[cues.length - 1] || null;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;

    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function escapeHtml(value = "") {
    if (window.StreamUI?.escapeHtml) return window.StreamUI.escapeHtml(String(value ?? ""));
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(value = "") {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }
});

function enhanceWatchChrome() {
  const header = document.querySelector(".site-header");
  const setHeaderState = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if (isTyping) return;

    const video = document.querySelector("video");
    if (!video) return;

    if (event.code === "Space") {
      event.preventDefault();
      video.paused ? video.play().catch(() => {}) : video.pause();
    }

    if (event.key.toLowerCase() === "m") {
      video.muted = !video.muted;
    }

    if (event.key.toLowerCase() === "f") {
      const frame = document.getElementById("videoFrame") || video;
      if (!document.fullscreenElement) {
        frame.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }

    if (event.key === "ArrowLeft") {
      video.currentTime = Math.max(0, video.currentTime - 10);
    }

    if (event.key === "ArrowRight") {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    }
  });
}
