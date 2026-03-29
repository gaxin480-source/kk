document.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("watchApp");
  if (!app) return;

  // ĐÃ SỬA DÒNG 5: Nối lại thành 1 dòng chuẩn
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

    if (!anime) {
      renderUnavailable("Playback unavailable.");
      return;
    }

    seasonNumber = Number(
      window.StreamUI.getQueryParam(
        "season",
        anime.seasons?.[0]?.seasonNumber || 1
      )
    );

    episodeNumber = Number(
      window.StreamUI.getQueryParam(
        "episode",
        anime.seasons?.[0]?.episodes?.[0]?.number || 1
      )
    );

    const detailLink = document.getElementById("backToDetail");
    if (detailLink) {
      detailLink.href = window.StreamUI.buildUrl("detail.html", {
        slug: anime.slug
      });
    }

    allEpisodes = (anime.seasons || []).flatMap((season) =>
      (season.episodes || []).map((ep) => ({
        ...ep,
        seasonNumber: season.seasonNumber
      }))
    );

    resolveCurrentEpisode();
    renderShell();
    await attachPlayer();

  } catch (err) {
    console.error("watch init error:", err);
    renderUnavailable("Playback unavailable.");
  }

  function renderUnavailable(message) {
    // ĐÃ SỬA DÒNG NÀY: Thêm dấu nháy ngược ``
    app.innerHTML = `<div class="watch-stage"> <div class="empty-state">${escapeHtml(message || "Playback unavailable.")}</div> </div>`;
  }

  function escapeHtml(value) {
    if (window.StreamUI?.escapeHtml) return window.StreamUI.escapeHtml(String(value ?? ""));
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function resolveCurrentEpisode() {
    const found = allEpisodes.find(
      (ep) =>
        Number(ep.seasonNumber) === Number(seasonNumber) &&
        Number(ep.number) === Number(episodeNumber)
    );

    const fallback = found || allEpisodes[0];
    if (!fallback) return;

    seasonNumber = Number(fallback.seasonNumber);
    episodeNumber = Number(fallback.number);
    currentEpisode = fallback;

    currentIndex = allEpisodes.findIndex(
      (ep) =>
        Number(ep.seasonNumber) === Number(seasonNumber) &&
        Number(ep.number) === Number(episodeNumber)
    );
  }

  function renderShell() {
    // ĐÃ SỬA DÒNG NÀY: Thêm dấu nháy ngược ``
    window.StreamUI?.setMeta?.(
      `${anime.title} · Tập ${episodeNumber} · KageStream`,
      anime.description || anime.title || "KageStream"
    );

    app.innerHTML = `
      <section class="watch-stage">
        <section class="watch-layout">
          <div class="player-column">
            <div class="player-shell">
              <div class="video-frame" id="videoFrame">
                <video
                  id="videoPlayer"
                  controls
                  playsinline
                  webkit-playsinline
                  preload="metadata"
                  crossorigin="anonymous"
                ></video>
                <div id="playerOverlay" class="player-overlay" style="display:none;"></div>
              </div>

              <div class="player-info">
                <h2 class="player-anime-title">${escapeHtml(anime.title)}</h2>
                <div class="player-episode">Tập ${episodeNumber}</div>
                <p class="player-description">${escapeHtml(anime.description || "")}</p>
              </div>
            </div>
          </div>

          <aside class="sidebar">
            <div class="sidebar-head">
              <h3>Episodes</h3>
            </div>

            <div class="episode-list">
              ${allEpisodes
                .map((episode) => {
                  const active =
                    Number(episode.seasonNumber) === Number(seasonNumber) &&
                    Number(episode.number) === Number(episodeNumber);

                  return `
                    <button
                      type="button"
                      class="episode-button ${active ? "is-active" : ""}"
                      data-season="${episode.seasonNumber}"
                      data-episode="${episode.number}"
                    >
                      <div class="episode-thumb">
                        <img src="${escapeHtml(anime.cover || "")}" loading="lazy" alt="${escapeHtml(anime.title)}"/>
                      </div>
                      <div class="episode-button-top">
                        <span class="episode-index">Tập ${episode.number}</span>
                      </div>
                      <h4 class="episode-title">${escapeHtml(anime.title)}</h4>
                    </button>
                  `;
                })
                .join("")}
            </div>
          </aside>
        </section>
      </section>
    `;

    bindEpisodeButtons();
  }

  function bindEpisodeButtons() {
    app.querySelectorAll(".episode-button").forEach((button) => {
      button.addEventListener("click", async () => {
        seasonNumber = Number(button.dataset.season);
        episodeNumber = Number(button.dataset.episode);

        resolveCurrentEpisode();

        history.replaceState(
          {},
          "",
          window.StreamUI.watchHref(anime, seasonNumber, episodeNumber)
        );

        renderShell();
        await attachPlayer();
      });
    });
  }

  function pickFirstString(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && item.trim()) return item.trim();
          if (item && typeof item === "object") {
            const nested = pickFirstString(
              item.src,
              item.url,
              item.file,
              item.hls,
              item.master,
              item.playlist,
              item.m3u8
            );
            if (nested) return nested;
          }
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
          value.m3u8
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

  function showOverlay(message) {
    const overlay = document.getElementById("playerOverlay");
    if (!overlay) return;

    overlay.textContent = message || "";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.textAlign = "center";
    overlay.style.padding = "24px";
    overlay.style.color = "#fff";
    overlay.style.background = "rgba(0,0,0,0.45)";
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.zIndex = "5";
    overlay.style.pointerEvents = "none";
  }

  function hideOverlay() {
    const overlay = document.getElementById("playerOverlay");
    if (!overlay) return;
    overlay.style.display = "none";
    overlay.textContent = "";
  }

  function bindVideoEvents(video) {
    if (boundVideo && boundVideo !== video) {
      if (boundVideo.__onTimeUpdate) {
        boundVideo.removeEventListener("timeupdate", boundVideo.__onTimeUpdate);
      }
      if (boundVideo.__onEnded) {
        boundVideo.removeEventListener("ended", boundVideo.__onEnded);
      }
      if (boundVideo.__onLoadedMetadata) {
        boundVideo.removeEventListener("loadedmetadata", boundVideo.__onLoadedMetadata);
      }
      if (boundVideo.__onError) {
        boundVideo.removeEventListener("error", boundVideo.__onError);
      }
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
      if (!next) return;

      window.location.href = window.StreamUI.watchHref(
        anime,
        next.seasonNumber,
        next.number
      );
    };

    const onLoadedMetadata = () => {
      hideOverlay();
    };

    const onError = () => {
      const mediaError = video.error;
      console.error("video element error:", mediaError);
      showOverlay("Không thể phát video.");
    };

    if (video.__onTimeUpdate) {
      video.removeEventListener("timeupdate", video.__onTimeUpdate);
    }
    if (video.__onEnded) {
      video.removeEventListener("ended", video.__onEnded);
    }
    if (video.__onLoadedMetadata) {
      video.removeEventListener("loadedmetadata", video.__onLoadedMetadata);
    }
    if (video.__onError) {
      video.removeEventListener("error", video.__onError);
    }

    video.__onTimeUpdate = onTimeUpdate;
    video.__onEnded = onEnded;
    video.__onLoadedMetadata = onLoadedMetadata;
    video.__onError = onError;

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);

    boundVideo = video;
  }

  async function attachPlayer() {
    const video = document.getElementById("videoPlayer");
    if (!video || !currentEpisode) return;

    hideOverlay();
    showOverlay("Đang tải video...");

    const rawStream = getEpisodeStream(currentEpisode);
    if (!rawStream) {
      console.error("Episode thiếu field stream:", currentEpisode);
      video.removeAttribute("src");
      video.load();
      showOverlay("Episode chưa có đường dẫn video.");
      return;
    }

    const streamUrl = resolveAssetUrl(rawStream);
    const rawSubtitle = getEpisodeSubtitles(currentEpisode);
    const subtitleUrl = rawSubtitle ? resolveAssetUrl(rawSubtitle) : "";

    const rawThumbnail = getEpisodeThumbnails(currentEpisode);
    const thumbnailUrl = rawThumbnail ? resolveAssetUrl(rawThumbnail) : "";

    console.log("resolved streamUrl:", streamUrl);
    console.log("resolved subtitleUrl:", subtitleUrl);
    console.log("resolved thumbnailUrl:", thumbnailUrl);

    if (!streamUrl) {
      console.error("Không resolve được stream URL:", rawStream, currentEpisode, anime);
      showOverlay("Không resolve được URL video.");
      return;
    }

    if (hls) {
      try {
        hls.destroy();
      } catch (_) {}
      hls = null;
    }

    removeThumbnailPreview();

    try {
      video.pause();
    } catch (_) {}

    video.querySelectorAll("track").forEach((t) => t.remove());
    video.removeAttribute("src");
    video.load();

    const isM3u8 = /\.m3u8($|\?)/i.test(streamUrl);
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
        console.log("HLS manifest parsed:", streamUrl);
        hideOverlay();
      });

      hls.on(window.Hls.Events.ERROR, (event, data) => {
        console.error("HLS error:", data);

        if (!data?.fatal) return;

        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          showOverlay("Lỗi tải stream HLS.");
          try {
            hls.startLoad();
          } catch (_) {}
          return;
        }

        if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          showOverlay("Lỗi giải mã video.");
          try {
            hls.recoverMediaError();
          } catch (_) {}
          return;
        }

        showOverlay("Không thể phát stream HLS.");
        try {
          hls.destroy();
        } catch (_) {}
        hls = null;
      });

      hls.attachMedia(video);

    } else if (isM3u8 && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
    } else if (!isM3u8) {
      video.src = streamUrl;
    } else {
      console.error("Browser không hỗ trợ HLS:", streamUrl);
      showOverlay("Trình duyệt không hỗ trợ HLS.");
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

    await setupThumbnailPreview(video, {
      ...currentEpisode,
      thumbnails: thumbnailUrl
    });

    try {
      window.StreamStorage?.saveWatchState?.(anime.slug, seasonNumber, episodeNumber);
    } catch (err) {
      console.warn("saveWatchState error:", err);
    }
  }

  async function setupThumbnailPreview(video, episode) {
    removeThumbnailPreview();

    if (!episode?.thumbnails) return;

    let cues = [];
    try {
      cues = await loadThumbnailVtt(episode.thumbnails);
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
    preview.style.position = "absolute";
    preview.style.bottom = "56px";
    preview.style.left = "0";
    preview.style.transform = "translateX(-50%)";
    preview.style.pointerEvents = "none";
    preview.style.display = "none";
    preview.style.background = "rgba(0,0,0,0.92)";
    preview.style.border = "1px solid rgba(255,255,255,0.15)";
    preview.style.borderRadius = "10px";
    preview.style.padding = "6px";
    preview.style.zIndex = "20";
    preview.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";

    const img = document.createElement("img");
    img.style.display = "block";
    img.style.width = "220px";
    img.style.maxWidth = "220px";
    img.style.height = "auto";
    img.style.borderRadius = "6px";

    const timeLabel = document.createElement("div");
    timeLabel.style.marginTop = "6px";
    timeLabel.style.fontSize = "12px";
    timeLabel.style.color = "#fff";
    timeLabel.style.textAlign = "center";
    timeLabel.style.whiteSpace = "nowrap";

    preview.appendChild(img);
    preview.appendChild(timeLabel);
    wrapper.appendChild(preview);

    const progressHandler = (event) => {
      const rect = video.getBoundingClientRect();
      if (!rect.width || !video.duration || !isFinite(video.duration)) return;

      const ratio = Math.min(
        Math.max((event.clientX - rect.left) / rect.width, 0),
        1
      );

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
      // ĐÃ SỬA DÒNG NÀY: Thêm dấu nháy ngược ``
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

        while (i < lines.length && !lines[i].trim()) {
          i++;
        }

        if (i < lines.length) {
          src = lines[i].trim();
        }

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
    for (const cue of cues) {
      if (time >= cue.start && time <= cue.end) {
        return cue;
      }
    }
    return cues[cues.length - 1] || null;
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
});