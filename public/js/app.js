/**
 * Cloudflare Drive Player - 前端核心交互逻辑
 */

// 状态管理
const state = {
  rootFolderId: "root",
  rootName: "主云盘",
  currentFolderId: "root",
  breadcrumbs: [{ id: "root", name: "主云盘" }],
  items: [],
  filteredItems: [],
  viewMode: localStorage.getItem("view_mode") || "grid",
  sortBy: "name_asc",
  searchQuery: "",
  pageSize: localStorage.getItem("page_size") === "all" ? "all" : (parseInt(localStorage.getItem("page_size"), 10) || 30),
  currentPage: 1,
  autoPlayNext: localStorage.getItem("auto_play_next") !== "false", // 默认开启同名/连续剧自动连播
  playerInstance: null,
  activeMediaItem: null,
  isGooglePreview: false,
  isPlayerMaximized: false,
};

// DOM 元素引用
const dom = {
  siteTitle: document.getElementById("site-title"),
  btnHome: document.getElementById("btn-home"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  fileCount: document.getElementById("file-count"),
  sortSelect: document.getElementById("sort-select"),
  pageSizeSelect: document.getElementById("page-size-select"),
  paginationBar: document.getElementById("pagination-bar"),
  paginationInfo: document.getElementById("pagination-info"),
  paginationControls: document.getElementById("pagination-controls"),
  searchInput: document.getElementById("search-input"),
  clearSearchBtn: document.getElementById("clear-search-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  viewModeBtn: document.getElementById("view-mode-btn"),
  viewIcon: document.getElementById("view-icon"),
  loadingSkeleton: document.getElementById("loading-skeleton"),
  gridView: document.getElementById("grid-view"),
  listView: document.getElementById("list-view"),
  listTbody: document.getElementById("list-tbody"),
  emptyState: document.getElementById("empty-state"),
  // 播放器模态框
  playerModal: document.getElementById("player-modal"),
  playerDialog: document.getElementById("player-dialog"),
  playerHeader: document.getElementById("player-header"),
  playerFileName: document.getElementById("player-file-name"),
  playerTypeIcon: document.getElementById("player-type-icon"),
  playerDownloadBtn: document.getElementById("player-download-btn"),
  playerCopyLinkBtn: document.getElementById("player-copy-link-btn"),
  playerMaximizeBtn: document.getElementById("player-maximize-btn"),
  playerMaximizeIcon: document.getElementById("player-maximize-icon"),
  playerAutoplayToggleBtn: document.getElementById("player-autoplay-toggle-btn"),
  playerAutoplayIcon: document.getElementById("player-autoplay-icon"),
  playerAutoplayText: document.getElementById("player-autoplay-text"),
  playerPrevBtn: document.getElementById("player-prev-btn"),
  playerNextBtn: document.getElementById("player-next-btn"),
  closePlayerBtn: document.getElementById("close-player-btn"),
  streamSourceToggleBtn: document.getElementById("stream-source-toggle-btn"),
  streamSourceText: document.getElementById("stream-source-text"),
  mediaWrapper: document.getElementById("media-wrapper"),
  codecWarningBanner: document.getElementById("codec-warning-banner"),
  closeCodecWarningBtn: document.getElementById("close-codec-warning-btn"),
  extPlayerMenuBtn: document.getElementById("ext-player-menu-btn"),
  extPlayerMenu: document.getElementById("ext-player-menu"),
  btnMpv: document.getElementById("btn-mpv"),
  btnExoplayer: document.getElementById("btn-exoplayer"),
  btnPotplayer: document.getElementById("btn-potplayer"),
  btnVlc: document.getElementById("btn-vlc"),
  btnIina: document.getElementById("btn-iina"),
  btnInfuse: document.getElementById("btn-infuse"),
  btnCopyMpvCmd: document.getElementById("btn-copy-mpv-cmd"),
  // 图片模态框
  imageModal: document.getElementById("image-modal"),
  imagePreview: document.getElementById("image-preview"),
  imageName: document.getElementById("image-name"),
  closeImageBtn: document.getElementById("close-image-btn"),
  // 配置引导模态框
  configGuideModal: document.getElementById("config-guide-modal"),
  closeGuideBtn: document.getElementById("close-guide-btn"),
  // Toast
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toast-message"),
};

// 辅助工具：文件大小格式化
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 辅助工具：日期格式化
function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return dateStr;
  }
}

// 辅助工具：图标映射
function getFileIcon(item) {
  if (item.isFolder) return { icon: "folder", color: "text-amber-400" };
  if (item.isVideo) return { icon: "video", color: "text-rose-400" };
  if (item.isAudio) return { icon: "music", color: "text-emerald-400" };
  if (item.isImage) return { icon: "image", color: "text-purple-400" };
  if (item.isDocument) return { icon: "file-text", color: "text-blue-400" };
  if (/\.(zip|rar|7z|tar|gz)$/i.test(item.name)) return { icon: "archive", color: "text-yellow-400" };
  if (/\.(iso|dmg|exe|apk)$/i.test(item.name)) return { icon: "disc", color: "text-indigo-400" };
  return { icon: "file", color: "text-slate-400" };
}

// 获取高清缩略图地址
function getHighResThumb(item, size = 640) {
  if (!item.thumbnailLink) return null;
  return item.thumbnailLink.replace(/=s\d+.*$/, `=s${size}`);
}

// 获取视频清晰度 / 分辨率标识
function getVideoResolution(item) {
  if (!item.isVideo) return null;

  if (item.videoMediaMetadata) {
    const { width, height } = item.videoMediaMetadata;
    if (height && width) {
      if (height >= 2100 || width >= 3800) return "4K";
      if (height >= 1400 || width >= 2500) return "2K";
      if (height >= 1000 || width >= 1900) return "1080P";
      if (height >= 700 || width >= 1200) return "720P";
      if (height >= 450) return "480P";
      return `${height}P`;
    }
  }

  const match = item.name.match(/(4k|2160p|1440p|2k|1080p|720p|480p|360p)/i);
  if (match) {
    return match[1].toUpperCase();
  }

  return null;
}

// 判断媒体是否为竖屏视频
function isPortraitMedia(item) {
  if (item && item.videoMediaMetadata) {
    const { width, height } = item.videoMediaMetadata;
    if (width && height && height > width) return true;
  }
  return false;
}

// 检测当前浏览器是否能原生使用内置内核播放该视频
function canBrowserPlayNatively(item) {
  if (!item.isVideo && !item.isAudio) return false;
  if (item.isAudio) return true; // 音频格式 (mp3, wav, flac, ogg, aac) 原生广泛支持

  const ext = (item.name.includes(".") ? item.name.split(".").pop() : "").toLowerCase();
  // 现代浏览器 <video> 无法原生解封装的容器格式
  const unplayableContainers = ["mkv", "avi", "flv", "wmv", "rmvb", "mov", "ts", "vob", "iso"];
  if (unplayableContainers.includes(ext)) {
    return false;
  }

  // 针对 HEVC/H.265 编码检查（部分系统浏览器未安装 HEVC 硬解支持）
  const isHevc = /hevc|h265|x265|10bit/i.test(item.name);
  if (isHevc) {
    const testVideo = document.createElement("video");
    const canPlayHevc = !!(
      testVideo.canPlayType('video/mp4; codecs="hevc"') ||
      testVideo.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
      testVideo.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')
    );
    if (!canPlayHevc) return false;
  }

  return true;
}

// 辅助工具：全局 Toast
let toastTimer = null;
function showToast(message) {
  dom.toastMessage.textContent = message;
  dom.toast.classList.remove("translate-y-20", "opacity-0");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.classList.add("translate-y-20", "opacity-0");
  }, 2500);
}

// 获取网站配置及状态
async function checkSystemInfo() {
  try {
    const res = await fetch(`/api/info?_t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (!data.configured) {
        dom.configGuideModal.classList.remove("hidden");
        dom.configGuideModal.classList.add("flex");
      } else {
        if (data.siteName) {
          dom.siteTitle.textContent = data.siteName;
          document.title = data.siteName;
        }

        const rootId = data.rootFolderId || "root";
        const rootName = data.rootName || "主云盘";
        state.rootFolderId = rootId;
        state.rootName = rootName;

        state.currentFolderId = rootId;
        state.breadcrumbs = [{ id: rootId, name: rootName }];
        renderBreadcrumbs();
        loadFolder(rootId);
      }
    }
  } catch (err) {
    console.warn("未能获取系统信息:", err);
  }
}

// 加载指定文件夹内容
async function loadFolder(folderId, searchKeyword = "") {
  showLoading(true);
  state.currentPage = 1;
  try {
    let url = `/api/list?folderId=${encodeURIComponent(folderId)}`;
    if (searchKeyword.trim()) {
      url += `&search=${encodeURIComponent(searchKeyword.trim())}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "获取列表失败");
    }

    state.items = data.items || [];
    if (data.currentFolder && !searchKeyword.trim()) {
      const last = state.breadcrumbs[state.breadcrumbs.length - 1];
      if (last && last.id === folderId) {
        last.name = data.currentFolder.name;
      }
    }

    applyFilterAndSort();
    renderBreadcrumbs();
  } catch (err) {
    showToast(`加载出错: ${err.message}`);
    state.items = [];
    applyFilterAndSort();
  } finally {
    showLoading(false);
  }
}

// 筛选与排序
function applyFilterAndSort() {
  let list = [...state.items];

  list.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;

    switch (state.sortBy) {
      case "name_asc":
        return a.name.localeCompare(b.name, "zh-CN", { numeric: true });
      case "name_desc":
        return b.name.localeCompare(a.name, "zh-CN", { numeric: true });
      case "time_desc":
        return new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0);
      case "size_desc":
        return (b.size || 0) - (a.size || 0);
      case "size_asc":
        return (a.size || 0) - (b.size || 0);
      default:
        return 0;
    }
  });

  state.filteredItems = list;
  renderItems();
}

// 滚动回到文件区域顶部
function scrollToFilesTop() {
  const target = document.getElementById("breadcrumbs") || dom.fileCount;
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// 渲染分页控件与页码（支持 15/30/50/100/全部）
function renderPagination(total, totalPages, pageSize, startNum, endNum) {
  if (!dom.paginationBar || totalPages <= 1) {
    if (dom.paginationBar) dom.paginationBar.classList.add("hidden");
    return;
  }

  dom.paginationBar.classList.remove("hidden");
  dom.paginationBar.classList.add("flex");

  if (dom.paginationInfo) {
    dom.paginationInfo.innerHTML = `
      显示第 <span class="font-medium text-slate-200">${startNum}</span> - <span class="font-medium text-slate-200">${endNum}</span> 项，共 <span class="font-medium text-slate-200">${total}</span> 项
    `;
  }

  if (!dom.paginationControls) return;

  const current = state.currentPage;
  let buttonsHtml = "";

  // 1. 上一页按钮
  const prevDisabled = current <= 1;
  buttonsHtml += `
    <button 
      class="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 ${
        prevDisabled ? "opacity-35 cursor-not-allowed hover:bg-slate-900 hover:text-slate-300" : "cursor-pointer"
      }" 
      data-page-action="prev" 
      ${prevDisabled ? "disabled" : ""}
      title="上一页"
    >
      <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
      <span class="hidden sm:inline">上一页</span>
    </button>
  `;

  // 2. 紧凑型页码生成算法
  const getPageNumbers = (curr, max) => {
    if (max <= 7) return Array.from({ length: max }, (_, i) => i + 1);
    if (curr <= 4) return [1, 2, 3, 4, 5, "...", max];
    if (curr >= max - 3) return [1, "...", max - 4, max - 3, max - 2, max - 1, max];
    return [1, "...", curr - 1, curr, curr + 1, "...", max];
  };

  const pages = getPageNumbers(current, totalPages);
  pages.forEach((p) => {
    if (p === "...") {
      buttonsHtml += `<span class="px-1.5 py-1 text-slate-600 font-semibold select-none">...</span>`;
    } else {
      const isCur = p === current;
      buttonsHtml += `
        <button 
          class="w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
            isCur
              ? "bg-brand-500 text-white shadow-md shadow-brand-500/20 cursor-default"
              : "border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          }" 
          data-page-num="${p}"
          ${isCur ? "disabled" : ""}
        >
          ${p}
        </button>
      `;
    }
  });

  // 3. 下一页按钮
  const nextDisabled = current >= totalPages;
  buttonsHtml += `
    <button 
      class="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 ${
        nextDisabled ? "opacity-35 cursor-not-allowed hover:bg-slate-900 hover:text-slate-300" : "cursor-pointer"
      }" 
      data-page-action="next" 
      ${nextDisabled ? "disabled" : ""}
      title="下一页"
    >
      <span class="hidden sm:inline">下一页</span>
      <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
    </button>
  `;

  dom.paginationControls.innerHTML = buttonsHtml;

  // 绑定翻页交互
  dom.paginationControls.querySelectorAll("[data-page-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-page-action");
      if (action === "prev" && state.currentPage > 1) {
        state.currentPage--;
        renderItems();
        scrollToFilesTop();
      } else if (action === "next" && state.currentPage < totalPages) {
        state.currentPage++;
        renderItems();
        scrollToFilesTop();
      }
    });
  });

  dom.paginationControls.querySelectorAll("[data-page-num]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = parseInt(btn.getAttribute("data-page-num"), 10);
      if (page && page !== state.currentPage) {
        state.currentPage = page;
        renderItems();
        scrollToFilesTop();
      }
    });
  });
}

// 渲染视图 (支持分页切片渲染，防止一次性渲染过多内容导致卡顿)
function renderItems() {
  const total = state.filteredItems.length;
  dom.fileCount.textContent = `共 ${total} 个项目`;

  if (total === 0) {
    dom.emptyState.classList.remove("hidden");
    dom.emptyState.classList.add("flex");
    dom.gridView.innerHTML = "";
    dom.listTbody.innerHTML = "";
    if (dom.paginationBar) dom.paginationBar.classList.add("hidden");
    return;
  }

  dom.emptyState.classList.add("hidden");
  dom.emptyState.classList.remove("flex");

  // 根据当前每页可见数量 (pageSize) 切片出当前页项目
  let pageItems = state.filteredItems;
  if (state.pageSize !== "all") {
    const size = typeof state.pageSize === "number" ? state.pageSize : 30;
    const totalPages = Math.max(1, Math.ceil(total / size));

    // 纠偏当前页码范围
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const startIdx = (state.currentPage - 1) * size;
    const endIdx = Math.min(startIdx + size, total);
    pageItems = state.filteredItems.slice(startIdx, endIdx);

    renderPagination(total, totalPages, size, startIdx + 1, endIdx);
  } else {
    if (dom.paginationBar) dom.paginationBar.classList.add("hidden");
  }

  if (state.viewMode === "grid") {
    dom.gridView.classList.remove("hidden");
    dom.listView.classList.add("hidden");
    renderGridView(pageItems);
  } else {
    dom.gridView.classList.add("hidden");
    dom.listView.classList.remove("hidden");
    renderListView(pageItems);
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 渲染网格视图
function renderGridView(items) {
  dom.gridView.innerHTML = items
    .map((item) => {
      const { icon, color } = getFileIcon(item);
      const isMedia = item.isVideo || item.isAudio;
      const streamUrl = `/api/stream/${item.id}`;
      const downloadUrl = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;
      const thumbUrl = getHighResThumb(item, 640);
      const ext = item.name.includes(".") ? item.name.split(".").pop().toUpperCase() : "";
      const resBadge = getVideoResolution(item);

      // 缩略图海报区域 (视频或图片)
      let mediaPosterHtml = "";
      if (thumbUrl && (item.isVideo || item.isImage)) {
        mediaPosterHtml = `
          <div class="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900 mb-3 border border-slate-800/80 group-hover:border-brand-500/40 transition-colors">
            <img src="${thumbUrl}" alt="${item.name}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onerror="this.parentElement.style.display='none'">
            ${
              item.isVideo
                ? `<div class="absolute inset-0 bg-black/25 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                    <div class="w-10 h-10 rounded-full bg-brand-500/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <i data-lucide="play" class="w-5 h-5 fill-white ml-0.5"></i>
                    </div>
                  </div>`
                : ""
            }
            ${
              resBadge
                ? `<div class="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                    <span class="inline-flex items-center px-2 py-0.5 text-[9px] font-black tracking-widest uppercase text-white rounded-full bg-gradient-to-r from-amber-500/90 to-orange-600/95 backdrop-blur-md border border-white/25 shadow-[0_2px_8px_rgba(249,115,22,0.45)] transition-transform duration-200 group-hover:scale-105">${resBadge}</span>
                  </div>`
                : ""
            }
            <div class="absolute bottom-1.5 right-1.5 z-10 pointer-events-none">
              ${
                ext
                  ? `<span class="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase text-slate-200 rounded-md bg-black/65 backdrop-blur-md border border-white/15 shadow-[0_2px_6px_rgba(0,0,0,0.5)]">${ext}</span>`
                  : ""
              }
            </div>
          </div>
        `;
      }

      return `
        <div class="glass-card rounded-xl p-3.5 flex flex-col justify-between group cursor-pointer relative" data-id="${item.id}" data-type="${item.isFolder ? "folder" : "file"}">
          ${!mediaPosterHtml && resBadge ? `<span class="absolute top-2.5 right-2.5 text-[9px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 font-black tracking-widest uppercase">${resBadge}</span>` : ""}
          <div>
            ${mediaPosterHtml}
            <div class="flex items-start gap-3">
              ${
                !mediaPosterHtml
                  ? `<div class="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 ${color}">
                      <i data-lucide="${icon}" class="w-5 h-5"></i>
                    </div>`
                  : ""
              }
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-slate-200 line-clamp-2 break-all group-hover:text-brand-500 transition-colors leading-snug" title="${item.name}">
                  ${item.name}
                </h4>
                <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  ${
                    item.isFolder
                      ? `<span class="text-amber-400 font-medium">${item.itemCount || 0} 个文件</span> · <span>${formatBytes(item.size)}</span>`
                      : `<span>${formatBytes(item.size)}</span>`
                  }
                </p>
              </div>
            </div>
          </div>

          <div class="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
            <span class="truncate">${formatDate(item.modifiedTime)}</span>
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
              ${
                isMedia
                  ? `<button class="p-1.5 hover:text-brand-500 rounded hover:bg-slate-800 play-btn" data-id="${item.id}" data-name="${item.name}" data-video="${item.isVideo}" title="立即播放">
                      <i data-lucide="play" class="w-3.5 h-3.5"></i>
                    </button>`
                  : ""
              }
              ${
                !item.isFolder
                  ? `<a href="${downloadUrl}" download class="p-1.5 hover:text-slate-200 rounded hover:bg-slate-800" title="下载">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    </a>
                    <button class="p-1.5 hover:text-slate-200 rounded hover:bg-slate-800 copy-link-btn" data-url="${window.location.origin}${streamUrl}" title="复制直链">
                      <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  bindItemEvents(dom.gridView);
}

// 渲染列表视图 (不显示格式信息和分辨率标签，保持极简纯净排版)
function renderListView(items) {
  dom.listTbody.innerHTML = items
    .map((item) => {
      const { icon, color } = getFileIcon(item);
      const isMedia = item.isVideo || item.isAudio;
      const streamUrl = `/api/stream/${item.id}`;
      const downloadUrl = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;
      const thumbUrl = getHighResThumb(item, 120);

      return `
        <tr class="file-row cursor-pointer group" data-id="${item.id}" data-type="${item.isFolder ? "folder" : "file"}">
          <td class="px-4 py-2.5 flex items-center gap-3 min-w-0">
            ${
              thumbUrl && (item.isVideo || item.isImage)
                ? `<div class="w-10 h-7 rounded overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0">
                    <img src="${thumbUrl}" alt="" class="w-full h-full object-cover">
                  </div>`
                : `<div class="${color} flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    <i data-lucide="${icon}" class="w-4 h-4"></i>
                  </div>`
            }
            <span class="font-medium text-slate-200 group-hover:text-brand-500 transition-colors break-all leading-normal" title="${item.name}">
              ${item.name}
            </span>
            ${
              item.isFolder
                ? `<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex-shrink-0">${item.itemCount || 0} 个文件</span>`
                : ""
            }
          </td>
          <td class="px-4 py-2.5 text-xs text-slate-400 hidden md:table-cell">
            ${formatBytes(item.size)}
          </td>
          <td class="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell">
            ${formatDate(item.modifiedTime)}
          </td>
          <td class="px-4 py-2.5 text-right" onclick="event.stopPropagation()">
            <div class="flex items-center justify-end gap-1">
              ${
                isMedia
                  ? `<button class="p-1.5 hover:text-brand-500 rounded hover:bg-slate-800 text-slate-400 play-btn" data-id="${item.id}" data-name="${item.name}" data-video="${item.isVideo}" title="立即播放">
                      <i data-lucide="play" class="w-3.5 h-3.5"></i>
                    </button>`
                  : ""
              }
              ${
                !item.isFolder
                  ? `<a href="${downloadUrl}" download class="p-1.5 hover:text-slate-200 rounded hover:bg-slate-800 text-slate-400" title="下载">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    </a>
                    <button class="p-1.5 hover:text-slate-200 rounded hover:bg-slate-800 text-slate-400 copy-link-btn" data-url="${window.location.origin}${streamUrl}" title="复制直链">
                      <i data-lucide="copy" class="w-4 h-4"></i>
                    </button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  bindItemEvents(dom.listTbody);
}

// 绑定卡片与列表行点击事件
function bindItemEvents(container) {
  container.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      const type = el.getAttribute("data-type");
      const item = state.items.find((i) => i.id === id);
      if (!item) return;

      if (type === "folder") {
        navigateToFolder(item.id, item.name);
      } else if (item.isVideo || item.isAudio) {
        openMediaPlayer(item);
      } else if (item.isImage) {
        openImagePreview(item);
      } else {
        window.open(`/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`, "_blank");
      }
    });
  });

  container.querySelectorAll(".play-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const item = state.items.find((i) => i.id === id);
      if (item) openMediaPlayer(item);
    });
  });

  container.querySelectorAll(".copy-link-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const url = btn.getAttribute("data-url");
      try {
        await navigator.clipboard.writeText(url);
        showToast("已复制直链到剪贴板！");
      } catch (err) {
        showToast("复制失败，请手动复制");
      }
    });
  });
}

// 导航到指定文件夹
function navigateToFolder(folderId, folderName) {
  // 如果点击的是根目录，直接重置面包屑为单一根项
  if (folderId === state.rootFolderId) {
    state.breadcrumbs = [{ id: state.rootFolderId, name: state.rootName }];
    state.currentFolderId = state.rootFolderId;
    dom.searchInput.value = "";
    state.searchQuery = "";
    dom.clearSearchBtn.classList.add("hidden");
    loadFolder(state.rootFolderId);
    return;
  }

  // 如果当前在根目录，而点击的子项名称与根目录同名（如根叫“我的媒体库”，里面又放了一个“我的媒体库”文件夹/快捷方式）
  // 保持单层根名称，更新 ID 为真实文件夹 ID，绝不出现“我的媒体库 > 我的媒体库”
  if (state.breadcrumbs.length === 1 && folderName === state.breadcrumbs[0].name) {
    state.breadcrumbs[0].id = folderId;
    state.currentFolderId = folderId;
    dom.searchInput.value = "";
    state.searchQuery = "";
    dom.clearSearchBtn.classList.add("hidden");
    loadFolder(folderId);
    return;
  }

  const existingIdx = state.breadcrumbs.findIndex((b) => b.id === folderId);
  if (existingIdx !== -1) {
    state.breadcrumbs = state.breadcrumbs.slice(0, existingIdx + 1);
  } else {
    // 检查防止同名连续堆叠
    const lastCrumb = state.breadcrumbs[state.breadcrumbs.length - 1];
    if (lastCrumb && lastCrumb.name === folderName) {
      lastCrumb.id = folderId;
    } else {
      state.breadcrumbs.push({ id: folderId, name: folderName });
    }
  }

  state.currentFolderId = folderId;
  dom.searchInput.value = "";
  state.searchQuery = "";
  dom.clearSearchBtn.classList.add("hidden");

  loadFolder(folderId);
}

// 渲染面包屑导航
function renderBreadcrumbs() {
  // 安全去重：消除任何连续同名的层级（如“我的媒体库 > 我的媒体库”）
  const dedupedCrumbs = [];
  state.breadcrumbs.forEach((b) => {
    if (dedupedCrumbs.length === 0 || dedupedCrumbs[dedupedCrumbs.length - 1].name !== b.name) {
      dedupedCrumbs.push(b);
    }
  });
  state.breadcrumbs = dedupedCrumbs;

  dom.breadcrumbs.innerHTML = state.breadcrumbs
    .map((b, idx) => {
      const isLast = idx === state.breadcrumbs.length - 1;
      const isRoot = idx === 0;
      return `
        <div class="flex items-center gap-1.5">
          ${idx > 0 ? `<i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-600 flex-shrink-0"></i>` : ""}
          <button 
            class="px-2 py-1 rounded transition-colors flex items-center gap-1.5 ${
              isLast && !isRoot
                ? "text-brand-400 font-semibold cursor-default"
                : "text-slate-300 hover:text-white hover:bg-slate-800/80 cursor-pointer"
            }" 
            data-crumb-id="${b.id}"
            data-crumb-idx="${idx}"
            title="${isRoot ? "点击返回主界面" : b.name}"
          >
            ${isRoot ? `<i data-lucide="hard-drive" class="w-3.5 h-3.5 text-brand-500 flex-shrink-0"></i>` : ""}
            <span>${b.name}</span>
          </button>
        </div>
      `;
    })
    .join("");

  dom.breadcrumbs.querySelectorAll("[data-crumb-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-crumb-id");
      const idx = parseInt(btn.getAttribute("data-crumb-idx"), 10);

      // 点击第一项（我的媒体库），无条件返回主界面
      if (idx === 0) {
        state.breadcrumbs = [{ id: state.rootFolderId, name: state.rootName }];
        navigateToFolder(state.rootFolderId, state.rootName);
        return;
      }

      if (id !== state.currentFolderId) {
        const item = state.breadcrumbs.find((b) => b.id === id);
        navigateToFolder(id, item ? item.name : "文件夹");
      }
    });
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 更新画质源切换按钮 UI
function updateStreamSourceUI() {
  const item = state.activeMediaItem;
  if (!item || !item.isVideo || !dom.streamSourceToggleBtn) {
    if (dom.streamSourceToggleBtn) dom.streamSourceToggleBtn.classList.add("hidden");
    return;
  }

  const resBadge = getVideoResolution(item);
  const is4K = resBadge === "4K" || /(4k|2160p|uhd)/i.test(item.name);
  const canPlayNatively = canBrowserPlayNatively(item);

  dom.streamSourceToggleBtn.classList.remove("hidden");
  dom.streamSourceToggleBtn.classList.add("flex");

  if (state.isGooglePreview) {
    if (is4K && !canPlayNatively) {
      dom.streamSourceText.textContent = "⚡ 4K 原画硬解 (外部播放器)";
      dom.streamSourceToggleBtn.className =
        "px-2.5 py-0.5 rounded-md text-[11px] font-semibold items-center gap-1 transition-all flex-shrink-0 cursor-pointer shadow-sm border bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border-amber-500/30";
      dom.streamSourceToggleBtn.title = "MKV 封装浏览器无法原生硬解 4K，点击一键唤出 MPV / ExoPlayer 进行 4K 无损硬件直出！";
    } else {
      dom.streamSourceText.textContent = is4K ? "⚡ 切换 4K 原画 (直链)" : "⚡ 切换原画 (直链)";
      dom.streamSourceToggleBtn.className =
        "px-2.5 py-0.5 rounded-md text-[11px] font-semibold items-center gap-1 transition-all flex-shrink-0 cursor-pointer shadow-sm border bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700";
      dom.streamSourceToggleBtn.title = is4K
        ? "当前为 Google 云端转码预览 (Google 官方封顶 1080P)。点击即可无缝切换为 4K (2160p) 无损原画！"
        : "当前为 Google 预览，点击切换为原始视频直链播放";
    }
  } else {
    dom.streamSourceText.textContent = is4K ? "⚡ 4K 原画 (当前)" : "⚡ 原画 (当前)";
    dom.streamSourceToggleBtn.className =
      "px-2.5 py-0.5 rounded-md text-[11px] font-semibold items-center gap-1 transition-all flex-shrink-0 cursor-pointer shadow-sm border bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 border-emerald-500/30";
    dom.streamSourceToggleBtn.title = "当前为无损原画输出。点击可切换为 Google 云端转码预览 (最高1080P)";
  }
}

// 获取同名/连续剧剧集列表（或者当前文件夹内的媒体列表），按集数自然升序排列
function getEpisodePlaylist(currentItem) {
  if (!currentItem) return [];
  const isVideo = currentItem.isVideo;
  const isAudio = currentItem.isAudio;

  // 1. 先过滤出同大类的媒体文件 (全为视频或全为音频)
  const allMedia = (state.items || []).filter((i) => (isVideo ? i.isVideo : isAudio ? i.isAudio : false));
  if (allMedia.length <= 1) return allMedia;

  // 提取文件名前缀（去扩展名、去掉末尾数字/集数标记如 EP01, E01, 第01集, .01, _01, -01）
  const getCleanPrefix = (name) => {
    return name
      .replace(/\.[a-zA-Z0-9]+$/, "") // 剥除扩展名
      .replace(/(?:[._\-\s]*(?:ep|e|第)?\s*\d+\s*(?:集|话|期)?|[._\-\s]*\d+)\s*$/i, "") // 剥除末尾集数
      .replace(/[._\-\s]+$/, "")
      .trim()
      .toLowerCase();
  };

  const currentPrefix = getCleanPrefix(currentItem.name);

  // 寻找与当前文件同名前缀的集合（例如都包含“进击的巨人”、“火影忍者”等）
  let matchedGroup = allMedia.filter((item) => {
    if (item.id === currentItem.id) return true;
    if (!currentPrefix || currentPrefix.length < 2) return false;
    const itemPrefix = getCleanPrefix(item.name);
    return itemPrefix === currentPrefix || itemPrefix.startsWith(currentPrefix) || currentPrefix.startsWith(itemPrefix);
  });

  // 如果没有找到同名前缀的多集内容，则回退为当前整个文件夹目录内的同类媒体（保证音乐专辑或未统一命名的剧集也能顺畅连播）
  const targetPlaylist = matchedGroup.length > 1 ? matchedGroup : allMedia;

  // 使用自然数排序（确保 1, 2, ..., 9, 10, 11 不会乱序）
  return targetPlaylist.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
}

// 播放相邻集数 (方向: 1 下一集, -1 上一集)
function playAdjacentEpisode(direction = 1) {
  const current = state.activeMediaItem;
  if (!current) return;

  const playlist = getEpisodePlaylist(current);
  if (!playlist || playlist.length <= 1) {
    showToast(direction > 0 ? "已是最后一集" : "已是第一集");
    return;
  }

  const currentIndex = playlist.findIndex((i) => i.id === current.id);
  if (currentIndex === -1) return;

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0) {
    showToast("已是第一集");
    return;
  }
  if (targetIndex >= playlist.length) {
    showToast("全部剧集已播放完毕！");
    return;
  }

  const targetItem = playlist[targetIndex];
  const actionText = direction > 0 ? "下一集" : "上一集";
  showToast(`正在播放${actionText}: ${targetItem.name.replace(/\.[a-zA-Z0-9]+$/, "")}`);
  openMediaPlayer(targetItem);
}

// 更新连播与上一集/下一集按钮状态
function updateAutoplayUI() {
  if (dom.playerAutoplayToggleBtn) {
    if (state.autoPlayNext) {
      dom.playerAutoplayToggleBtn.classList.remove("text-slate-400");
      dom.playerAutoplayToggleBtn.classList.add("text-brand-400", "bg-brand-500/15");
      if (dom.playerAutoplayText) dom.playerAutoplayText.textContent = "连播: 开";
      dom.playerAutoplayToggleBtn.title = "自动连播已开启 (播完自动切下一集)";
    } else {
      dom.playerAutoplayToggleBtn.classList.add("text-slate-400");
      dom.playerAutoplayToggleBtn.classList.remove("text-brand-400", "bg-brand-500/15");
      if (dom.playerAutoplayText) dom.playerAutoplayText.textContent = "连播: 关";
      dom.playerAutoplayToggleBtn.title = "自动连播已关闭 (点击开启)";
    }
  }

  // 检查上一集/下一集是否存在
  if (state.activeMediaItem) {
    const playlist = getEpisodePlaylist(state.activeMediaItem);
    const currIdx = playlist.findIndex((i) => i.id === state.activeMediaItem.id);
    if (dom.playerPrevBtn) {
      dom.playerPrevBtn.disabled = currIdx <= 0;
      dom.playerPrevBtn.title = currIdx > 0 ? `上一集: ${playlist[currIdx - 1].name}` : "已是第一集";
    }
    if (dom.playerNextBtn) {
      dom.playerNextBtn.disabled = currIdx === -1 || currIdx >= playlist.length - 1;
      dom.playerNextBtn.title = currIdx < playlist.length - 1 ? `下一集: ${playlist[currIdx + 1].name}` : "已是最后一集";
    }
  }
}

// 切换自动连播开关
function toggleAutoPlayNext() {
  state.autoPlayNext = !state.autoPlayNext;
  localStorage.setItem("auto_play_next", state.autoPlayNext ? "true" : "false");
  updateAutoplayUI();
  showToast(state.autoPlayNext ? "已开启同名连续剧自动连播" : "已关闭自动连播");
}

// 打开流媒体播放器
function openMediaPlayer(item) {
  destroyPlayer();
  state.activeMediaItem = item;
  state.isGooglePreview = false;

  // 播放时标题纯净展示：不显示后缀名和分辨率
  const cleanTitle = item.name.replace(/\.[a-zA-Z0-9]+$/, "");
  dom.playerFileName.textContent = cleanTitle;
  dom.playerFileName.title = item.name;
  dom.playerDownloadBtn.href = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;

  // 针对竖屏与横屏视频自适应调整弹窗宽高
  const isPortrait = isPortraitMedia(item);
  if (dom.playerDialog) {
    dom.playerDialog.classList.remove("w-screen", "h-screen", "max-w-none", "max-h-none", "rounded-none", "border-0");
    dom.playerDialog.classList.add("rounded-2xl", "border", "border-slate-800", "transition-all", "duration-300");
    if (isPortrait) {
      dom.playerDialog.classList.remove("max-w-6xl", "h-[80vh]");
      dom.playerDialog.classList.add("max-w-md", "sm:max-w-lg", "h-[88vh]");
    } else {
      dom.playerDialog.classList.remove("max-w-md", "sm:max-w-lg", "h-[88vh]");
      dom.playerDialog.classList.add("max-w-6xl", "h-[80vh]");
    }
  }

  const streamUrl = `${window.location.origin}/api/stream/${item.id}`;
  dom.playerCopyLinkBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(streamUrl);
      showToast("已复制媒体直链！");
    } catch (_) {}
  };

  // 配置外部专业播放器链接（针对 MKV / HEVC 10bit 秒播）
  if (dom.btnMpv) {
    dom.btnMpv.href = `mpv://${streamUrl}`;
  }
  if (dom.btnExoplayer) {
    // 触发 Android 原生 Intent，唤起内置 ExoPlayer 内核的播放器（如 Just Player, Next Player, VLC）
    dom.btnExoplayer.href = `intent:${streamUrl}#Intent;action=android.intent.action.VIEW;type=video/*;end`;
  }
  if (dom.btnPotplayer) dom.btnPotplayer.href = `potplayer://${streamUrl}`;
  if (dom.btnVlc) dom.btnVlc.href = `vlc://${streamUrl}`;
  if (dom.btnIina) dom.btnIina.href = `iina://weblink?url=${encodeURIComponent(streamUrl)}`;
  if (dom.btnInfuse) dom.btnInfuse.href = `infuse://open?url=${encodeURIComponent(streamUrl)}`;

  // 一键复制 MPV 终端命令
  if (dom.btnCopyMpvCmd) {
    dom.btnCopyMpvCmd.onclick = async () => {
      try {
        await navigator.clipboard.writeText(`mpv "${streamUrl}"`);
        showToast("已复制 MPV 播放命令！终端直接粘贴回车即可秒播");
      } catch (_) {
        showToast("复制失败，请手动复制直链");
      }
    };
  }

  // 4K 与视频格式智能起播策略
  if (item.isVideo) {
    dom.playerTypeIcon.setAttribute("data-lucide", "film");
    const resBadge = getVideoResolution(item);
    const is4K = resBadge === "4K" || /(4k|2160p|uhd)/i.test(item.name);
    const canPlayNatively = canBrowserPlayNatively(item);

    // 如果是 4K 且浏览器能原生解码，直接以真 4K 原画流启动，彻底突破 Google 预览 1080P 上限！
    if (is4K && canPlayNatively) {
      renderPlayerMedia(item, streamUrl);
      dom.codecWarningBanner.classList.add("hidden");
    } else {
      // 默认走 Google 预览通道
      renderGooglePreview(item);
      // 针对 4K 提示 Google 限制
      if (is4K) {
        dom.codecWarningBanner.classList.remove("hidden");
        const bannerSpan = dom.codecWarningBanner.querySelector("span");
        if (bannerSpan) {
          bannerSpan.innerHTML =
            "当前视频为 <strong>4K (2160p)</strong>。Google 官方云端转码最高封顶 1080P；如需观赏真 4K 原画，可点击标题旁<strong>「⚡ 切换 4K 原画」</strong>或点击右上角使用 <strong>MPV / ExoPlayer</strong> 硬件直出！";
        }
      } else {
        const isSpecialFormat = /\.(mkv|avi|flv|wmv|ts)$/i.test(item.name) || /10bit|hevc|h265/i.test(item.name);
        if (isSpecialFormat) {
          dom.codecWarningBanner.classList.remove("hidden");
        } else {
          dom.codecWarningBanner.classList.add("hidden");
        }
      }
    }
  } else {
    dom.playerTypeIcon.setAttribute("data-lucide", "music");
    dom.codecWarningBanner.classList.add("hidden");
    renderPlayerMedia(item, streamUrl);
  }

  updateStreamSourceUI();
  updateAutoplayUI();

  dom.playerModal.classList.remove("hidden");
  dom.playerModal.classList.add("flex");

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 渲染 Google 官方转码预览（所有视频格式统一采用 Google 预览最高画质通道）
function renderGooglePreview(item) {
  destroyPlayer();
  state.isGooglePreview = true;
  const isPortrait = isPortraitMedia(item);

  // 解析目标分辨率，强制指定 Google 预览播放最高画质
  const resBadge = getVideoResolution(item);
  let vqParam = "highres";
  if (resBadge === "4K") vqParam = "hd2160";
  else if (resBadge === "2K") vqParam = "hd1440";
  else if (resBadge === "1080P") vqParam = "hd1080";
  else if (resBadge === "720P") vqParam = "hd720";

  const previewUrl = `https://drive.google.com/file/d/${item.id}/preview?autoplay=1&vq=${vqParam}`;

  // 严格隔离模式：iframe 禁用 allow-popups 与 allow-popups-to-escape-sandbox，并从 DOM 级别封死所有新窗口/弹窗跳转！
  // 同时右上角覆盖全透明屏障阻断光标悬浮触发，彻底杜绝 Google 弹出新窗口问题！
  dom.mediaWrapper.innerHTML = `
    <div id="google-preview-container" class="relative w-full h-full overflow-hidden bg-black ${state.isPlayerMaximized ? "" : "rounded-b-2xl"}">
      <iframe 
        id="google-drive-iframe"
        src="${previewUrl}" 
        class="border-0 w-full h-full" 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        loading="eager"
      ></iframe>
      <!-- 右上角完全透明安全防护罩：彻底拦截任何点击或悬停动作，无黑点，不遮挡画面 -->
      <div 
        class="absolute top-0 right-0 w-28 h-20 z-30 cursor-default" 
        style="background: transparent; pointer-events: auto;"
        onclick="event.stopPropagation(); event.preventDefault();"
        onmousedown="event.stopPropagation(); event.preventDefault();"
        onmouseup="event.stopPropagation(); event.preventDefault();"
      ></div>
    </div>
  `;
  updateStreamSourceUI();
}

// 渲染播放器内部内容
function renderPlayerMedia(item, streamUrl) {
  destroyPlayer();
  state.isGooglePreview = false;
  dom.mediaWrapper.innerHTML = "";

  if (item.isVideo) {
    dom.playerTypeIcon.setAttribute("data-lucide", "film");
    const video = document.createElement("video");
    video.id = "active-player";
    video.playsInline = true;
    video.controls = true;
    video.crossOrigin = "anonymous";
    video.src = streamUrl;
    video.className = "w-full h-full";
    video.style.objectFit = "contain";

    // 监听播放异常：若浏览器内置内核在拉流或解码时抛错，立即自动无缝切换为 Google 预览
    video.addEventListener("error", () => {
      dom.codecWarningBanner.classList.remove("hidden");
      renderGooglePreview(item);
      showToast("当前浏览器内核无法解码画面，已自动为你切换为 Google 预览");
    });

    dom.mediaWrapper.appendChild(video);

    state.playerInstance = new Plyr(video, {
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      keyboard: { focused: true, global: true },
      autoplay: true,
      ratio: null,
      resetOnEnd: true,
    });

    // 监听视频播完事件：若开启了连播，自动连播同名/连续剧下一集
    state.playerInstance.on("ended", () => {
      if (state.autoPlayNext) {
        playAdjacentEpisode(1);
      }
    });
  } else {
    dom.playerTypeIcon.setAttribute("data-lucide", "music");
    const audio = document.createElement("audio");
    audio.id = "active-player";
    audio.controls = true;
    audio.src = streamUrl;
    audio.className = "w-full p-4";
    dom.mediaWrapper.appendChild(audio);

    state.playerInstance = new Plyr(audio, {
      autoplay: true,
    });

    // 监听音频播完事件：自动下一曲
    state.playerInstance.on("ended", () => {
      if (state.autoPlayNext) {
        playAdjacentEpisode(1);
      }
    });
  }

  updateStreamSourceUI();
}

// 在 Google 预览 与 4K/原始无损原画直链之间一秒热切换
function toggleStreamSource() {
  const item = state.activeMediaItem;
  if (!item || !item.isVideo) return;

  const streamUrl = `${window.location.origin}/api/stream/${item.id}`;
  const resBadge = getVideoResolution(item);
  const is4K = resBadge === "4K" || /(4k|2160p|uhd)/i.test(item.name);
  const canPlayNatively = canBrowserPlayNatively(item);

  if (state.isGooglePreview) {
    if (!canPlayNatively) {
      // 浏览器内核原生不支持 MKV 封装，自动展开外部播放器菜单并提示
      dom.extPlayerMenu.classList.remove("hidden");
      showToast("MKV 封装浏览器无法直接硬解 4K，请在弹出的菜单中选择 MPV / ExoPlayer 本地秒播！");
      return;
    }
    showToast(is4K ? "正在切换至 4K (2160p) 无损原画播放..." : "正在切换至原画直链播放...");
    renderPlayerMedia(item, streamUrl);
  } else {
    showToast("正在切换至 Google 云端转码预览 (最高1080P)...");
    renderGooglePreview(item);
  }
}

// 切换播放器最大化 / 还原
function togglePlayerMaximize() {
  state.isPlayerMaximized = !state.isPlayerMaximized;

  const previewContainer = document.getElementById("google-preview-container");

  if (state.isPlayerMaximized) {
    // 最大化模式：纯 CSS 切换，撑满整个视口，iframe 毫秒不差平滑伸展，绝不重载视频！
    dom.playerModal.classList.remove("p-3", "sm:p-6");
    dom.playerModal.classList.add("p-0");

    dom.playerDialog.classList.remove("max-w-6xl", "max-w-md", "sm:max-w-lg", "h-[80vh]", "h-[88vh]", "rounded-2xl", "border", "border-slate-800");
    dom.playerDialog.classList.add("w-screen", "h-screen", "max-w-none", "max-h-none", "rounded-none", "border-0");

    if (previewContainer) {
      previewContainer.classList.remove("rounded-b-2xl");
    }

    if (dom.playerMaximizeBtn) {
      dom.playerMaximizeBtn.title = "还原窗口";
    }
    if (dom.playerMaximizeIcon) {
      dom.playerMaximizeIcon.setAttribute("data-lucide", "minimize-2");
    }
  } else {
    // 还原窗口模式：纯 CSS 恢复原有居中尺寸
    dom.playerModal.classList.add("p-3", "sm:p-6");
    dom.playerModal.classList.remove("p-0");

    dom.playerDialog.classList.remove("w-screen", "h-screen", "max-w-none", "max-h-none", "rounded-none", "border-0");
    dom.playerDialog.classList.add("rounded-2xl", "border", "border-slate-800");

    const isPortrait = isPortraitMedia(state.activeMediaItem);
    if (isPortrait) {
      dom.playerDialog.classList.remove("max-w-6xl", "h-[80vh]");
      dom.playerDialog.classList.add("max-w-md", "sm:max-w-lg", "h-[88vh]");
    } else {
      dom.playerDialog.classList.remove("max-w-md", "sm:max-w-lg", "h-[88vh]");
      dom.playerDialog.classList.add("max-w-6xl", "h-[80vh]");
    }

    if (previewContainer) {
      previewContainer.classList.add("rounded-b-2xl");
    }

    if (dom.playerMaximizeBtn) {
      dom.playerMaximizeBtn.title = "最大化窗口 (双击顶部栏也可最大化)";
    }
    if (dom.playerMaximizeIcon) {
      dom.playerMaximizeIcon.setAttribute("data-lucide", "maximize-2");
    }
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 关闭并销毁播放器
function closePlayer() {
  destroyPlayer();
  state.activeMediaItem = null;
  state.isGooglePreview = false;

  // 重置最大化状态
  if (state.isPlayerMaximized) {
    state.isPlayerMaximized = false;
    dom.playerModal.classList.add("p-3", "sm:p-6");
    dom.playerModal.classList.remove("p-0");
    dom.playerDialog.classList.remove("w-screen", "h-screen", "max-w-none", "max-h-none", "rounded-none", "border-0");
    if (dom.playerMaximizeIcon) {
      dom.playerMaximizeIcon.setAttribute("data-lucide", "maximize-2");
    }
  }

  if (dom.playerDialog) {
    dom.playerDialog.classList.remove("max-w-md", "sm:max-w-lg", "h-[88vh]", "w-screen", "h-screen", "max-w-none", "max-h-none", "rounded-none", "border-0");
    dom.playerDialog.classList.add("max-w-6xl", "h-[80vh]", "rounded-2xl", "border", "border-slate-800", "transition-all", "duration-300");
  }
  if (dom.streamSourceToggleBtn) {
    dom.streamSourceToggleBtn.classList.add("hidden");
    dom.streamSourceToggleBtn.classList.remove("flex");
  }
  dom.extPlayerMenu.classList.add("hidden");
  dom.playerModal.classList.add("hidden");
  dom.playerModal.classList.remove("flex");
}

function destroyPlayer() {
  if (state.playerInstance) {
    try {
      state.playerInstance.stop();
      state.playerInstance.destroy();
    } catch (_) {}
    state.playerInstance = null;
  }
  dom.mediaWrapper.innerHTML = "";
}

// 图片预览
function openImagePreview(item) {
  dom.imagePreview.src = `/api/stream/${item.id}`;
  dom.imageName.textContent = item.name;
  dom.imageModal.classList.remove("hidden");
  dom.imageModal.classList.add("flex");
}

function closeImagePreview() {
  dom.imageModal.classList.add("hidden");
  dom.imageModal.classList.remove("flex");
  dom.imagePreview.src = "";
}

// 显示 / 隐藏骨架屏
function showLoading(show) {
  if (show) {
    dom.loadingSkeleton.classList.remove("hidden");
    dom.gridView.classList.add("hidden");
    dom.listView.classList.add("hidden");
    dom.emptyState.classList.add("hidden");
  } else {
    dom.loadingSkeleton.classList.add("hidden");
  }
}

// 事件监听与初始化
function setupEventListeners() {
  // 返回当前根目录
  dom.btnHome.addEventListener("click", () => {
    state.breadcrumbs = [{ id: state.rootFolderId, name: state.rootName }];
    navigateToFolder(state.rootFolderId, state.rootName);
  });

  // 刷新按钮
  dom.refreshBtn.addEventListener("click", () => {
    loadFolder(state.currentFolderId, state.searchQuery);
  });

  // 视图模式切换
  dom.viewModeBtn.addEventListener("click", () => {
    state.viewMode = state.viewMode === "grid" ? "list" : "grid";
    localStorage.setItem("view_mode", state.viewMode);
    dom.viewIcon.setAttribute("data-lucide", state.viewMode === "grid" ? "layout-grid" : "list");
    renderItems();
  });

  // 排序切换
  dom.sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    state.currentPage = 1;
    applyFilterAndSort();
  });

  // 每页可见数量切换 (防止一次性渲染过多内容导致卡顿)
  if (dom.pageSizeSelect) {
    const savedPageSize = localStorage.getItem("page_size") || "30";
    dom.pageSizeSelect.value = savedPageSize;
    state.pageSize = savedPageSize === "all" ? "all" : parseInt(savedPageSize, 10) || 30;

    dom.pageSizeSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      state.pageSize = val === "all" ? "all" : parseInt(val, 10);
      localStorage.setItem("page_size", val);
      state.currentPage = 1;
      renderItems();
      showToast(`已调整每页显示数量为: ${val === "all" ? "全部" : val + " 条"}`);
    });
  }

  // 实时搜索防抖
  let searchTimeout = null;
  dom.searchInput.addEventListener("input", (e) => {
    const val = e.target.value;
    state.searchQuery = val;
    dom.clearSearchBtn.classList.toggle("hidden", !val);

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadFolder(state.currentFolderId, val);
    }, 400);
  });

  dom.clearSearchBtn.addEventListener("click", () => {
    dom.searchInput.value = "";
    state.searchQuery = "";
    dom.clearSearchBtn.classList.add("hidden");
    loadFolder(state.currentFolderId);
  });

  // 自动连播开关切换
  if (dom.playerAutoplayToggleBtn) {
    dom.playerAutoplayToggleBtn.addEventListener("click", toggleAutoPlayNext);
  }

  // 上一集 / 下一集点击切换
  if (dom.playerPrevBtn) {
    dom.playerPrevBtn.addEventListener("click", () => playAdjacentEpisode(-1));
  }
  if (dom.playerNextBtn) {
    dom.playerNextBtn.addEventListener("click", () => playAdjacentEpisode(1));
  }

  // 模态框关闭与最大化/还原
  dom.closePlayerBtn.addEventListener("click", closePlayer);
  if (dom.playerMaximizeBtn) {
    dom.playerMaximizeBtn.addEventListener("click", togglePlayerMaximize);
  }
  if (dom.playerHeader) {
    // 双击顶部标题栏快捷切换最大化/还原
    dom.playerHeader.addEventListener("dblclick", (e) => {
      // 避免点击到按钮时触发
      if (!e.target.closest("button") && !e.target.closest("a")) {
        togglePlayerMaximize();
      }
    });
  }
  dom.closeImageBtn.addEventListener("click", closeImagePreview);
  dom.closeGuideBtn.addEventListener("click", () => {
    dom.configGuideModal.classList.add("hidden");
    dom.configGuideModal.classList.remove("flex");
  });

  // 关闭编码兼容提示条
  if (dom.closeCodecWarningBtn) {
    dom.closeCodecWarningBtn.addEventListener("click", () => {
      dom.codecWarningBanner.classList.add("hidden");
    });
  }

  // 画质源切换 (4K 原画 与 Google 预览)
  if (dom.streamSourceToggleBtn) {
    dom.streamSourceToggleBtn.addEventListener("click", toggleStreamSource);
  }

  // 外部播放器菜单点击切换
  dom.extPlayerMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dom.extPlayerMenu.classList.toggle("hidden");
  });

  // 点击外部空白区域自动关闭所有菜单
  document.addEventListener("click", () => {
    dom.extPlayerMenu.classList.add("hidden");
  });

  // 键盘 Esc 关闭
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePlayer();
      closeImagePreview();
    }
  });

  // 点击遮罩背景关闭
  dom.playerModal.addEventListener("click", (e) => {
    if (e.target === dom.playerModal) closePlayer();
  });
  dom.imageModal.addEventListener("click", (e) => {
    if (e.target === dom.imageModal) closeImagePreview();
  });
}

// 启动入口
async function init() {
  setupEventListeners();
  if (state.viewMode === "list") {
    dom.viewIcon.setAttribute("data-lucide", "list");
  }
  await checkSystemInfo();
  if (state.currentDrive) {
    await loadFolder(state.currentDrive.id);
  }
}

document.addEventListener("DOMContentLoaded", init);
