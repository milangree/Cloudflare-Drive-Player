/**
 * Cloudflare Drive Player - 前端核心交互逻辑
 */

// 状态管理
const state = {
  currentFolderId: "root",
  breadcrumbs: [{ id: "root", name: "根目录" }],
  items: [],
  filteredItems: [],
  viewMode: localStorage.getItem("view_mode") || "grid",
  sortBy: "name_asc",
  searchQuery: "",
  playerInstance: null,
  activeMediaItem: null,
  isGooglePreview: false,
};

// DOM 元素引用
const dom = {
  siteTitle: document.getElementById("site-title"),
  btnHome: document.getElementById("btn-home"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  fileCount: document.getElementById("file-count"),
  sortSelect: document.getElementById("sort-select"),
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
  playerFileName: document.getElementById("player-file-name"),
  playerTypeIcon: document.getElementById("player-type-icon"),
  playerDownloadBtn: document.getElementById("player-download-btn"),
  playerCopyLinkBtn: document.getElementById("player-copy-link-btn"),
  closePlayerBtn: document.getElementById("close-player-btn"),
  mediaWrapper: document.getElementById("media-wrapper"),
  codecWarningBanner: document.getElementById("codec-warning-banner"),
  toggleGooglePreviewBtn: document.getElementById("toggle-google-preview-btn"),
  previewModeText: document.getElementById("preview-mode-text"),
  extPlayerMenuBtn: document.getElementById("ext-player-menu-btn"),
  extPlayerMenu: document.getElementById("ext-player-menu"),
  btnPotplayer: document.getElementById("btn-potplayer"),
  btnVlc: document.getElementById("btn-vlc"),
  btnIina: document.getElementById("btn-iina"),
  btnInfuse: document.getElementById("btn-infuse"),
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
    const res = await fetch("/api/info");
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
        if (data.rootFolderId) {
          state.currentFolderId = data.rootFolderId;
          state.breadcrumbs[0].id = data.rootFolderId;
          if (data.rootFolderName) {
            state.breadcrumbs[0].name = data.rootFolderName;
          }
        }
      }
    }
  } catch (err) {
    console.warn("未能获取系统信息:", err);
  }
}

// 加载指定文件夹内容
async function loadFolder(folderId, searchKeyword = "") {
  showLoading(true);
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

// 渲染视图
function renderItems() {
  const items = state.filteredItems;
  dom.fileCount.textContent = `共 ${items.length} 个项目`;

  if (items.length === 0) {
    dom.emptyState.classList.remove("hidden");
    dom.emptyState.classList.add("flex");
    dom.gridView.innerHTML = "";
    dom.listTbody.innerHTML = "";
    return;
  }

  dom.emptyState.classList.add("hidden");
  dom.emptyState.classList.remove("flex");

  if (state.viewMode === "grid") {
    dom.gridView.classList.remove("hidden");
    dom.listView.classList.add("hidden");
    renderGridView(items);
  } else {
    dom.gridView.classList.add("hidden");
    dom.listView.classList.remove("hidden");
    renderListView(items);
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 渲染网格视图 (增强视频缩略图海报预览)
function renderGridView(items) {
  dom.gridView.innerHTML = items
    .map((item) => {
      const { icon, color } = getFileIcon(item);
      const isMedia = item.isVideo || item.isAudio;
      const streamUrl = `/api/stream/${item.id}`;
      const downloadUrl = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;
      const thumbUrl = getHighResThumb(item, 640);
      const ext = item.name.includes(".") ? item.name.split(".").pop().toUpperCase() : "";

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
              ext
                ? `<span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-black/75 backdrop-blur text-white rounded">${ext}</span>`
                : ""
            }
          </div>
        `;
      }

      return `
        <div class="glass-card rounded-xl p-3.5 flex flex-col justify-between group cursor-pointer" data-id="${item.id}" data-type="${item.isFolder ? "folder" : "file"}">
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
                <h4 class="text-sm font-medium text-slate-200 truncate group-hover:text-brand-500 transition-colors leading-tight" title="${item.name}">
                  ${item.name}
                </h4>
                <p class="text-xs text-slate-500 mt-1">
                  ${item.isFolder ? "文件夹" : formatBytes(item.size)}
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

// 渲染列表视图 (缩略图辅助)
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
          <td class="px-4 py-2.5 flex items-center gap-3">
            ${
              thumbUrl && (item.isVideo || item.isImage)
                ? `<div class="w-10 h-7 rounded overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0">
                    <img src="${thumbUrl}" alt="" class="w-full h-full object-cover">
                  </div>`
                : `<div class="${color} flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    <i data-lucide="${icon}" class="w-4 h-4"></i>
                  </div>`
            }
            <span class="font-medium text-slate-200 group-hover:text-brand-500 transition-colors truncate max-w-xs sm:max-w-md lg:max-w-lg" title="${item.name}">
              ${item.name}
            </span>
          </td>
          <td class="px-4 py-2.5 text-xs text-slate-400 hidden md:table-cell">
            ${item.isFolder ? "-" : formatBytes(item.size)}
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
  const existingIdx = state.breadcrumbs.findIndex((b) => b.id === folderId);
  if (existingIdx !== -1) {
    state.breadcrumbs = state.breadcrumbs.slice(0, existingIdx + 1);
  } else {
    state.breadcrumbs.push({ id: folderId, name: folderName });
  }

  state.currentFolderId = folderId;
  dom.searchInput.value = "";
  state.searchQuery = "";
  dom.clearSearchBtn.classList.add("hidden");

  loadFolder(folderId);
}

// 渲染面包屑导航
function renderBreadcrumbs() {
  dom.breadcrumbs.innerHTML = state.breadcrumbs
    .map((b, idx) => {
      const isLast = idx === state.breadcrumbs.length - 1;
      return `
        <div class="flex items-center gap-1.5">
          ${idx > 0 ? `<i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-600"></i>` : ""}
          <button class="px-2 py-1 rounded hover:bg-slate-800/80 transition-colors ${
            isLast ? "text-brand-500 font-semibold cursor-default" : "text-slate-300 hover:text-white"
          }" data-crumb-id="${b.id}" ${isLast ? "disabled" : ""}>
            ${b.name}
          </button>
        </div>
      `;
    })
    .join("");

  dom.breadcrumbs.querySelectorAll("[data-crumb-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-crumb-id");
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

// 打开流媒体播放器
function openMediaPlayer(item) {
  destroyPlayer();
  state.activeMediaItem = item;
  state.isGooglePreview = false;

  dom.playerFileName.textContent = item.name;
  dom.playerDownloadBtn.href = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;

  const streamUrl = `${window.location.origin}/api/stream/${item.id}`;
  dom.playerCopyLinkBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(streamUrl);
      showToast("已复制媒体直链！");
    } catch (_) {}
  };

  // 配置外部专业播放器链接（针对 MKV / HEVC 10bit 秒播）
  dom.btnPotplayer.href = `potplayer://${streamUrl}`;
  dom.btnVlc.href = `vlc://${streamUrl}`;
  dom.btnIina.href = `iina://weblink?url=${encodeURIComponent(streamUrl)}`;
  dom.btnInfuse.href = `infuse://open?url=${encodeURIComponent(streamUrl)}`;

  // 格式判断：MKV、HEVC、AVI、FLV 常见编码不被所有浏览器直接支持
  const isSpecialFormat = /\.(mkv|avi|flv|wmv)$/i.test(item.name);
  if (isSpecialFormat) {
    dom.codecWarningBanner.classList.remove("hidden");
  } else {
    dom.codecWarningBanner.classList.add("hidden");
  }

  dom.previewModeText.textContent = "Google 预览";
  renderPlayerMedia(item, streamUrl);

  dom.playerModal.classList.remove("hidden");
  dom.playerModal.classList.add("flex");

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 渲染播放器内部内容
function renderPlayerMedia(item, streamUrl) {
  dom.mediaWrapper.innerHTML = "";

  if (item.isVideo) {
    dom.playerTypeIcon.setAttribute("data-lucide", "film");
    const video = document.createElement("video");
    video.id = "active-player";
    video.playsInline = true;
    video.controls = true;
    video.crossOrigin = "anonymous";
    video.src = streamUrl;
    video.className = "w-full max-h-[75vh]";

    // 监听播放异常（例如 MKV 或 HEVC 浏览器无法硬解）
    video.addEventListener("error", () => {
      dom.codecWarningBanner.classList.remove("hidden");
    });

    dom.mediaWrapper.appendChild(video);

    state.playerInstance = new Plyr(video, {
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      keyboard: { focused: true, global: true },
      autoplay: true,
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
  }
}

// 切换 Google 官方转码预览模式
function toggleGooglePreview() {
  if (!state.activeMediaItem) return;

  if (!state.isGooglePreview) {
    destroyPlayer();
    state.isGooglePreview = true;
    dom.previewModeText.textContent = "原生播放器";
    dom.mediaWrapper.innerHTML = `
      <iframe 
        src="https://drive.google.com/file/d/${state.activeMediaItem.id}/preview" 
        class="w-full h-[75vh] border-0" 
        allow="autoplay; fullscreen"
      ></iframe>
    `;
  } else {
    state.isGooglePreview = false;
    dom.previewModeText.textContent = "Google 预览";
    const streamUrl = `${window.location.origin}/api/stream/${state.activeMediaItem.id}`;
    renderPlayerMedia(state.activeMediaItem, streamUrl);
  }
}

// 关闭并销毁播放器
function closePlayer() {
  destroyPlayer();
  state.activeMediaItem = null;
  state.isGooglePreview = false;
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
  // 返回根目录
  dom.btnHome.addEventListener("click", () => {
    state.breadcrumbs = [state.breadcrumbs[0]];
    navigateToFolder(state.breadcrumbs[0].id, state.breadcrumbs[0].name);
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
    applyFilterAndSort();
  });

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

  // 模态框关闭
  dom.closePlayerBtn.addEventListener("click", closePlayer);
  dom.closeImageBtn.addEventListener("click", closeImagePreview);
  dom.closeGuideBtn.addEventListener("click", () => {
    dom.configGuideModal.classList.add("hidden");
    dom.configGuideModal.classList.remove("flex");
  });

  // 切换 Google 预览
  dom.toggleGooglePreviewBtn.addEventListener("click", toggleGooglePreview);

  // 外部播放器菜单点击切换
  dom.extPlayerMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dom.extPlayerMenu.classList.toggle("hidden");
  });

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
  await loadFolder(state.currentFolderId);
}

document.addEventListener("DOMContentLoaded", init);
