/**
 * Cloudflare Drive Player - 前端核心交互逻辑
 */

// 状态管理
const state = {
  drives: [],
  currentDrive: null,
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
  // 多盘切换器
  driveSelectorContainer: document.getElementById("drive-selector-container"),
  driveSelectorBtn: document.getElementById("drive-selector-btn"),
  currentDriveName: document.getElementById("current-drive-name"),
  driveDropdownMenu: document.getElementById("drive-dropdown-menu"),
  driveListContainer: document.getElementById("drive-list-container"),
  driveCrumbDivider: document.getElementById("drive-crumb-divider"),
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
  toggleCfStreamBtn: document.getElementById("toggle-cf-stream-btn"),
  cfStreamBtnText: document.getElementById("cf-stream-btn-text"),
  cfStreamGuideModal: document.getElementById("cf-stream-guide-modal"),
  closeCfGuideBtn: document.getElementById("close-cf-guide-btn"),
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

// 多盘下拉菜单配置与渲染
function setupDrivesUI(initialDrive) {
  state.currentDrive = initialDrive;
  state.currentFolderId = initialDrive.id;
  state.breadcrumbs = [{ id: initialDrive.id, name: initialDrive.name }];
  dom.currentDriveName.textContent = initialDrive.name;

  if (state.drives.length <= 1) {
    // 只有一个盘，隐藏切换下拉箭头
    const arrow = dom.driveSelectorBtn.querySelector('[data-lucide="chevron-down"]');
    if (arrow) arrow.style.display = "none";
    dom.driveSelectorBtn.classList.remove("hover:bg-slate-800");
    dom.driveSelectorBtn.style.cursor = "default";
    return;
  }

  // 多个盘，渲染下拉项
  renderDriveDropdownItems();
}

function renderDriveDropdownItems() {
  dom.driveListContainer.innerHTML = state.drives
    .map((drive) => {
      const isSelected = state.currentDrive && state.currentDrive.id === drive.id;
      return `
        <button 
          class="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors ${
            isSelected ? "text-brand-400 font-semibold bg-slate-800/60" : "text-slate-300"
          }" 
          data-drive-id="${drive.id}"
        >
          <div class="flex items-center gap-2 truncate">
            <i data-lucide="hard-drive" class="w-3.5 h-3.5 ${isSelected ? "text-brand-400" : "text-slate-400"}"></i>
            <span class="truncate">${drive.name}</span>
          </div>
          ${isSelected ? `<i data-lucide="check" class="w-3.5 h-3.5 text-brand-400 flex-shrink-0"></i>` : ""}
        </button>
      `;
    })
    .join("");

  dom.driveListContainer.querySelectorAll("[data-drive-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const driveId = btn.getAttribute("data-drive-id");
      const targetDrive = state.drives.find((d) => d.id === driveId);
      if (targetDrive && targetDrive.id !== state.currentDrive.id) {
        switchDrive(targetDrive);
      }
      dom.driveDropdownMenu.classList.add("hidden");
    });
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 切换当前激活的盘符
function switchDrive(drive) {
  state.currentDrive = drive;
  state.currentFolderId = drive.id;
  state.breadcrumbs = [{ id: drive.id, name: drive.name }];
  dom.currentDriveName.textContent = drive.name;

  // 更新 URL hash
  window.location.hash = `#drive=${encodeURIComponent(drive.id)}`;

  renderDriveDropdownItems();
  dom.searchInput.value = "";
  state.searchQuery = "";
  dom.clearSearchBtn.classList.add("hidden");

  loadFolder(drive.id);
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

        if (data.drives && data.drives.length > 0) {
          state.drives = data.drives;
          // 解析 URL hash
          let activeDrive = state.drives[0];
          const hashMatch = window.location.hash.match(/drive=([^&]+)/);
          if (hashMatch) {
            const driveIdFromHash = decodeURIComponent(hashMatch[1]);
            const match = state.drives.find((d) => d.id === driveIdFromHash);
            if (match) activeDrive = match;
          }
          setupDrivesUI(activeDrive);
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
                <h4 class="text-sm font-medium text-slate-200 truncate group-hover:text-brand-500 transition-colors leading-tight" title="${item.name}">
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

// 渲染列表视图
function renderListView(items) {
  dom.listTbody.innerHTML = items
    .map((item) => {
      const { icon, color } = getFileIcon(item);
      const isMedia = item.isVideo || item.isAudio;
      const streamUrl = `/api/stream/${item.id}`;
      const downloadUrl = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;
      const thumbUrl = getHighResThumb(item, 120);
      const ext = item.name.includes(".") ? item.name.split(".").pop().toUpperCase() : "";
      const resBadge = getVideoResolution(item);

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
            ${
              ext && item.isVideo
                ? `<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">${ext}</span>`
                : ""
            }
            ${
              resBadge
                ? `<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30 font-bold">${resBadge}</span>`
                : ""
            }
            ${
              item.isFolder
                ? `<span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">${item.itemCount || 0} 个文件</span>`
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

  const resBadge = getVideoResolution(item);
  dom.playerFileName.textContent = `${item.name}${resBadge ? ` [${resBadge}]` : ""}`;
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

    // 监听播放异常
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
  state.isCfStreamMode = false;
  clearInterval(state.cfPollInterval);
  dom.cfStreamBtnText.textContent = "CF Stream 播放";
  dom.extPlayerMenu.classList.add("hidden");
  dom.playerModal.classList.add("hidden");
  dom.playerModal.classList.remove("flex");
}

function destroyPlayer() {
  clearInterval(state.cfPollInterval);
  if (state.playerInstance) {
    try {
      state.playerInstance.stop();
      state.playerInstance.destroy();
    } catch (_) {}
    state.playerInstance = null;
  }
  dom.mediaWrapper.innerHTML = "";
}

// 切换 Cloudflare Stream 云端切片自适应流播放
async function toggleCloudflareStream() {
  if (!state.activeMediaItem) return;
  const item = state.activeMediaItem;

  if (state.isCfStreamMode) {
    clearInterval(state.cfPollInterval);
    state.isCfStreamMode = false;
    dom.cfStreamBtnText.textContent = "CF Stream 播放";
    const streamUrl = `${window.location.origin}/api/stream/${item.id}`;
    renderPlayerMedia(item, streamUrl);
    return;
  }

  destroyPlayer();
  state.isCfStreamMode = true;
  state.isGooglePreview = false;
  dom.previewModeText.textContent = "Google 预览";
  dom.cfStreamBtnText.textContent = "原生播放器";

  dom.mediaWrapper.innerHTML = `
    <div class="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
      <div class="w-12 h-12 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mb-4"></div>
      <h4 class="text-base font-semibold text-white mb-2">正在连接 Cloudflare Stream...</h4>
      <p class="text-xs text-slate-400">正在检查云端切片转码状态，请稍候</p>
    </div>
  `;

  try {
    const res = await fetch("/api/cf-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: item.id, fileName: item.name }),
    });

    const data = await res.json();
    if (data.notConfigured) {
      state.isCfStreamMode = false;
      dom.cfStreamBtnText.textContent = "CF Stream 播放";
      dom.cfStreamGuideModal.classList.remove("hidden");
      dom.cfStreamGuideModal.classList.add("flex");
      const streamUrl = `${window.location.origin}/api/stream/${item.id}`;
      renderPlayerMedia(item, streamUrl);
      return;
    }

    if (!data.success) {
      throw new Error(data.error || "请求 Cloudflare Stream 失败");
    }

    handleCfStreamStatus(data.video);
  } catch (err) {
    showToast(`CF Stream 异常: ${err.message}`);
    state.isCfStreamMode = false;
    dom.cfStreamBtnText.textContent = "CF Stream 播放";
    const streamUrl = `${window.location.origin}/api/stream/${item.id}`;
    renderPlayerMedia(item, streamUrl);
  }
}

function handleCfStreamStatus(video) {
  clearInterval(state.cfPollInterval);

  if (video.readyToStream) {
    dom.mediaWrapper.innerHTML = `
      <iframe
        src="https://iframe.videodelivery.net/${video.uid}?autoplay=true"
        class="w-full h-[75vh] border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowfullscreen="true"
      ></iframe>
    `;
    return;
  }

  const pct = (video.status && video.status.pctComplete) ? parseFloat(video.status.pctComplete).toFixed(1) : "0.0";
  dom.mediaWrapper.innerHTML = `
    <div class="flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
      <div class="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-4">
        <i data-lucide="zap" class="w-7 h-7 animate-pulse"></i>
      </div>
      <h4 class="text-base font-bold text-white mb-1.5">Cloudflare Stream 正在云端切片转码</h4>
      <p class="text-xs text-slate-400 mb-5 leading-relaxed">
        正在将该视频异步转化为全平台自适应 HLS 码流（1080P/720P/480P）。<br>
        <strong>首次转码只需进行一次</strong>，完成后任何手机、电脑浏览器均可 100% 秒开播放！
      </p>
      <div class="w-full max-w-xs bg-slate-800 rounded-full h-2.5 overflow-hidden mb-2.5 p-0.5 border border-slate-700/60">
        <div id="cf-progress-bar" class="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500" style="width: ${Math.max(5, parseFloat(pct))}%"></div>
      </div>
      <span id="cf-progress-text" class="text-xs text-orange-400 font-mono font-semibold">云端进度: ${pct}%</span>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  state.cfPollInterval = setInterval(async () => {
    if (!state.isCfStreamMode || !state.activeMediaItem) {
      clearInterval(state.cfPollInterval);
      return;
    }

    try {
      const pollRes = await fetch(`/api/cf-stream?fileId=${encodeURIComponent(state.activeMediaItem.id)}`);
      const pollData = await pollRes.json();
      if (pollData.success && pollData.video) {
        if (pollData.video.readyToStream) {
          clearInterval(state.cfPollInterval);
          handleCfStreamStatus(pollData.video);
        } else if (pollData.video.status) {
          const curPct = pollData.video.status.pctComplete ? parseFloat(pollData.video.status.pctComplete).toFixed(1) : pct;
          const bar = document.getElementById("cf-progress-bar");
          const txt = document.getElementById("cf-progress-text");
          if (bar) bar.style.width = `${Math.max(5, parseFloat(curPct))}%`;
          if (txt) txt.textContent = `云端进度: ${curPct}%`;
        }
      }
    } catch (_) {}
  }, 3500);
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
  // 返回当前盘根目录
  dom.btnHome.addEventListener("click", () => {
    if (state.currentDrive) {
      state.breadcrumbs = [{ id: state.currentDrive.id, name: state.currentDrive.name }];
      navigateToFolder(state.currentDrive.id, state.currentDrive.name);
    }
  });

  // 刷新按钮
  dom.refreshBtn.addEventListener("click", () => {
    loadFolder(state.currentFolderId, state.searchQuery);
  });

  // 多盘下拉菜单触发
  dom.driveSelectorBtn.addEventListener("click", (e) => {
    if (state.drives.length > 1) {
      e.stopPropagation();
      dom.driveDropdownMenu.classList.toggle("hidden");
    }
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

  // 切换 Cloudflare Stream 播放
  dom.toggleCfStreamBtn.addEventListener("click", toggleCloudflareStream);

  // 关闭 CF Stream 配置引导
  dom.closeCfGuideBtn.addEventListener("click", () => {
    dom.cfStreamGuideModal.classList.add("hidden");
    dom.cfStreamGuideModal.classList.remove("flex");
  });

  // 外部播放器菜单点击切换
  dom.extPlayerMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dom.extPlayerMenu.classList.toggle("hidden");
  });

  // 点击外部空白区域自动关闭所有菜单
  document.addEventListener("click", () => {
    dom.extPlayerMenu.classList.add("hidden");
    dom.driveDropdownMenu.classList.add("hidden");
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
