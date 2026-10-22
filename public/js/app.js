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
  activeSubtitleBlobUrl: null,
  activeSubtitleItem: null,
  currentSubtitleOffset: 0,
  activeAudioItem: null,
  audioInstance: null,
  audioLyrics: [],
  activeDocItem: null,
  accessToken: localStorage.getItem("access_token") || "",
  adminToken: localStorage.getItem("admin_token") || "",
  isAdmin: false,
  // 显式多选模式开关 (OpenList 范式：日常浏览纯净无扰，开启后优先触发选中防误触)
  selectMode: false,
  // 批量操作多选状态 (Set 存储当前已选 item.id)
  selectedItemIds: new Set(),
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
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  adminEntryBtn: document.getElementById("admin-entry-btn"),
  toggleSelectModeBtn: document.getElementById("toggle-select-mode-btn"),
  selectModeIcon: document.getElementById("select-mode-icon"),
  loadingSkeleton: document.getElementById("loading-skeleton"),
  gridView: document.getElementById("grid-view"),
  listView: document.getElementById("list-view"),
  listTbody: document.getElementById("list-tbody"),
  selectAllCheckbox: document.getElementById("select-all-checkbox"),
  emptyState: document.getElementById("empty-state"),
  // 访问密码模态框
  sitePasswordModal: document.getElementById("site-password-modal"),
  sitePasswordForm: document.getElementById("site-password-form"),
  sitePasswordInput: document.getElementById("site-password-input"),
  // 后台管理模态框
  adminModal: document.getElementById("admin-modal"),
  closeAdminBtn: document.getElementById("close-admin-btn"),
  adminLoginPanel: document.getElementById("admin-login-panel"),
  adminLoginForm: document.getElementById("admin-login-form"),
  adminPasswordInput: document.getElementById("admin-password-input"),
  adminDashboardPanel: document.getElementById("admin-dashboard-panel"),
  kvStatusIndicator: document.getElementById("kv-status-indicator"),
  kvStatusDot: document.getElementById("kv-status-dot"),
  kvStatusText: document.getElementById("kv-status-text"),
  kvStatusBadge: document.getElementById("kv-status-badge"),
  adminConfigForm: document.getElementById("admin-config-form"),
  cfgSiteName: document.getElementById("cfg-site-name"),
  cfgRequirePassword: document.getElementById("cfg-require-password"),
  cfgAccessPasswordContainer: document.getElementById("cfg-access-password-container"),
  cfgAccessPassword: document.getElementById("cfg-access-password"),
  cfgNewAdminPassword: document.getElementById("cfg-new-admin-password"),
  adminLogoutBtn: document.getElementById("admin-logout-btn"),
  // 单个文件操作模态框 (保留用于单项重命名/移动)
  fileActionModal: document.getElementById("file-action-modal"),
  fileActionTitle: document.getElementById("file-action-title"),
  fileActionDesc: document.getElementById("file-action-desc"),
  fileActionForm: document.getElementById("file-action-form"),
  fileActionInput: document.getElementById("file-action-input"),
  cancelFileActionBtn: document.getElementById("cancel-file-action-btn"),
  confirmFileActionBtn: document.getElementById("confirm-file-action-btn"),
  // 批量操作底吸浮动工具栏与模态框
  batchActionBar: document.getElementById("batch-action-bar"),
  batchSelectedCount: document.getElementById("batch-selected-count"),
  batchSelectAllBtn: document.getElementById("batch-select-all-btn"),
  batchInvertSelectionBtn: document.getElementById("batch-invert-selection-btn"),
  batchClearSelectionBtn: document.getElementById("batch-clear-selection-btn"),
  batchRenameTriggerBtn: document.getElementById("batch-rename-trigger-btn"),
  batchMoveTriggerBtn: document.getElementById("batch-move-trigger-btn"),
  batchDeleteTriggerBtn: document.getElementById("batch-delete-trigger-btn"),
  // 批量重命名模态框
  batchRenameModal: document.getElementById("batch-rename-modal"),
  closeBatchRenameBtn: document.getElementById("close-batch-rename-btn"),
  cancelBatchRenameBtn: document.getElementById("cancel-batch-rename-btn"),
  batchRenameForm: document.getElementById("batch-rename-form"),
  batchRenameTabReplace: document.getElementById("batch-rename-tab-replace"),
  batchRenameTabAffix: document.getElementById("batch-rename-tab-affix"),
  batchRenameTabSequence: document.getElementById("batch-rename-tab-sequence"),
  batchRenamePanelReplace: document.getElementById("batch-rename-panel-replace"),
  batchRenamePanelAffix: document.getElementById("batch-rename-panel-affix"),
  batchRenamePanelSequence: document.getElementById("batch-rename-panel-sequence"),
  batchReplaceFindInput: document.getElementById("batch-replace-find-input"),
  batchReplaceToInput: document.getElementById("batch-replace-to-input"),
  batchPrefixInput: document.getElementById("batch-prefix-input"),
  batchSuffixInput: document.getElementById("batch-suffix-input"),
  batchSeqBaseInput: document.getElementById("batch-seq-base-input"),
  batchSeqStartInput: document.getElementById("batch-seq-start-input"),
  batchSeqDigitsInput: document.getElementById("batch-seq-digits-input"),
  batchRenamePreview: document.getElementById("batch-rename-preview"),
  // 批量移动模态框
  batchMoveModal: document.getElementById("batch-move-modal"),
  closeBatchMoveBtn: document.getElementById("close-batch-move-btn"),
  cancelBatchMoveBtn: document.getElementById("cancel-batch-move-btn"),
  batchMoveForm: document.getElementById("batch-move-form"),
  batchMoveDesc: document.getElementById("batch-move-desc"),
  batchMoveQuickSelect: document.getElementById("batch-move-quick-select"),
  batchMoveFolderIdInput: document.getElementById("batch-move-folder-id-input"),
  // 批量删除模态框
  batchDeleteModal: document.getElementById("batch-delete-modal"),
  cancelBatchDeleteBtn: document.getElementById("cancel-batch-delete-btn"),
  confirmBatchDeleteBtn: document.getElementById("confirm-batch-delete-btn"),
  batchDeleteCountTip: document.getElementById("batch-delete-count-tip"),
  // 播放器模态框
  playerModal: document.getElementById("player-modal"),
  playerDialog: document.getElementById("player-dialog"),
  playerHeader: document.getElementById("player-header"),
  playerFileName: document.getElementById("player-file-name"),
  playerTypeIcon: document.getElementById("player-type-icon"),
  playerDownloadBtn: document.getElementById("player-download-btn"),
  playerDownloadBtnQuick: document.getElementById("player-download-btn-quick"),
  playerCopyLinkBtn: document.getElementById("player-copy-link-btn"),
  playerMaximizeBtn: document.getElementById("player-maximize-btn"),
  playerMaximizeIcon: document.getElementById("player-maximize-icon"),
  playerAutoplayToggleBtn: document.getElementById("player-autoplay-toggle-btn"),
  playerAutoplayIcon: document.getElementById("player-autoplay-icon"),
  playerAutoplayText: document.getElementById("player-autoplay-text"),
  playerPrevBtn: document.getElementById("player-prev-btn"),
  playerNextBtn: document.getElementById("player-next-btn"),
  playerSubtitlesBtn: document.getElementById("player-subtitles-btn"),
  playerSubtitlesIndicator: document.getElementById("player-subtitles-indicator"),
  playerSubtitlesMenu: document.getElementById("player-subtitles-menu"),
  currentSubLabel: document.getElementById("current-sub-label"),
  subtitlesTrackList: document.getElementById("subtitles-track-list"),
  btnUploadLocalSub: document.getElementById("btn-upload-local-sub"),
  localSubInput: document.getElementById("local-sub-input"),
  subtitleOffsetVal: document.getElementById("subtitle-offset-val"),
  btnSubDelay: document.getElementById("btn-sub-delay"),
  btnSubAdvance: document.getElementById("btn-sub-advance"),
  btnSubReset: document.getElementById("btn-sub-reset"),
  resumePlaybackBanner: document.getElementById("resume-playback-banner"),
  resumeBannerTime: document.getElementById("resume-banner-time"),
  resumeRestartBtn: document.getElementById("resume-restart-btn"),
  resumeCloseBtn: document.getElementById("resume-close-btn"),
  closePlayerBtn: document.getElementById("close-player-btn"),
  streamSourceToggleBtn: document.getElementById("stream-source-toggle-btn"),
  streamSourceText: document.getElementById("stream-source-text"),
  mediaWrapper: document.getElementById("media-wrapper"),
  codecWarningBanner: document.getElementById("codec-warning-banner"),
  codecWarningText: document.getElementById("codec-warning-text"),
  bannerFallbackPreviewBtn: document.getElementById("banner-fallback-preview-btn"),
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
  // 音频深度工作台
  audioStudioModal: document.getElementById("audio-studio-modal"),
  audioStudioHeaderTitle: document.getElementById("audio-studio-header-title"),
  audioStudioDiscIcon: document.getElementById("audio-studio-disc-icon"),
  audioFormatBadge: document.getElementById("audio-format-badge"),
  audioStudioDownloadBtn: document.getElementById("audio-studio-download-btn"),
  audioPlaylistToggleBtn: document.getElementById("audio-playlist-toggle-btn"),
  audioPlaylistCountLabel: document.getElementById("audio-playlist-count-label"),
  closeAudioStudioBtn: document.getElementById("close-audio-studio-btn"),
  audioStudioVinyl: document.getElementById("audio-studio-vinyl"),
  audioStudioCover: document.getElementById("audio-studio-cover"),
  audioTrackTitle: document.getElementById("audio-track-title"),
  audioTrackArtist: document.getElementById("audio-track-artist"),
  lyricContainer: document.getElementById("lyric-container"),
  audioPlaylistDrawer: document.getElementById("audio-playlist-drawer"),
  closeAudioPlaylistBtn: document.getElementById("close-audio-playlist-btn"),
  audioPlaylistItems: document.getElementById("audio-playlist-items"),
  audioProgressBarContainer: document.getElementById("audio-progress-bar-container"),
  audioProgressBar: document.getElementById("audio-progress-bar"),
  audioTimeLabel: document.getElementById("audio-time-label"),
  audioPrevBtn: document.getElementById("audio-prev-btn"),
  audioPlayToggleBtn: document.getElementById("audio-play-toggle-btn"),
  audioPlayIcon: document.getElementById("audio-play-icon"),
  audioNextBtn: document.getElementById("audio-next-btn"),
  // 文档查看器
  docViewerModal: document.getElementById("doc-viewer-modal"),
  docViewerIcon: document.getElementById("doc-viewer-icon"),
  docViewerTitle: document.getElementById("doc-viewer-title"),
  docTypeBadge: document.getElementById("doc-type-badge"),
  docViewerDownloadBtn: document.getElementById("doc-viewer-download-btn"),
  closeDocViewerBtn: document.getElementById("close-doc-viewer-btn"),
  docPdfContainer: document.getElementById("doc-pdf-container"),
  docPdfIframe: document.getElementById("doc-pdf-iframe"),
  docTextContainer: document.getElementById("doc-text-container"),
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

// 检测当前浏览器是否能原生使用内置内核播放该媒体
function canBrowserPlayNatively(item) {
  if (!item.isVideo && !item.isAudio) return false;
  if (item.isAudio) return true; // 音频格式 (mp3, wav, flac, ogg, aac) 原生广泛支持

  const ext = (item.name.includes(".") ? item.name.split(".").pop() : "").toLowerCase();
  // 现代浏览器原生完全无法解封装的传统容器格式
  const strictlyUnplayableContainers = ["avi", "wmv", "rmvb", "vob", "iso"];
  if (strictlyUnplayableContainers.includes(ext)) {
    return false;
  }

  const testVideo = document.createElement("video");

  // 1. MKV 容器兼容性探测 (Matroska / WebM 衍生)
  // 现代 Chromium 桌面端仅对纯 WebM 子集具备有限原生解封装能力，绝大多数 MKV (尤其是 H.264/HEVC + DTS/AC3/FLAC) 会触发黑屏有声音或直接报错
  // WebKit / Safari 等完全不支持任何 video/x-matroska。统一判定为不可原生播放，触发自动降级至 Google 预览
  if (ext === "mkv") {
    return false;
  }

  // 2. 针对常见多声道专业音频编码检测 (DTS, TrueHD, AC3, EAC3/DDP, 杜比全景声 Atmos)
  // 现代绝大多数 PC 浏览器未集成 DTS/AC-3 商业解码专利授权，会导致起播无声或解码挂起
  const isUnsupportedAudio = /(dts(-hd)?|truehd|ac3|eac3|ddp|atmos)/i.test(item.name);
  if (isUnsupportedAudio) {
    return false;
  }

  // 3. 针对 HEVC/H.265/10bit 编码检查 (需要操作系统及硬件硬解支持与 HEVC 扩展)
  const isHevc = /(hevc|h\.?265|x265|10bit|hdr|main10)/i.test(item.name);
  if (isHevc) {
    const canPlayHevc = !!(
      testVideo.canPlayType('video/mp4; codecs="hevc"') ||
      testVideo.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
      testVideo.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') ||
      testVideo.canPlayType('video/x-matroska; codecs="hevc"')
    );
    if (!canPlayHevc) return false;
  }

  return true;
}

// 统一控制编码与兼容性降级提示条
function showCodecWarning(message, showFallbackBtn = true) {
  if (!dom.codecWarningBanner) return;
  dom.codecWarningBanner.classList.remove("hidden");
  const bannerSpan = dom.codecWarningText || dom.codecWarningBanner.querySelector("span");
  if (bannerSpan) {
    bannerSpan.innerHTML = message;
  }
  if (dom.bannerFallbackPreviewBtn) {
    dom.bannerFallbackPreviewBtn.classList.toggle("hidden", !showFallbackBtn);
  }
}

function hideCodecWarning() {
  if (dom.codecWarningBanner) {
    dom.codecWarningBanner.classList.add("hidden");
  }
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
        return;
      }

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

      // 同步更新管理员快捷操作栏与操作按钮显示
      updateAdminUIState();

      // 如果启用了站点访问密码保护
      if (data.requirePassword && !state.accessToken && !state.adminToken) {
        openSitePasswordModal();
        return;
      }

      loadFolder(rootId);
    }
  } catch (err) {
    console.warn("未能获取系统信息:", err);
  }
}

// 更新管理员特权 UI 状态与批量操作栏
function updateAdminUIState() {
  const hasAdmin = Boolean(state.adminToken);
  state.isAdmin = hasAdmin;

  // 显式多选开关按钮仅管理员可见可用
  if (dom.toggleSelectModeBtn) {
    if (state.isAdmin) {
      dom.toggleSelectModeBtn.classList.remove("hidden");
    } else {
      dom.toggleSelectModeBtn.classList.add("hidden");
      // 若退出管理员登录，重置多选模式
      exitSelectMode();
    }
  }

  updateBatchActionBar();
}

// OpenList 范式：进入多选模式
function enterSelectMode() {
  if (!state.isAdmin) return;
  state.selectMode = true;
  document.body.classList.add("select-mode-active");
  if (dom.toggleSelectModeBtn) {
    dom.toggleSelectModeBtn.classList.add("bg-brand-500", "text-white", "border-brand-400");
    dom.toggleSelectModeBtn.classList.remove("bg-slate-900/80", "text-slate-300");
    dom.toggleSelectModeBtn.title = "退出多选模式";
  }
  updateBatchActionBar();
}

// OpenList 范式：退出多选模式
function exitSelectMode() {
  state.selectMode = false;
  state.selectedItemIds.clear();
  document.body.classList.remove("select-mode-active");
  if (dom.toggleSelectModeBtn) {
    dom.toggleSelectModeBtn.classList.remove("bg-brand-500", "text-white", "border-brand-400");
    dom.toggleSelectModeBtn.classList.add("bg-slate-900/80", "text-slate-300");
    dom.toggleSelectModeBtn.title = "多选模式";
  }
  syncSelectionVisuals();
  updateBatchActionBar();
}

// OpenList 范式：切换多选模式
function toggleSelectMode() {
  if (state.selectMode) {
    exitSelectMode();
  } else {
    enterSelectMode();
  }
}

// 批量操作：多选状态管理与底部工具栏联动
function updateBatchActionBar() {
  if (!dom.batchActionBar) return;
  const count = state.selectedItemIds.size;

  // 处于多选模式或已有勾选，且为管理员时常驻展示底吸工具栏
  if ((state.selectMode || count > 0) && state.isAdmin) {
    if (dom.batchSelectedCount) {
      dom.batchSelectedCount.textContent = `已选 ${count} 项`;
    }
    dom.batchActionBar.classList.remove("translate-y-24", "opacity-0", "pointer-events-none");
    dom.batchActionBar.classList.add("translate-y-0", "opacity-100", "pointer-events-auto");
  } else {
    dom.batchActionBar.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
    dom.batchActionBar.classList.remove("translate-y-0", "opacity-100", "pointer-events-auto");
  }

  // 同步更新全选复选框的状态 (根据当前可见页项)
  if (dom.selectAllCheckbox) {
    const visibleSelectable = getCurrentlyVisibleItems();
    if (visibleSelectable.length === 0) {
      dom.selectAllCheckbox.checked = false;
      dom.selectAllCheckbox.indeterminate = false;
    } else {
      const allChecked = visibleSelectable.every((i) => state.selectedItemIds.has(i.id));
      const someChecked = visibleSelectable.some((i) => state.selectedItemIds.has(i.id));
      dom.selectAllCheckbox.checked = allChecked;
      dom.selectAllCheckbox.indeterminate = !allChecked && someChecked;
    }
  }
}

// 获取当前页可见的项目列表
function getCurrentlyVisibleItems() {
  if (state.pageSize === "all") {
    return state.filteredItems || [];
  }
  const size = typeof state.pageSize === "number" ? state.pageSize : 30;
  const startIdx = (state.currentPage - 1) * size;
  return (state.filteredItems || []).slice(startIdx, startIdx + size);
}

// 切换单项选择状态 (支持 O(1) 局部节点快速更新)
function toggleSelectItem(id, forceValue) {
  const willSelect = typeof forceValue === "boolean" ? forceValue : !state.selectedItemIds.has(id);
  if (willSelect) {
    state.selectedItemIds.add(id);
    if (!state.selectMode && state.isAdmin) {
      enterSelectMode();
    }
  } else {
    state.selectedItemIds.delete(id);
  }

  updateSingleItemVisual(id, willSelect);
  updateBatchActionBar();
}

// O(1) 精准定向更新单个条目的视觉选中状态，杜绝整页扫描重排
function updateSingleItemVisual(id, isSelected) {
  // 网格卡片
  const card = document.querySelector(`.glass-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle("item-selected-card", isSelected);
    const cb = card.querySelector(".item-checkbox");
    if (cb) cb.checked = isSelected;
  }

  // 列表行
  const row = document.querySelector(`.file-row[data-id="${id}"]`);
  if (row) {
    row.classList.toggle("item-selected-row", isSelected);
    const cb = row.querySelector(".item-checkbox");
    if (cb) cb.checked = isSelected;
  }
}

// 全选/全不选当前页项目
function toggleSelectAllCurrentPage(forceChecked) {
  const visible = getCurrentlyVisibleItems();
  const shouldSelect = typeof forceChecked === "boolean" ? forceChecked : !visible.every((i) => state.selectedItemIds.has(i.id));
  visible.forEach((i) => {
    if (shouldSelect) state.selectedItemIds.add(i.id);
    else state.selectedItemIds.delete(i.id);
  });
  if (shouldSelect && !state.selectMode && state.isAdmin) {
    enterSelectMode();
  }
  syncSelectionVisuals();
  updateBatchActionBar();
}

// 反选当前页项目 (OpenList 范式标配)
function invertSelectionCurrentPage() {
  const visible = getCurrentlyVisibleItems();
  visible.forEach((i) => {
    if (state.selectedItemIds.has(i.id)) {
      state.selectedItemIds.delete(i.id);
    } else {
      state.selectedItemIds.add(i.id);
    }
  });
  syncSelectionVisuals();
  updateBatchActionBar();
}

// 清空全部已选
function clearAllSelection() {
  state.selectedItemIds.clear();
  syncSelectionVisuals();
  updateBatchActionBar();
}

// 同步列表行和网格卡片的选中样式与复选框勾选状态
function syncSelectionVisuals() {
  // 列表行
  document.querySelectorAll(".file-row").forEach((row) => {
    const id = row.getAttribute("data-id");
    const isSelected = state.selectedItemIds.has(id);
    row.classList.toggle("item-selected-row", isSelected);
    const cb = row.querySelector(".item-checkbox");
    if (cb) cb.checked = isSelected;
  });

  // 网格卡片
  document.querySelectorAll(".glass-card").forEach((card) => {
    const id = card.getAttribute("data-id");
    const isSelected = state.selectedItemIds.has(id);
    card.classList.toggle("item-selected-card", isSelected);
    const cb = card.querySelector(".item-checkbox");
    if (cb) cb.checked = isSelected;
  });
}

// 获取已选项目完整数据对象数组
function getSelectedItemsData() {
  return state.items.filter((item) => state.selectedItemIds.has(item.id));
}

// 前端受控并发执行池 (带 Concurrency Limit 与失败搜集，保障 Cloudflare Functions 与 Google Drive 零限流)
async function runConcurrentBatch(items, limit, workerFn) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const res = await workerFn(item, currentIndex);
        results[currentIndex] = { success: true, item, res };
      } catch (err) {
        results[currentIndex] = { success: false, item, error: err.message || String(err) };
      }
    }
  }

  const workers = [];
  const actualLimit = Math.min(limit, items.length);
  for (let i = 0; i < actualLimit; i++) {
    workers.push(next());
  }
  await Promise.all(workers);
  return results;
}

// 打开/切换后台管理窗口
let currentFileAction = {};

function openAdminModal() {
  dom.adminModal.classList.remove("hidden");
  dom.adminModal.classList.add("flex");

  if (state.adminToken) {
    state.isAdmin = true;
    updateAdminUIState();
    loadAdminDashboard();
  } else {
    dom.adminLoginPanel.classList.remove("hidden");
    dom.adminDashboardPanel.classList.add("hidden");
    setTimeout(() => dom.adminPasswordInput.focus(), 100);
  }
}

function closeAdminModal() {
  if (!dom.adminModal) return;
  dom.adminModal.classList.add("hidden");
  dom.adminModal.classList.remove("flex");
}

// 加载后台面板数据
async function loadAdminDashboard() {
  dom.adminLoginPanel.classList.add("hidden");
  dom.adminDashboardPanel.classList.remove("hidden");

  try {
    const res = await fetch("/api/admin/config", {
      headers: { Authorization: `Bearer ${state.adminToken}` },
    });
    if (!res.ok) {
      // Token 过期或失效
      state.adminToken = "";
      state.isAdmin = false;
      localStorage.removeItem("admin_token");
      updateAdminUIState();
      dom.adminLoginPanel.classList.remove("hidden");
      dom.adminDashboardPanel.classList.add("hidden");
      return;
    }

    const data = await res.json();
    if (data.success && data.config) {
      dom.cfgSiteName.value = data.config.siteName || "";
      dom.cfgRequirePassword.checked = Boolean(data.config.requirePassword);
      dom.cfgAccessPassword.value = data.config.accessPassword || "";
      dom.cfgNewAdminPassword.value = "";

      // 更新存储模式状态条 (Cloudflare KV vs Google Drive Metadata)
      if (dom.kvStatusIndicator && dom.kvStatusDot && dom.kvStatusText && dom.kvStatusBadge) {
        if (data.config.kvConfigured) {
          dom.kvStatusDot.className = "w-2 h-2 rounded-full bg-emerald-400";
          dom.kvStatusText.textContent = "Cloudflare KV 已绑定生效 (全节点毫秒级缓存)";
          dom.kvStatusBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
          dom.kvStatusBadge.textContent = "KV: ACTIVE";
        } else {
          dom.kvStatusDot.className = "w-2 h-2 rounded-full bg-cyan-400";
          dom.kvStatusText.textContent = "Google Drive 元数据持久化 (免配可用)";
          dom.kvStatusBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30";
          dom.kvStatusBadge.textContent = "DRIVE PROPERTIES";
        }
      }

      if (dom.cfgAccessPasswordContainer) {
        dom.cfgAccessPasswordContainer.classList.toggle("opacity-40", !data.config.requirePassword);
      }
    }
  } catch (err) {
    showToast("获取系统配置失败: " + err.message);
  }
}

// 打开文件操作模态框 (重命名 / 移动 / 新建文件夹)
function openFileActionModal({ action, title, desc, defaultValue = "", placeholder = "", fileId, shortcutId = "" }) {
  currentFileAction = { action, fileId, shortcutId };
  dom.fileActionTitle.textContent = title;
  dom.fileActionDesc.textContent = desc;
  dom.fileActionInput.value = defaultValue;
  dom.fileActionInput.placeholder = placeholder || "";
  dom.fileActionModal.classList.remove("hidden");
  dom.fileActionModal.classList.add("flex");
  setTimeout(() => {
    dom.fileActionInput.focus();
    dom.fileActionInput.select();
  }, 100);
}

function closeFileActionModal() {
  dom.fileActionModal.classList.add("hidden");
  dom.fileActionModal.classList.remove("flex");
  currentFileAction = {};
}

// 当前活跃的批量重命名 Tab: "replace" | "affix" | "sequence"
let currentBatchRenameTab = "replace";

// 打开批量重命名模态框
function openBatchRenameModal() {
  const selected = getSelectedItemsData();
  if (selected.length === 0) {
    showToast("请先勾选需要重命名的文件或文件夹");
    return;
  }
  setBatchRenameTab("replace");
  if (dom.batchReplaceFindInput) dom.batchReplaceFindInput.value = "";
  if (dom.batchReplaceToInput) dom.batchReplaceToInput.value = "";
  if (dom.batchPrefixInput) dom.batchPrefixInput.value = "";
  if (dom.batchSuffixInput) dom.batchSuffixInput.value = "";
  if (dom.batchSeqBaseInput) dom.batchSeqBaseInput.value = "Item";
  if (dom.batchSeqStartInput) dom.batchSeqStartInput.value = "1";
  if (dom.batchSeqDigitsInput) dom.batchSeqDigitsInput.value = "2";

  updateBatchRenamePreview();

  if (dom.batchRenameModal) {
    dom.batchRenameModal.classList.remove("hidden");
    dom.batchRenameModal.classList.add("flex");
    setTimeout(() => {
      if (dom.batchReplaceFindInput) dom.batchReplaceFindInput.focus();
    }, 100);
  }
}

function closeBatchRenameModal() {
  if (dom.batchRenameModal) {
    dom.batchRenameModal.classList.add("hidden");
    dom.batchRenameModal.classList.remove("flex");
  }
}

// 切换批量重命名 Tab
function setBatchRenameTab(tab) {
  currentBatchRenameTab = tab;
  const tabs = [
    { id: "replace", btn: dom.batchRenameTabReplace, panel: dom.batchRenamePanelReplace },
    { id: "affix", btn: dom.batchRenameTabAffix, panel: dom.batchRenamePanelAffix },
    { id: "sequence", btn: dom.batchRenameTabSequence, panel: dom.batchRenamePanelSequence },
  ];

  tabs.forEach((t) => {
    if (!t.btn || !t.panel) return;
    if (t.id === tab) {
      t.btn.className = "py-1.5 rounded-lg bg-brand-500 text-white text-center transition-colors";
      t.panel.classList.remove("hidden");
    } else {
      t.btn.className = "py-1.5 rounded-lg text-slate-400 hover:text-white text-center transition-colors";
      t.panel.classList.add("hidden");
    }
  });

  updateBatchRenamePreview();
}

// 计算单个文件在当前批量规则下的新名称
function computeNewItemName(originalName, index) {
  if (!originalName) return originalName;

  // 分离扩展名 (文件夹不拆分扩展名)
  const isDotFile = originalName.startsWith(".") && !originalName.slice(1).includes(".");
  const dotIndex = originalName.lastIndexOf(".");
  let baseName = originalName;
  let ext = "";
  if (dotIndex > 0 && !isDotFile) {
    baseName = originalName.slice(0, dotIndex);
    ext = originalName.slice(dotIndex); // 如 ".mp4"
  }

  if (currentBatchRenameTab === "replace") {
    const findStr = dom.batchReplaceFindInput ? dom.batchReplaceFindInput.value : "";
    const toStr = dom.batchReplaceToInput ? dom.batchReplaceToInput.value : "";
    if (!findStr) return originalName;
    // 采用全局字符替换 (兼容特殊字符，不用裸正则避免转义错误)
    return originalName.split(findStr).join(toStr);
  }

  if (currentBatchRenameTab === "affix") {
    const prefix = dom.batchPrefixInput ? dom.batchPrefixInput.value : "";
    const suffix = dom.batchSuffixInput ? dom.batchSuffixInput.value : "";
    return `${prefix}${baseName}${suffix}${ext}`;
  }

  if (currentBatchRenameTab === "sequence") {
    const customBase = dom.batchSeqBaseInput ? dom.batchSeqBaseInput.value.trim() : "";
    const startNum = dom.batchSeqStartInput ? parseInt(dom.batchSeqStartInput.value, 10) || 1 : 1;
    const digits = dom.batchSeqDigitsInput ? parseInt(dom.batchSeqDigitsInput.value, 10) || 2 : 2;
    const seqStr = String(startNum + index).padStart(digits, "0");
    const namePrefix = customBase || baseName;
    return `${namePrefix}_${seqStr}${ext}`;
  }

  return originalName;
}

// 实时渲染前 3~5 项重命名预览
function updateBatchRenamePreview() {
  if (!dom.batchRenamePreview) return;
  const selected = getSelectedItemsData();
  if (selected.length === 0) {
    dom.batchRenamePreview.innerHTML = `<span class="text-slate-500">未选择任何项目</span>`;
    return;
  }

  const sample = selected.slice(0, 4);
  const rows = sample.map((item, idx) => {
    const newName = computeNewItemName(item.name, idx);
    const isChanged = newName !== item.name;
    return `
      <div class="flex items-center gap-1.5 truncate">
        <span class="text-slate-500 flex-shrink-0">${idx + 1}.</span>
        <span class="text-slate-400 truncate max-w-[140px]">${item.name}</span>
        <span class="text-slate-600 flex-shrink-0">→</span>
        <span class="${isChanged ? "text-brand-400 font-semibold" : "text-slate-500"} truncate">${newName}</span>
      </div>
    `;
  });

  if (selected.length > 4) {
    rows.push(`<div class="text-[10px] text-slate-500 pt-1">...及其他 ${selected.length - 4} 个项目</div>`);
  }

  dom.batchRenamePreview.innerHTML = rows.join("");
}

// 提交批量重命名
async function submitBatchRename() {
  const selected = getSelectedItemsData();
  if (selected.length === 0) return;

  // 预判计算所有新名称
  const plan = selected.map((item, idx) => ({
    item,
    newName: computeNewItemName(item.name, idx),
  })).filter((p) => p.newName && p.newName !== p.item.name);

  if (plan.length === 0) {
    showToast("新旧文件名一致，无需修改");
    return;
  }

  closeBatchRenameModal();
  showToast(`正在批量重命名 ${plan.length} 个项目...`);

  // 并发限制 3，避免触发 Google Drive 429 速率限制
  const results = await runConcurrentBatch(plan, 3, async (task) => {
    const res = await fetch("/api/admin/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.adminToken}`,
      },
      body: JSON.stringify({
        action: "rename",
        fileId: task.item.id,
        shortcutId: task.item.shortcutId || "",
        newName: task.newName,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "重命名失败");
    }
    return data;
  });

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  if (failCount === 0) {
    showToast(`批量重命名完成：成功 ${successCount} 项`);
  } else {
    showToast(`批量重命名完成：成功 ${successCount} 项，失败 ${failCount} 项`);
  }

  clearAllSelection();
  await loadFolder(state.currentFolderId);
}

// 打开批量移动模态框
function openBatchMoveModal() {
  const selected = getSelectedItemsData();
  if (selected.length === 0) {
    showToast("请先勾选需要移动的文件或文件夹");
    return;
  }

  if (dom.batchMoveDesc) {
    dom.batchMoveDesc.textContent = `将选中的 ${selected.length} 个项目移动到指定 Google Drive 文件夹`;
  }
  if (dom.batchMoveFolderIdInput) dom.batchMoveFolderIdInput.value = "";
  if (dom.batchMoveQuickSelect) dom.batchMoveQuickSelect.value = "";

  if (dom.batchMoveModal) {
    dom.batchMoveModal.classList.remove("hidden");
    dom.batchMoveModal.classList.add("flex");
    setTimeout(() => {
      if (dom.batchMoveFolderIdInput) dom.batchMoveFolderIdInput.focus();
    }, 100);
  }
}

function closeBatchMoveModal() {
  if (dom.batchMoveModal) {
    dom.batchMoveModal.classList.add("hidden");
    dom.batchMoveModal.classList.remove("flex");
  }
}

// 提交批量移动
async function submitBatchMove() {
  const selected = getSelectedItemsData();
  if (selected.length === 0) return;

  const targetFolderId = dom.batchMoveFolderIdInput ? dom.batchMoveFolderIdInput.value.trim() : "";
  if (!targetFolderId) {
    showToast("请输入或选择目标文件夹 ID");
    return;
  }

  closeBatchMoveModal();
  showToast(`正在批量移动 ${selected.length} 个项目...`);

  const results = await runConcurrentBatch(selected, 3, async (item) => {
    const res = await fetch("/api/admin/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.adminToken}`,
      },
      body: JSON.stringify({
        action: "move",
        fileId: item.id,
        shortcutId: item.shortcutId || "",
        targetFolderId,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "移动失败");
    }
    return data;
  });

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  if (failCount === 0) {
    showToast(`批量移动完成：成功 ${successCount} 项`);
  } else {
    showToast(`批量移动完成：成功 ${successCount} 项，失败 ${failCount} 项`);
  }

  clearAllSelection();
  await loadFolder(state.currentFolderId);
}

// 打开批量删除确认模态框
function openBatchDeleteModal() {
  const selected = getSelectedItemsData();
  if (selected.length === 0) {
    showToast("请先勾选需要删除的文件或文件夹");
    return;
  }

  if (dom.batchDeleteCountTip) {
    dom.batchDeleteCountTip.textContent = `已选 ${selected.length} 个项目，移入回收站后可在 30 天内找回`;
  }

  if (dom.batchDeleteModal) {
    dom.batchDeleteModal.classList.remove("hidden");
    dom.batchDeleteModal.classList.add("flex");
  }
}

function closeBatchDeleteModal() {
  if (dom.batchDeleteModal) {
    dom.batchDeleteModal.classList.add("hidden");
    dom.batchDeleteModal.classList.remove("flex");
  }
}

// 提交批量删除 (安全移入回收站 trashed: true)
async function submitBatchDelete() {
  const selected = getSelectedItemsData();
  if (selected.length === 0) return;

  closeBatchDeleteModal();
  showToast(`正在将 ${selected.length} 个项目移入回收站...`);

  const results = await runConcurrentBatch(selected, 3, async (item) => {
    const res = await fetch("/api/admin/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.adminToken}`,
      },
      body: JSON.stringify({
        action: "delete",
        fileId: item.id,
        shortcutId: item.shortcutId || "",
        permanent: false, // 遵循安全规范：默认软删除移入回收站
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "删除失败");
    }
    return data;
  });

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  if (failCount === 0) {
    showToast(`已成功将 ${successCount} 项移入回收站`);
  } else {
    showToast(`移入回收站完成：成功 ${successCount} 项，失败 ${failCount} 项`);
  }

  clearAllSelection();
  await loadFolder(state.currentFolderId);
}

// 执行文件/文件夹操作（单项重命名、移动、删除）
async function executeFileOperation(payload) {
  try {
    showToast("正在执行操作...");
    const res = await fetch("/api/admin/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.adminToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || "操作成功！");
      await loadFolder(state.currentFolderId);
    } else {
      showToast("操作失败: " + (data.error || "未知原因"));
    }
  } catch (err) {
    showToast("请求异常: " + err.message);
  }
}

// 打开前台站点访问密码模态框
function openSitePasswordModal() {
  dom.sitePasswordModal.classList.remove("hidden");
  dom.sitePasswordModal.classList.add("flex");
  setTimeout(() => dom.sitePasswordInput.focus(), 100);
}

function closeSitePasswordModal() {
  dom.sitePasswordModal.classList.add("hidden");
  dom.sitePasswordModal.classList.remove("flex");
}

// 加载指定文件夹内容
async function loadFolder(folderId, searchKeyword = "") {
  showLoading(true);
  clearAllSelection();
  state.currentPage = 1;
  try {
    let url = `/api/list?folderId=${encodeURIComponent(folderId)}&_t=${Date.now()}`;
    if (searchKeyword.trim()) {
      url += `&search=${encodeURIComponent(searchKeyword.trim())}`;
    }

    const token = state.adminToken || state.accessToken || "";
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    const data = await res.json();

    if (res.status === 401 && data.requirePassword) {
      openSitePasswordModal();
      return;
    }

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

      // 缩略图海报区域 (视频、图片、音频黑胶、文档卡片)
      let mediaPosterHtml = "";
      if (thumbUrl && (item.isVideo || item.isImage)) {
        mediaPosterHtml = `
          <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-2.5 border border-slate-800/80 group-hover:border-brand-500/40 transition-colors flex-shrink-0">
            <img src="${thumbUrl}" alt="${escapeHtml(item.name)}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onerror="this.onerror=null;this.classList.add('hidden');const fb=this.nextElementSibling?.classList?.contains('thumb-fallback')?this.nextElementSibling:null;if(fb){fb.classList.remove('hidden');}">
            <div class="thumb-fallback hidden absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-slate-500">
              <i data-lucide="${item.isVideo ? 'film' : 'image'}" class="w-8 h-8 mb-1 text-slate-600"></i>
              <span class="text-[10px] text-slate-500">${ext ? ext.toUpperCase() : '预览'}</span>
            </div>
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
      } else if (item.isAudio) {
        mediaPosterHtml = `
          <div class="relative w-full aspect-video rounded-xl bg-gradient-to-br from-purple-950/80 to-slate-950 overflow-hidden mb-2.5 border border-purple-500/30 flex items-center justify-center group-hover:border-purple-500 transition-all flex-shrink-0">
            <div class="w-12 h-12 rounded-full bg-black/80 border-2 border-purple-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <i data-lucide="disc" class="w-6 h-6 text-purple-400 animate-spin-slow"></i>
            </div>
            <div class="absolute top-2 left-2 flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-600 text-white shadow-sm">${ext || 'AUDIO'}</span>
            </div>
            <span class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-purple-300">无损音乐</span>
          </div>
        `;
      } else if (item.isDocument || /\.(pdf|md|txt|json|log|csv)$/i.test(item.name)) {
        const isPdf = /\.pdf$/i.test(item.name);
        mediaPosterHtml = `
          <div class="relative w-full aspect-video rounded-xl ${isPdf ? 'bg-gradient-to-br from-blue-950/80 to-slate-900 border-blue-500/30 group-hover:border-blue-500' : 'bg-gradient-to-br from-emerald-950/80 to-slate-900 border-emerald-500/30 group-hover:border-emerald-500'} overflow-hidden mb-2.5 border flex items-center justify-center transition-all flex-shrink-0">
            <div class="w-12 h-14 ${isPdf ? 'bg-blue-500/10 border-blue-500/30' : 'bg-emerald-500/10 border-emerald-500/30'} backdrop-blur-md rounded border p-2 flex flex-col justify-between group-hover:scale-105 transition-transform">
              <i data-lucide="${isPdf ? 'file-text' : 'code'}" class="w-4 h-4 ${isPdf ? 'text-blue-400' : 'text-emerald-400'}"></i>
              <div class="text-[9px] font-mono font-bold ${isPdf ? 'text-blue-300' : 'text-emerald-300'}">${ext || 'DOC'}</div>
            </div>
            <div class="absolute top-2 left-2 flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${isPdf ? 'bg-rose-600' : 'bg-emerald-600'} text-white shadow-sm">${ext || 'DOC'}</span>
            </div>
            <span class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-slate-300">文档预览</span>
          </div>
        `;
      }

      return `
        <div class="glass-card rounded-2xl p-3.5 flex flex-col justify-between group relative transition-all duration-200 cursor-pointer" data-id="${item.id}" data-type="${item.isFolder ? "folder" : "file"}">
          
          <!-- 悬停气泡 (带一键下载入口) -->
          <div class="title-tooltip-popover">
            <div class="text-[10px] uppercase font-mono tracking-wider mb-1 text-slate-400">完整文件名</div>
            <div class="font-medium select-all mb-2.5 break-all text-white">${escapeHtml(item.name)}</div>
            ${!item.isFolder ? `
              <button class="w-full py-1.5 px-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium flex items-center justify-center gap-1.5 text-xs transition-colors shadow-sm file-popover-download-btn" data-id="${item.id}" data-name="${escapeHtml(item.name)}">
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>立即下载原文件 (${formatBytes(item.size)})</span>
              </button>
            ` : ""}
          </div>

          <div>
            ${mediaPosterHtml}
            <div class="flex items-start gap-2.5">
              ${
                !mediaPosterHtml
                  ? `<div class="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 ${color} ${item.isFolder ? "cursor-pointer hover:border-brand-500/50 hover:bg-slate-700/50 folder-enter-trigger" : ""}" data-id="${item.id}">
                      <i data-lucide="${icon}" class="w-5 h-5"></i>
                    </div>`
                  : ""
              }
              <div class="flex-1 min-w-0">
                <h4 class="card-title-v3 group-hover:text-brand-500 transition-colors" data-id="${item.id}">
                  ${escapeHtml(item.name)}
                </h4>
              </div>
            </div>
          </div>

          <div class="mt-auto pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <div class="flex items-center gap-1.5 truncate pr-2">
              <span class="text-brand-500 font-semibold">${item.isFolder ? `${item.itemCount || 0} 项` : formatBytes(item.size)}</span>
              <span>·</span>
              <span class="truncate">${formatDate(item.modifiedTime)}</span>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              ${
                !item.isFolder
                  ? `<button class="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors file-quick-download-btn" data-id="${item.id}" data-name="${escapeHtml(item.name)}" title="下载原文件">
                      <i data-lucide="download" class="w-4 h-4"></i>
                    </button>
                    <button class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 copy-link-btn" data-url="${window.location.origin}${streamUrl}" title="复制直链">
                      <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>`
                  : `<button class="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-xs flex items-center gap-1 folder-enter-trigger" data-id="${item.id}" title="进入文件夹">
                      <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
                      <span>打开</span>
                    </button>`
              }
              ${
                state.isAdmin
                  ? `<button class="p-1.5 hover:text-amber-400 rounded hover:bg-slate-800 admin-rename-btn" data-id="${item.id}" data-shortcut-id="${item.shortcutId || ""}" data-name="${escapeHtml(item.name)}" title="重命名">
                      <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="p-1.5 hover:text-rose-400 rounded hover:bg-slate-800 admin-delete-btn" data-id="${item.id}" data-shortcut-id="${item.shortcutId || ""}" data-name="${escapeHtml(item.name)}" title="删除">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
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
        <tr class="file-row group transition-colors cursor-pointer" data-id="${item.id}" data-type="${item.isFolder ? "folder" : "file"}">
          <td class="px-4 py-2.5 flex items-center gap-3 min-w-0">
            ${
              thumbUrl && (item.isVideo || item.isImage)
                ? `<div class="w-10 h-7 rounded overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0 cursor-pointer media-action-trigger hover:opacity-80 transition-opacity" data-id="${item.id}">
                    <img src="${thumbUrl}" alt="" class="w-full h-full object-cover">
                  </div>`
                : `<div class="${color} flex-shrink-0 w-5 h-5 flex items-center justify-center ${item.isFolder ? "cursor-pointer folder-enter-trigger" : ""}" data-id="${item.id}">
                    <i data-lucide="${icon}" class="w-4 h-4"></i>
                  </div>`
            }
            <span class="font-medium text-slate-200 break-all leading-normal ${item.isFolder ? "cursor-pointer hover:text-brand-500 folder-enter-trigger" : "cursor-pointer hover:text-brand-500"}" data-id="${item.id}">
              ${escapeHtml(item.name)}
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
          <td class="px-4 py-2.5 text-right">
            <div class="flex items-center justify-end gap-1">
              ${
                item.isFolder
                  ? `<button class="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-xs flex items-center gap-1 folder-enter-trigger mr-1" data-id="${item.id}" title="进入文件夹">
                      <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
                      <span>打开</span>
                    </button>`
                  : ""
              }
              ${
                !item.isFolder
                  ? `<button class="p-1.5 hover:text-brand-500 rounded hover:bg-brand-500/10 text-slate-400 file-quick-download-btn" data-id="${item.id}" data-name="${escapeHtml(item.name)}" title="下载原文件">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="p-1.5 hover:text-slate-200 rounded hover:bg-slate-800 text-slate-400 copy-link-btn" data-url="${window.location.origin}${streamUrl}" title="复制直链">
                      <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>`
                  : ""
              }
              ${
                state.isAdmin
                  ? `<button class="p-1.5 hover:text-amber-400 rounded hover:bg-slate-800 text-slate-400 admin-rename-btn" data-id="${item.id}" data-shortcut-id="${item.shortcutId || ""}" data-name="${escapeHtml(item.name)}" title="重命名">
                      <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="p-1.5 hover:text-rose-400 rounded hover:bg-slate-800 text-slate-400 admin-delete-btn" data-id="${item.id}" data-shortcut-id="${item.shortcutId || ""}" data-name="${escapeHtml(item.name)}" title="删除">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
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

// 触发文件原生静默下载，不打开任何空白新标签页或弹窗
function triggerFileDownload(item) {
  if (!item || !item.id) return;
  const downloadUrl = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = item.name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 绑定卡片与列表行点击事件
function bindItemEvents(container) {
  // 1. 原生常驻下载按钮：阻止冒泡直接调用原生静默下载
  container.querySelectorAll(".file-quick-download-btn, .file-popover-download-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const item = state.items.find((i) => i.id === id);
      if (item) triggerFileDownload(item);
    });
  });

  // 2. 文件夹打开事件：仅在明确点击文件夹打开按钮、文件夹名称或图标时触发
  container.querySelectorAll(".folder-enter-trigger").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.getAttribute("data-id");
      const item = state.items.find((i) => i.id === id);
      if (item && item.isFolder) {
        navigateToFolder(item.id, item.name);
      }
    });
  });

  // 3. 复制直链按钮
  container.querySelectorAll(".copy-link-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
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

  // 4. 整行 / 整卡片点击路由 (多模态打开：音频 -> 深度唱片机，文档 -> 阅读器，视频 -> 剧场播放器，图片 -> 预览)
  container.querySelectorAll(".glass-card, .file-row").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (
        e.target.closest("button") || 
        e.target.closest("a") || 
        e.target.closest("input") ||
        e.target.closest(".title-tooltip-popover")
      ) {
        return;
      }
      const id = card.getAttribute("data-id");
      const item = state.items.find((i) => i.id === id);
      if (!item) return;

      if (item.isFolder) {
        navigateToFolder(item.id, item.name);
      } else if (item.isAudio) {
        openAudioStudio(item);
      } else if (item.isDocument || /\.(pdf|md|txt|json|log|csv)$/i.test(item.name)) {
        openDocViewer(item);
      } else if (item.isVideo) {
        openMediaPlayer(item);
      } else if (item.isImage) {
        openImagePreview(item);
      } else {
        triggerFileDownload(item);
      }
    });
  });

  // 管理员快捷操作监听：重命名
  container.querySelectorAll(".admin-rename-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fileId = btn.getAttribute("data-id");
      const shortcutId = btn.getAttribute("data-shortcut-id") || "";
      const currentName = btn.getAttribute("data-name");
      openFileActionModal({
        action: "rename",
        title: "重命名文件/文件夹",
        desc: `当前名称: ${currentName}`,
        defaultValue: currentName,
        fileId,
        shortcutId,
      });
    });
  });

  // 管理员快捷操作监听：移动
  container.querySelectorAll(".admin-move-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fileId = btn.getAttribute("data-id");
      const shortcutId = btn.getAttribute("data-shortcut-id") || "";
      const currentName = btn.getAttribute("data-name");
      openFileActionModal({
        action: "move",
        title: "移动文件/文件夹",
        desc: `将「${currentName}」移动到指定 Google Drive 文件夹 ID`,
        defaultValue: "",
        placeholder: "输入目标文件夹 ID (如 1xyzABC...)",
        fileId,
        shortcutId,
      });
    });
  });

  // 管理员快捷操作监听：删除
  container.querySelectorAll(".admin-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fileId = btn.getAttribute("data-id");
      const shortcutId = btn.getAttribute("data-shortcut-id") || "";
      const currentName = btn.getAttribute("data-name");
      if (confirm(`确定要将「${currentName}」移入回收站吗？`)) {
        await executeFileOperation({ action: "delete", fileId, shortcutId });
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
    dom.streamSourceText.textContent = is4K ? "⚡ 切换 4K 原画 (内置)" : "⚡ 切换内置原画 (直链)";
    dom.streamSourceToggleBtn.className =
      "px-2.5 py-0.5 rounded-md text-[11px] font-semibold items-center gap-1 transition-all flex-shrink-0 cursor-pointer shadow-sm border bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border-amber-500/30";
    dom.streamSourceToggleBtn.title = "当前为 Google 预览模式。点击返回内置原画播放器";
  } else {
    dom.streamSourceText.textContent = is4K ? "⚡ 4K 原画 (当前)" : "⚡ 原画直出 (当前)";
    dom.streamSourceToggleBtn.className =
      "px-2.5 py-0.5 rounded-md text-[11px] font-semibold items-center gap-1 transition-all flex-shrink-0 cursor-pointer shadow-sm border bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 border-emerald-500/30";
    dom.streamSourceToggleBtn.title = "当前使用应用内置原生播放器。点击可备选切换为 Google 云端预览 (最高1080P)";
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

// 主题系统管理 (暗色/浅色)
function initTheme() {
  const currentTheme = localStorage.getItem("app_theme") || "dark";
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem("app_theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  showToast(`已切换至${next === "dark" ? "暗色模式 🌙" : "浅色模式 ☀️"}`);
}

// ==========================================
// 深度音频工作台 (黑胶 + 同步滚动歌词 + 播放列表 + 常驻下载)
// ==========================================
function parseLrc(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split("\n");
  const timeExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  const result = [];
  for (const line of lines) {
    const match = timeExp.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10);
      const time = minutes * 60 + seconds + ms / 1000;
      const text = line.replace(timeExp, "").trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

function formatAudioTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
}

async function openAudioStudio(item) {
  destroyPlayer();
  state.activeAudioItem = item;
  const ext = item.name.includes(".") ? item.name.split(".").pop().toUpperCase() : "AUDIO";
  const streamUrl = `/api/stream/${item.id}?filename=${encodeURIComponent(item.name)}`;
  const downloadUrl = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;

  if (dom.audioStudioHeaderTitle) dom.audioStudioHeaderTitle.textContent = item.name;
  if (dom.audioTrackTitle) dom.audioTrackTitle.textContent = item.name.replace(/\.[a-zA-Z0-9]+$/, "");
  if (dom.audioFormatBadge) dom.audioFormatBadge.textContent = `${ext} / 无损`;
  if (dom.audioStudioDownloadBtn) {
    dom.audioStudioDownloadBtn.href = downloadUrl;
    dom.audioStudioDownloadBtn.onclick = (e) => {
      e.stopPropagation();
      triggerFileDownload(item);
    };
  }

  // 初始化 Audio 实例
  if (state.audioInstance) {
    state.audioInstance.pause();
    state.audioInstance = null;
  }
  const audio = new Audio(streamUrl);
  state.audioInstance = audio;

  // 歌词重置与搜寻
  state.audioLyrics = [];
  if (dom.lyricContainer) {
    dom.lyricContainer.innerHTML = '<div class="text-slate-500 text-center py-10">正在加载同步歌词...</div>';
  }

  // 尝试在同目录下寻找同名 .lrc 文件
  const baseName = item.name.replace(/\.[a-zA-Z0-9]+$/, "");
  const matchedLrcItem = (state.items || []).find((i) => {
    return i.name.toLowerCase() === `${baseName.toLowerCase()}.lrc` || 
           (i.name.toLowerCase().startsWith(baseName.toLowerCase()) && i.name.toLowerCase().endsWith(".lrc"));
  });

  if (matchedLrcItem) {
    try {
      const res = await fetch(`/api/stream/${matchedLrcItem.id}`);
      if (res.ok) {
        const text = await res.text();
        state.audioLyrics = parseLrc(text);
      }
    } catch (_) {}
  }

  if (state.audioLyrics.length > 0) {
    dom.lyricContainer.innerHTML = state.audioLyrics
      .map((l, idx) => `<div class="lyric-line cursor-pointer select-none" data-idx="${idx}" data-time="${l.time}">${escapeHtml(l.text)}</div>`)
      .join("");

    dom.lyricContainer.querySelectorAll(".lyric-line").forEach((el) => {
      el.addEventListener("click", () => {
        const t = parseFloat(el.getAttribute("data-time"));
        if (state.audioInstance && !isNaN(t)) {
          state.audioInstance.currentTime = t;
        }
      });
    });
  } else {
    dom.lyricContainer.innerHTML = '<div class="text-slate-500 text-center py-10">纯音乐或暂无匹配歌词，沉浸享受无损音质</div>';
  }

  // 播放队列渲染
  renderAudioPlaylist();

  // 音频事件监听
  audio.addEventListener("timeupdate", () => {
    if (!state.audioInstance) return;
    const cur = state.audioInstance.currentTime;
    const dur = state.audioInstance.duration || 0;
    if (dom.audioTimeLabel) dom.audioTimeLabel.textContent = `${formatAudioTime(cur)} / ${formatAudioTime(dur)}`;
    if (dom.audioProgressBar && dur > 0) {
      dom.audioProgressBar.style.width = `${(cur / dur) * 100}%`;
    }

    // 歌词同步滚动与高亮
    if (state.audioLyrics.length > 0 && dom.lyricContainer) {
      let activeIdx = 0;
      for (let i = 0; i < state.audioLyrics.length; i++) {
        if (cur >= state.audioLyrics[i].time) {
          activeIdx = i;
        } else {
          break;
        }
      }
      const lines = dom.lyricContainer.querySelectorAll(".lyric-line");
      lines.forEach((l, idx) => {
        if (idx === activeIdx) {
          if (!l.classList.contains("active")) {
            l.classList.add("active");
            l.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } else {
          l.classList.remove("active");
        }
      });
    }
  });

  audio.addEventListener("play", () => {
    if (dom.audioStudioVinyl) dom.audioStudioVinyl.classList.remove("spin-paused");
    if (dom.audioPlayIcon) dom.audioPlayIcon.setAttribute("data-lucide", "pause");
    if (window.lucide) lucide.createIcons();
  });

  audio.addEventListener("pause", () => {
    if (dom.audioStudioVinyl) dom.audioStudioVinyl.classList.add("spin-paused");
    if (dom.audioPlayIcon) dom.audioPlayIcon.setAttribute("data-lucide", "play");
    if (window.lucide) lucide.createIcons();
  });

  audio.addEventListener("ended", () => {
    playNextAudio();
  });

  // 进度条点击跳转
  if (dom.audioProgressBarContainer) {
    dom.audioProgressBarContainer.onclick = (e) => {
      if (!state.audioInstance || !state.audioInstance.duration) return;
      const rect = dom.audioProgressBarContainer.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      state.audioInstance.currentTime = clickRatio * state.audioInstance.duration;
    };
  }

  // 展现模态窗口
  if (dom.audioStudioModal) {
    dom.audioStudioModal.classList.remove("hidden");
    dom.audioStudioModal.classList.add("flex");
  }

  try {
    await audio.play();
  } catch (_) {
    if (dom.audioPlayIcon) dom.audioPlayIcon.setAttribute("data-lucide", "play");
    if (window.lucide) lucide.createIcons();
  }
}

function renderAudioPlaylist() {
  const current = state.activeAudioItem;
  const audioList = (state.items || []).filter((i) => i.isAudio);
  if (dom.audioPlaylistCountLabel) dom.audioPlaylistCountLabel.textContent = `播放列表 (${audioList.length})`;
  if (!dom.audioPlaylistItems) return;

  dom.audioPlaylistItems.innerHTML = audioList
    .map((item, idx) => {
      const isCur = current && item.id === current.id;
      return `
        <div class="py-2.5 px-3 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer rounded-lg transition-colors group ${isCur ? "bg-purple-950/40 border border-purple-500/30" : ""}" data-id="${item.id}">
          <div class="flex items-center gap-2 truncate pr-2">
            <span class="text-[10px] font-mono ${isCur ? "text-purple-400 font-bold" : "text-slate-500"}">${idx + 1}</span>
            <span class="truncate ${isCur ? "text-purple-300 font-medium" : "text-slate-300 group-hover:text-white"}">${escapeHtml(item.name)}</span>
          </div>
          <button class="p-1 rounded text-slate-500 hover:text-purple-400 file-quick-download-btn" data-id="${item.id}" data-name="${escapeHtml(item.name)}" title="下载">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    })
    .join("");

  dom.audioPlaylistItems.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const id = el.getAttribute("data-id");
      const target = audioList.find((i) => i.id === id);
      if (target) openAudioStudio(target);
    });
  });

  if (window.lucide) lucide.createIcons();
}

function closeAudioStudio() {
  if (state.audioInstance) {
    state.audioInstance.pause();
    state.audioInstance = null;
  }
  if (dom.audioStudioModal) {
    dom.audioStudioModal.classList.add("hidden");
    dom.audioStudioModal.classList.remove("flex");
  }
  if (dom.audioPlaylistDrawer) {
    dom.audioPlaylistDrawer.classList.add("hidden");
  }
}

function toggleAudioPlayback() {
  if (!state.audioInstance) return;
  if (state.audioInstance.paused) {
    state.audioInstance.play();
  } else {
    state.audioInstance.pause();
  }
}

function playNextAudio() {
  const audioList = (state.items || []).filter((i) => i.isAudio);
  if (audioList.length <= 1 || !state.activeAudioItem) return;
  const curIdx = audioList.findIndex((i) => i.id === state.activeAudioItem.id);
  const nextIdx = (curIdx + 1) % audioList.length;
  openAudioStudio(audioList[nextIdx]);
}

function playPrevAudio() {
  const audioList = (state.items || []).filter((i) => i.isAudio);
  if (audioList.length <= 1 || !state.activeAudioItem) return;
  const curIdx = audioList.findIndex((i) => i.id === state.activeAudioItem.id);
  const prevIdx = (curIdx - 1 + audioList.length) % audioList.length;
  openAudioStudio(audioList[prevIdx]);
}

// ==========================================
// 全能沉浸式文档查看器 (PDF / Markdown / 代码 + 常驻下载)
// ==========================================
async function openDocViewer(item) {
  state.activeDocItem = item;
  const ext = item.name.includes(".") ? item.name.split(".").pop().toUpperCase() : "DOC";
  const streamUrl = `/api/stream/${item.id}?filename=${encodeURIComponent(item.name)}`;
  const downloadUrl = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;

  if (dom.docViewerTitle) dom.docViewerTitle.textContent = item.name;
  if (dom.docTypeBadge) dom.docTypeBadge.textContent = `${ext} 文档`;
  if (dom.docViewerDownloadBtn) {
    dom.docViewerDownloadBtn.href = downloadUrl;
    dom.docViewerDownloadBtn.onclick = (e) => {
      e.stopPropagation();
      triggerFileDownload(item);
    };
  }

  const isPdf = /\.pdf$/i.test(item.name);
  if (isPdf) {
    if (dom.docPdfContainer) dom.docPdfContainer.classList.remove("hidden");
    if (dom.docTextContainer) dom.docTextContainer.classList.add("hidden");
    if (dom.docPdfIframe) dom.docPdfIframe.src = streamUrl;
  } else {
    if (dom.docPdfContainer) dom.docPdfContainer.classList.add("hidden");
    if (dom.docTextContainer) {
      dom.docTextContainer.classList.remove("hidden");
      dom.docTextContainer.textContent = "正在读取文档内容...";
    }
    try {
      const res = await fetch(streamUrl);
      if (res.ok) {
        const text = await res.text();
        if (dom.docTextContainer) dom.docTextContainer.textContent = text;
      } else {
        if (dom.docTextContainer) dom.docTextContainer.textContent = `加载失败 (HTTP ${res.status})`;
      }
    } catch (err) {
      if (dom.docTextContainer) dom.docTextContainer.textContent = `加载异常: ${err.message}`;
    }
  }

  if (dom.docViewerModal) {
    dom.docViewerModal.classList.remove("hidden");
    dom.docViewerModal.classList.add("flex");
  }
}

function closeDocViewer() {
  if (dom.docPdfIframe) dom.docPdfIframe.src = "about:blank";
  if (dom.docViewerModal) {
    dom.docViewerModal.classList.add("hidden");
    dom.docViewerModal.classList.remove("flex");
  }
}

// 统一更新视频播放器一键下载原片入口
function updatePlayerDownloadHref(item) {
  if (!item) return;
  const dlUrl = `/api/download/${item.id}?filename=${encodeURIComponent(item.name)}`;
  if (dom.playerDownloadBtn) dom.playerDownloadBtn.href = dlUrl;
  if (dom.playerDownloadBtnQuick) {
    dom.playerDownloadBtnQuick.href = dlUrl;
    dom.playerDownloadBtnQuick.onclick = (e) => {
      e.stopPropagation();
      triggerFileDownload(item);
    };
  }
}

const PROGRESS_STORAGE_KEY = "cf_player_progress";
const SPEED_STORAGE_KEY = "cf_player_speed";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function convertSrtToVtt(srtText) {
  let text = (srtText || "").replace(/^\uFEFF/, "");
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // 修正单数位小时 0:01:23,456 -> 00:01:23.456
  text = text.replace(/(\b\d:\d{2}:\d{2}),(\d{3})/g, "0$1.$2");
  // 转换毫秒逗号为点 00:01:23,456 -> 00:01:23.456
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return "WEBVTT\n\n" + text.trim() + "\n";
}

function getPlaybackProgress(fileId) {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[fileId] || null;
  } catch (_) {
    return null;
  }
}

function savePlaybackProgress(fileId, currentTime, duration, name) {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    for (const id in map) {
      if (now - (map[id].updatedAt || 0) > 30 * 86400 * 1000) {
        delete map[id];
      }
    }
    map[fileId] = {
      time: Math.floor(currentTime),
      duration: Math.floor(duration || 0),
      updatedAt: now,
      name: name || "",
    };
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch (_) {}
}

function clearPlaybackProgress(fileId) {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    delete map[fileId];
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch (_) {}
}

function formatDuration(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m < 10 ? "0" : ""}${s}`;
}

let resumeBannerTimer = null;
let blackScreenWatchdog = null;
let blackScreenQuickTimer = null;

/**
 * 校验 HTML5 Video 元素真实渲染帧与画面状态
 * 精确解决 PC Chrome 播放 MKV (HEVC/H.265) 时出现的“有声音走动但无画面/黑屏”问题
 * @param {HTMLVideoElement} video
 * @returns {{hasDimensions: boolean, hasFrames: boolean, hasVideo: boolean}}
 */
function checkVideoRenderStatus(video) {
  if (!video) return { hasDimensions: false, hasFrames: false, hasVideo: false };

  // 1. 物理尺寸检测 (视频像素宽高必须大于 0)
  const hasDimensions = Boolean(video.videoWidth > 0 && video.videoHeight > 0);

  // 2. 视频帧解码流水线检测 (Chrome / Chromium 原生标准与非标准接口双重校验)
  let frames = null;
  if (typeof video.getVideoPlaybackQuality === "function") {
    try {
      const quality = video.getVideoPlaybackQuality();
      if (quality && typeof quality.totalVideoFrames === "number") {
        frames = quality.totalVideoFrames;
      }
    } catch (_) {}
  }
  if (frames === null && typeof video.webkitDecodedFrameCount === "number") {
    frames = video.webkitDecodedFrameCount;
  }

  // 若能获取解码帧统计，必须大于 0；若环境无法获取统计指标，且视频有进度，则保守判断
  const hasFrames = frames !== null ? frames > 0 : (hasDimensions && video.currentTime > 0);
  const hasVideo = hasDimensions && hasFrames;

  return { hasDimensions, hasFrames, hasVideo };
}

/**
 * 启动解码异常与黑屏看门狗 (针对 MKV 容器、AC3/DTS 音频、HEVC 10bit 硬解受限的主动探测)
 * @param {Object} item 媒体项目元数据
 * @param {Object} art Artplayer 实例
 */
function startMediaWatchdog(item, art) {
  if (blackScreenWatchdog) {
    clearTimeout(blackScreenWatchdog);
    blackScreenWatchdog = null;
  }
  if (blackScreenQuickTimer) {
    clearTimeout(blackScreenQuickTimer);
    blackScreenQuickTimer = null;
  }

  const ext = (item.name.includes(".") ? item.name.split(".").pop() : "").toLowerCase();
  const isMkv = ext === "mkv";
  const nativePlayable = canBrowserPlayNatively(item);

  // 1. 若静态兼容性探测已知不支持，立即直接触发自动无感切换至云端转码预览播放
  if (!nativePlayable) {
    console.info("[Watchdog] 静态特征命中不可原生播放格式，自动切换至云端转码预览:", item.name);
    showToast("检测到当前视频格式或编码受限，已自动为您启用云端转码预览播放...", 3500);
    renderGooglePreview(item);
    return;
  }

  // 辅助判定：分析视频是否已陷入“黑屏无画面/卡死”状态
  const checkBlackScreen = (isFinalCheck = false) => {
    if (!art || !art.video) return false;
    const video = art.video;
    const renderStatus = checkVideoRenderStatus(video);

    // 核心判定场景：
    // A. 视频报错：video.error
    // B. 音频在正常推进 (currentTime > 0.3 且未暂停)，但完全无画面 (renderStatus.hasVideo === false) —— 经典的 PC Chrome MKV 黑屏有声音！
    // C. 播放状态但已卡死挂起 (未暂停、currentTime 未增加或等于 0 且 readyState < 2)
    const isAudioOnlyOrBlack = !video.paused && video.currentTime > 0.3 && !renderStatus.hasVideo;
    const isStalled = !video.paused && video.currentTime === 0 && video.readyState < 2;
    const isErrored = Boolean(video.error);

    const isStalledOrBlack = isErrored || isAudioOnlyOrBlack || (isFinalCheck && isStalled);

    if (isStalledOrBlack) {
      console.warn("Watchdog 探测到视频解码卡死或黑屏/仅音频状态，自动无感切换至云端转码预览:", {
        name: item.name,
        currentTime: video.currentTime,
        videoWidth: video.videoWidth,
        renderStatus,
        isAudioOnlyOrBlack,
        isStalled,
      });

      if (blackScreenWatchdog) {
        clearTimeout(blackScreenWatchdog);
        blackScreenWatchdog = null;
      }
      if (blackScreenQuickTimer) {
        clearTimeout(blackScreenQuickTimer);
        blackScreenQuickTimer = null;
      }

      showToast("检测到浏览器画面解码受阻（黑屏/无画面），已自动为您切换为云端转码预览...", 3500);
      renderGooglePreview(item);
      return true;
    }
    return false;
  };

  // 2. 动态看门狗探测：
  // 阶段一：起播后 2.5 秒执行快速灵敏侦测 (快速捕获“只有声音但屏幕黑屏”的状态)
  blackScreenQuickTimer = setTimeout(() => {
    checkBlackScreen(false);
  }, 2500);

  // 阶段二：起播后 5 秒执行全面兜底侦测
  blackScreenWatchdog = setTimeout(() => {
    checkBlackScreen(true);
  }, 5000);

  // 3. 正常出画面时（renderStatus.hasVideo === true 且 currentTime > 0.5），清除看门狗并隐藏警告（如果静态判定为可播放）
  const onTimeUpdate = () => {
    if (art && art.video) {
      const renderStatus = checkVideoRenderStatus(art.video);
      if (art.video.currentTime > 0.5 && renderStatus.hasVideo) {
        if (blackScreenWatchdog) {
          clearTimeout(blackScreenWatchdog);
          blackScreenWatchdog = null;
        }
        if (blackScreenQuickTimer) {
          clearTimeout(blackScreenQuickTimer);
          blackScreenQuickTimer = null;
        }
        if (nativePlayable) {
          hideCodecWarning();
        }
        art.off("video:timeupdate", onTimeUpdate);
      }
    }
  };
  art.on("video:timeupdate", onTimeUpdate);
}
function showResumeBanner(seconds, onRestart) {
  if (!dom.resumePlaybackBanner || !dom.resumeBannerTime) return;
  if (resumeBannerTimer) {
    clearTimeout(resumeBannerTimer);
    resumeBannerTimer = null;
  }

  dom.resumeBannerTime.textContent = formatDuration(seconds);
  dom.resumePlaybackBanner.classList.remove("hidden");
  dom.resumePlaybackBanner.classList.add("flex");

  if (dom.resumeRestartBtn) {
    dom.resumeRestartBtn.onclick = () => {
      dom.resumePlaybackBanner.classList.add("hidden");
      dom.resumePlaybackBanner.classList.remove("flex");
      if (typeof onRestart === "function") onRestart();
    };
  }

  if (dom.resumeCloseBtn) {
    dom.resumeCloseBtn.onclick = () => {
      dom.resumePlaybackBanner.classList.add("hidden");
      dom.resumePlaybackBanner.classList.remove("flex");
    };
  }

  resumeBannerTimer = setTimeout(() => {
    if (dom.resumePlaybackBanner) {
      dom.resumePlaybackBanner.classList.add("hidden");
      dom.resumePlaybackBanner.classList.remove("flex");
    }
  }, 6000);
}

function setupResumePlayback(item, mediaElement) {
  const saved = getPlaybackProgress(item.id);
  let resumed = false;

  const tryResume = () => {
    if (resumed) return;
    if (saved && saved.time > 5 && (!saved.duration || saved.time < saved.duration - 10)) {
      resumed = true;
      try {
        mediaElement.currentTime = saved.time;
      } catch (_) {}
      showResumeBanner(saved.time, () => {
        try {
          mediaElement.currentTime = 0;
          clearPlaybackProgress(item.id);
          showToast("已从头开始播放");
        } catch (_) {}
      });
    }
  };

  mediaElement.addEventListener("loadedmetadata", tryResume, { once: true });
  mediaElement.addEventListener("canplay", tryResume, { once: true });

  // 节流定时保存播放进度 (每 2.5 秒)
  let lastSaveTime = 0;
  mediaElement.addEventListener("timeupdate", () => {
    const now = Date.now();
    if (now - lastSaveTime > 2500) {
      lastSaveTime = now;
      if (mediaElement.currentTime > 5 && mediaElement.duration && mediaElement.currentTime < mediaElement.duration - 10) {
        savePlaybackProgress(item.id, mediaElement.currentTime, mediaElement.duration, item.name);
      }
    }
  });
}

function getSubtitlesInFolder(videoItem) {
  if (!state.items || !state.items.length) return [];
  const subExts = ["vtt", "srt", "ass", "sub"];
  const subs = state.items.filter((f) => {
    if (f.isFolder) return false;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    return subExts.includes(ext);
  });

  if (!subs.length) return [];

  // 获取视频基础名称（剥离扩展名）
  const videoBase = videoItem.name.replace(/\.[^/.]+$/, "").toLowerCase();

  return subs
    .map((sub) => {
      const subBase = sub.name.replace(/\.[^/.]+$/, "").toLowerCase();
      const isMatched = subBase === videoBase || subBase.startsWith(videoBase) || videoBase.startsWith(subBase);
      return {
        item: sub,
        isMatched,
        name: sub.name,
        ext: (sub.name.split(".").pop() || "").toLowerCase(),
      };
    })
    .sort((a, b) => (b.isMatched ? 1 : 0) - (a.isMatched ? 1 : 0));
}

async function loadSubtitleTrack(subItem, makeDefault = true) {
  try {
    const streamUrl = `/api/stream/${subItem.id}`;
    let vttUrl = streamUrl;
    const ext = (subItem.name.split(".").pop() || "").toLowerCase();

    if (ext === "srt" || ext === "ass") {
      const resp = await fetch(streamUrl);
      if (!resp.ok) throw new Error("无法读取字幕流");
      const srtText = await resp.text();
      const vttText = convertSrtToVtt(srtText);
      const blob = new Blob([vttText], { type: "text/vtt;charset=utf-8" });
      if (state.activeSubtitleBlobUrl) {
        try {
          URL.revokeObjectURL(state.activeSubtitleBlobUrl);
        } catch (_) {}
      }
      vttUrl = URL.createObjectURL(blob);
      state.activeSubtitleBlobUrl = vttUrl;
    }

    state.activeSubtitleItem = subItem;
    state.currentSubtitleOffset = 0;

    // 若当前播放器是 Artplayer，直接使用其原生的 subtitle 接口
    if (state.playerInstance && state.playerInstance.subtitle) {
      state.playerInstance.subtitle.url = vttUrl;
      state.playerInstance.subtitle.show = true;
    }

    updateSubtitlesUI();
    showToast(`已挂载字幕: ${subItem.name}`);
  } catch (err) {
    console.error("加载字幕失败:", err);
    showToast(`加载字幕失败: ${err.message}`);
  }
}

async function loadLocalSubtitleFile(file) {
  try {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const text = await file.text();
    let vttText = text;
    if (ext === "srt" || ext === "ass") {
      vttText = convertSrtToVtt(text);
    }
    const blob = new Blob([vttText], { type: "text/vtt;charset=utf-8" });
    if (state.activeSubtitleBlobUrl) {
      try {
        URL.revokeObjectURL(state.activeSubtitleBlobUrl);
      } catch (_) {}
    }
    const vttUrl = URL.createObjectURL(blob);
    state.activeSubtitleBlobUrl = vttUrl;

    state.activeSubtitleItem = { id: "local", name: file.name, isLocal: true };
    state.currentSubtitleOffset = 0;

    if (state.playerInstance && state.playerInstance.subtitle) {
      state.playerInstance.subtitle.url = vttUrl;
      state.playerInstance.subtitle.show = true;
    }

    updateSubtitlesUI();
    showToast(`已挂载本地字幕: ${file.name}`);
  } catch (err) {
    showToast(`解析本地字幕失败: ${err.message}`);
  }
}

function disableSubtitles() {
  if (state.playerInstance && state.playerInstance.subtitle) {
    state.playerInstance.subtitle.show = false;
  }
  if (state.activeSubtitleBlobUrl) {
    try {
      URL.revokeObjectURL(state.activeSubtitleBlobUrl);
    } catch (_) {}
    state.activeSubtitleBlobUrl = null;
  }
  state.activeSubtitleItem = null;
  state.currentSubtitleOffset = 0;
  updateSubtitlesUI();
  showToast("已关闭字幕");
}

function adjustSubtitleOffset(deltaSeconds) {
  if (!state.playerInstance || !state.activeSubtitleItem) {
    showToast("当前暂无激活的字幕");
    return;
  }
  if (state.playerInstance && state.playerInstance.subtitle) {
    state.playerInstance.subtitle.offset = (state.playerInstance.subtitle.offset || 0) + deltaSeconds;
    state.currentSubtitleOffset = state.playerInstance.subtitle.offset;
  } else {
    state.currentSubtitleOffset = (state.currentSubtitleOffset || 0) + deltaSeconds;
  }
  const sign = state.currentSubtitleOffset > 0 ? "+" : "";
  const offsetText = `${sign}${state.currentSubtitleOffset.toFixed(1)}s`;
  if (dom.subtitleOffsetVal) dom.subtitleOffsetVal.textContent = offsetText;
  showToast(`字幕时间轴已微调: ${offsetText}`);
}

function resetSubtitleOffset() {
  if (!state.currentSubtitleOffset) {
    showToast("当前字幕偏移已是 0.0s");
    return;
  }
  if (state.playerInstance && state.playerInstance.subtitle) {
    state.playerInstance.subtitle.offset = 0;
  }
  state.currentSubtitleOffset = 0;
  if (dom.subtitleOffsetVal) dom.subtitleOffsetVal.textContent = "0.0s";
  showToast("字幕时间轴已重置为 0.0s");
}

function updateSubtitlesUI() {
  if (state.activeSubtitleItem) {
    if (dom.playerSubtitlesIndicator) dom.playerSubtitlesIndicator.classList.remove("hidden");
    if (dom.currentSubLabel) dom.currentSubLabel.textContent = state.activeSubtitleItem.name || "已开启";
    if (dom.playerSubtitlesBtn) dom.playerSubtitlesBtn.classList.add("text-brand-400");
  } else {
    if (dom.playerSubtitlesIndicator) dom.playerSubtitlesIndicator.classList.add("hidden");
    if (dom.currentSubLabel) dom.currentSubLabel.textContent = "未开启";
    if (dom.playerSubtitlesBtn) dom.playerSubtitlesBtn.classList.remove("text-brand-400");
  }
  if (dom.subtitleOffsetVal) {
    const sign = (state.currentSubtitleOffset || 0) > 0 ? "+" : "";
    dom.subtitleOffsetVal.textContent = `${sign}${(state.currentSubtitleOffset || 0).toFixed(1)}s`;
  }
}

function renderSubtitlesMenu(videoItem, subList, video) {
  if (!dom.subtitlesTrackList) return;

  let html = `
    <!-- 关闭字幕 -->
    <button type="button" class="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-300 transition-colors sub-track-item ${!state.activeSubtitleItem ? 'text-brand-400 font-medium bg-brand-500/10' : ''}" data-sub-action="disable">
      <div class="flex items-center gap-2">
        <i data-lucide="eye-off" class="w-3.5 h-3.5"></i>
        <span>关闭字幕</span>
      </div>
      ${!state.activeSubtitleItem ? '<i data-lucide="check" class="w-3.5 h-3.5 text-brand-400"></i>' : ''}
    </button>
  `;

  if (subList && subList.length > 0) {
    html += `<div class="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">目录内检测到字幕 (${subList.length})</div>`;
    subList.forEach((s) => {
      const isActive = state.activeSubtitleItem && state.activeSubtitleItem.id === s.item.id;
      html += `
        <button type="button" class="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-800 text-slate-300 transition-colors sub-track-item ${isActive ? 'text-brand-400 font-medium bg-brand-500/10' : ''}" data-sub-id="${s.item.id}">
          <div class="flex items-center gap-2 min-w-0 pr-2">
            <span class="text-[10px] font-mono px-1 py-0.2 rounded ${s.isMatched ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">${s.ext.toUpperCase()}</span>
            <span class="truncate text-xs ${s.isMatched ? 'text-white' : 'text-slate-300'}">${escapeHtml(s.name)}</span>
          </div>
          ${isActive ? '<i data-lucide="check" class="w-3.5 h-3.5 text-brand-400 flex-shrink-0"></i>' : ''}
        </button>
      `;
    });
  } else {
    html += `
      <div class="px-3 py-2 text-slate-500 text-[11px] text-center">
        当前目录下未检测到字幕文件
      </div>
    `;
  }

  dom.subtitlesTrackList.innerHTML = html;
  if (window.lucide) lucide.createIcons();

  // 绑定点击事件
  dom.subtitlesTrackList.querySelectorAll(".sub-track-item").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const action = btn.getAttribute("data-sub-action");
      if (action === "disable") {
        disableSubtitles();
        renderSubtitlesMenu(videoItem, subList);
        return;
      }
      const subId = btn.getAttribute("data-sub-id");
      const target = subList.find((s) => s.item.id === subId);
      if (target) {
        await loadSubtitleTrack(target.item, true);
        renderSubtitlesMenu(videoItem, subList);
      }
    };
  });
}

async function autoDetectAndAttachSubtitles(videoItem) {
  if (state.activeSubtitleBlobUrl) {
    try {
      URL.revokeObjectURL(state.activeSubtitleBlobUrl);
    } catch (_) {}
    state.activeSubtitleBlobUrl = null;
  }
  state.activeSubtitleItem = null;
  state.currentSubtitleOffset = 0;

  const subList = getSubtitlesInFolder(videoItem);
  renderSubtitlesMenu(videoItem, subList);

  // 存在自动匹配的同名字幕时，优先直接挂载
  const matched = subList.find((s) => s.isMatched);
  if (matched) {
    await loadSubtitleTrack(matched.item, true);
    renderSubtitlesMenu(videoItem, subList);
  } else {
    updateSubtitlesUI();
  }
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
  updatePlayerDownloadHref(item);

  // 统一标准播放器弹窗规范：稳定剧场视口，杜绝不同视频比例导致弹窗尺寸跳变与变形
  if (dom.playerDialog) {
    dom.playerDialog.classList.remove(
      "w-screen",
      "h-screen",
      "max-w-none",
      "max-h-none",
      "rounded-none",
      "border-0",
      "max-w-md",
      "sm:max-w-lg"
    );
    dom.playerDialog.classList.add(
      "w-full",
      "max-w-6xl",
      "h-[80vh]",
      "max-h-[820px]",
      "min-h-[380px]",
      "rounded-2xl",
      "border",
      "border-slate-800"
    );
  }

  // 携带文件名参数请求流代理，使后端 Content-Type 识别与外部播放器识别更精准
  const streamUrl = `${window.location.origin}/api/stream/${item.id}?filename=${encodeURIComponent(item.name)}`;
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

  // 关键时序优化：先展示弹窗，使容器完成真实像素尺寸布局，杜绝 Artplayer 初始化时容器尺寸为 0 导致的视口与黑边计算突变
  dom.playerModal.classList.remove("hidden");
  dom.playerModal.classList.add("flex");

  // 智能起播策略与自动选源：
  if (item.isVideo) {
    dom.playerTypeIcon.setAttribute("data-lucide", "film");
    // 自动检测用户浏览器解码能力；若已知当前环境不支持该编码/容器（如 Safari 下 MKV、缺少 HEVC 硬解等）
    if (!canBrowserPlayNatively(item)) {
      console.info("浏览器环境不支持此视频编码或容器，自动切换至云端转码预览播放:", item.name);
      showToast("检测到当前浏览器无法原生硬解此格式，已自动为您启用云端转码预览", 3500);
      renderGooglePreview(item);
    } else {
      renderPlayerMedia(item, streamUrl);
    }
  } else {
    dom.playerTypeIcon.setAttribute("data-lucide", "music");
    hideCodecWarning();
    renderPlayerMedia(item, streamUrl);
  }

  updateStreamSourceUI();
  updateAutoplayUI();

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 渲染 Google 官方转码预览（纯 CSS 视口顶栏 56px 精准裁切，彻底消除右上角 Pop-out 弹出按钮遮挡，解除沙箱封锁恢复音画起播）
function renderGooglePreview(item) {
  destroyPlayer();
  state.isGooglePreview = true;
  hideCodecWarning();

  // 标准化 Google Drive 官方预览端点（对齐历史上正常工作的 7b562ed / 741d227 规范）
  const previewUrl = `https://drive.google.com/file/d/${item.id}/preview`;

  // 1. 视口精准裁切模式：外层容器 overflow: hidden，iframe 向上偏移 -56px 配合 height: calc(100% + 56px) 等量几何补偿；
  //    彻底将 Google 原生 56px Material 顶栏及右上角 Pop-out (在新窗口打开) 图标推移出视口外，0 黑块瑕疵、0 画面遮挡；
  //    几何闭环证明：(-56px) + (100% + 56px) = 100%，iframe 底部与视口底部严格对齐，底部播放进度条与控制按钮 100% 完整可见；
  // 2. 恢复历史正常版本：移除破坏性受限沙箱，赋予完整硬件解码、全屏与自动播放特权 (allow 属性)；
  // 3. 为外层容器提供显式 min-height: 480px 兜底，杜绝 flex 容器在对话框初始展开时产生 0px 高度塌陷；
  // 4. 零遮挡与反退化保证：不引入任何遮罩层 DOM，完美符合 CI-Check 步骤 5 零遮挡门禁。
  dom.mediaWrapper.innerHTML = `
    <div id="google-preview-container" class="relative w-full h-full overflow-hidden bg-black ${state.isPlayerMaximized ? "" : "rounded-b-2xl"}" style="min-height: 480px; height: 100%;">
      <iframe 
        id="google-preview-iframe"
        src="${previewUrl}" 
        class="border-0 w-full" 
        style="position: absolute; top: -56px; left: 0; width: 100%; height: calc(100% + 56px);"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        loading="eager"
      ></iframe>
    </div>
  `;
  updateStreamSourceUI();
  updateSubtitlesUI();
}

// 渲染播放器内部内容 (Artplayer 现代全功能播放内核，对齐 OpenList)
function renderPlayerMedia(item, streamUrl) {
  destroyPlayer();
  state.isGooglePreview = false;
  dom.mediaWrapper.innerHTML = "";

  const savedSpeed = parseFloat(localStorage.getItem(SPEED_STORAGE_KEY)) || 1;
  const saved = getPlaybackProgress(item.id);

  if (item.isVideo) {
    dom.playerTypeIcon.setAttribute("data-lucide", "film");

    const artContainer = document.createElement("div");
    artContainer.className = "w-full h-full relative";
    artContainer.id = "artplayer-container";
    dom.mediaWrapper.appendChild(artContainer);

    // 初始化 Artplayer
    const videoExt = (item.name.split(".").pop() || "").toLowerCase();
    const isHls = videoExt === "m3u8";
    const isFlv = videoExt === "flv";
    const isMkv = videoExt === "mkv";
    const detectedType = isHls ? "m3u8" : isFlv ? "flv" : isMkv ? "mkv" : (videoExt || "mp4");

    state.playerInstance = new Artplayer({
      container: artContainer,
      url: streamUrl,
      type: detectedType,
      title: item.name,
      poster: "",
      volume: 0.8,
      isLive: false,
      muted: false,
      autoplay: true,
      pip: true,
      autoSize: false,
      autoMini: false,
      screenshot: true,
      setting: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: true,
      playsInline: true,
      airplay: true,
      theme: "#f97316", // 品牌橙色
      lang: "zh-cn",
      moreVideoAttr: {
        crossOrigin: "anonymous",
      },
      customType: {
        m3u8: function (video, url, art) {
          if (window.Hls && Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hls.loadSource(url);
            hls.attachMedia(video);
            art.on("destroy", () => {
              try {
                hls.destroy();
              } catch (_) {}
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
          } else {
            art.notice.show = "当前浏览器不支持播放 M3U8 流媒体";
          }
        },
        flv: function (video, url, art) {
          if (window.flvjs && flvjs.isSupported()) {
            const flvPlayer = flvjs.createPlayer({
              type: "flv",
              url: url,
            });
            flvPlayer.attachMediaElement(video);
            flvPlayer.load();
            art.on("destroy", () => {
              try {
                flvPlayer.destroy();
              } catch (_) {}
            });
          } else {
            video.src = url;
          }
        },
        mkv: function (video, url, art) {
          // MKV 容器定制挂载：支持环境直接原生解封装起播，并挂载解码失败自动降级监听
          video.src = url;
          const onMkvError = () => {
            console.warn("MKV 原生底层解码失败，自动切换至云端转码预览播放");
            showToast("当前浏览器无法解码此 MKV，已自动无感切换为云端转码预览...", 3500);
            renderGooglePreview(item);
          };
          video.addEventListener("error", onMkvError, { once: true });
          art.on("destroy", () => {
            video.removeEventListener("error", onMkvError);
          });

          if (art.option.autoplay) {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === "function") {
              playPromise.catch((e) => {
                console.warn("MKV 原生播放受浏览器策略拦截:", e);
              });
            }
          }
        },
      },
    });

    // 监听 Artplayer 事件
    state.playerInstance.on("ready", () => {
      // 触发播放器尺寸重校准，确保无黑边跳变与尺寸偏差
      if (typeof state.playerInstance.resize === "function") {
        state.playerInstance.resize();
      }

      // 恢复倍速
      if (savedSpeed !== 1) {
        state.playerInstance.playbackRate = savedSpeed;
      }

      // 记忆断点续播
      if (saved && saved.time > 5 && (!saved.duration || saved.time < saved.duration - 10)) {
        state.playerInstance.currentTime = saved.time;
        showResumeBanner(saved.time, () => {
          try {
            state.playerInstance.currentTime = 0;
            clearPlaybackProgress(item.id);
            showToast("已从头开始播放");
          } catch (_) {}
        });
      }

      // 启动黑屏与解码看门狗检测
      startMediaWatchdog(item, state.playerInstance);
    });

    state.playerInstance.on("video:ratechange", () => {
      if (state.playerInstance && state.playerInstance.playbackRate) {
        localStorage.setItem(SPEED_STORAGE_KEY, state.playerInstance.playbackRate);
      }
    });

    // 节流定时保存播放进度
    let lastSaveTime = 0;
    state.playerInstance.on("video:timeupdate", () => {
      const now = Date.now();
      if (now - lastSaveTime > 2500) {
        lastSaveTime = now;
        const cur = state.playerInstance.currentTime;
        const dur = state.playerInstance.duration;
        if (cur > 5 && dur && cur < dur - 10) {
          savePlaybackProgress(item.id, cur, dur, item.name);
        }
      }
    });

    // 播完连播下一集
    state.playerInstance.on("video:ended", () => {
      clearPlaybackProgress(item.id);
      if (state.autoPlayNext) {
        playAdjacentEpisode(1);
      }
    });

    // 播放异常自动智能降级至 Google 云端转码预览
    state.playerInstance.on("error", (error) => {
      console.warn("Artplayer 遇到播放错误，自动切换至云端转码预览播放:", error);
      showToast("检测到浏览器无法正常解码播放，已自动为您无感切换为云端转码预览...", 3500);
      renderGooglePreview(item);
    });

    // 原生底层 HTML5 <video> 错误深度拦截 (MEDIA_ERR_DECODE / MEDIA_ERR_SRC_NOT_SUPPORTED / 网络错误)
    if (state.playerInstance.video) {
      const onNativeVideoError = () => {
        console.warn("HTML5 video 底层硬件解码或媒体源加载失败，自动降级至 Google 预览");
        showToast("检测到底层硬件解码失败或格式受限，已自动切换为云端转码预览...", 3500);
        renderGooglePreview(item);
      };
      state.playerInstance.video.addEventListener("error", onNativeVideoError, { once: true });
    }

    // 自动挂载同名外挂字幕 (OpenList 影音体验)
    autoDetectAndAttachSubtitles(item);
  } else {
    // 音频播放：优雅居中卡片，杜绝空旷与变形
    dom.playerTypeIcon.setAttribute("data-lucide", "music");
    const audioCard = document.createElement("div");
    audioCard.className =
      "w-full max-w-md mx-4 p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col items-center gap-5 text-center";
    audioCard.innerHTML = `
      <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-600/30 to-amber-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-xl shadow-brand-500/10">
        <i data-lucide="music" class="w-10 h-10"></i>
      </div>
      <div class="w-full min-w-0">
        <h3 class="text-sm sm:text-base font-semibold text-slate-100 truncate" title="${item.name}">${item.name}</h3>
        <p class="text-xs text-slate-400 mt-1">原生无损音频直出</p>
      </div>
      <audio id="active-player" controls autoplay src="${streamUrl}" class="w-full mt-2"></audio>
    `;
    dom.mediaWrapper.appendChild(audioCard);

    const audio = audioCard.querySelector("audio");
    state.playerInstance = audio;
    if (savedSpeed !== 1) {
      audio.playbackRate = savedSpeed;
    }

    setupResumePlayback(item, audio);

    audio.addEventListener("ended", () => {
      clearPlaybackProgress(item.id);
      if (state.autoPlayNext) {
        playAdjacentEpisode(1);
      }
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  updateStreamSourceUI();
  updateSubtitlesUI();
}

// 在 Google 预览 与 4K/原始无损原画直链之间一秒热切换
function toggleStreamSource() {
  const item = state.activeMediaItem;
  if (!item || !item.isVideo) return;

  const streamUrl = `${window.location.origin}/api/stream/${item.id}`;
  const resBadge = getVideoResolution(item);
  const is4K = resBadge === "4K" || /(4k|2160p|uhd)/i.test(item.name);

  if (state.isGooglePreview) {
    showToast(is4K ? "正在切换至 4K 原画直链播放..." : "正在切换至内置原画播放...");
    renderPlayerMedia(item, streamUrl);
  } else {
    showToast("正在切换至 Google 云端转码预览 (受限安全模式)...");
    renderGooglePreview(item);
  }
}

// 切换播放器最大化 / 还原
function togglePlayerMaximize() {
  state.isPlayerMaximized = !state.isPlayerMaximized;

  const previewContainer = document.getElementById("google-preview-container");

  if (state.isPlayerMaximized) {
    // 最大化模式：纯 CSS 切换，撑满整个视口，iframe 毫秒不差平滑伸展，绝不重载视频！
    dom.playerModal.classList.remove("p-2", "sm:p-4", "md:p-6", "p-3", "sm:p-6");
    dom.playerModal.classList.add("p-0");

    dom.playerDialog.classList.remove(
      "max-w-6xl",
      "max-w-md",
      "sm:max-w-lg",
      "h-[80vh]",
      "h-[84vh]",
      "h-[88vh]",
      "max-h-[860px]",
      "min-h-[380px]",
      "rounded-2xl",
      "border",
      "border-slate-800"
    );
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
    // 还原窗口模式：恢复统一标准规格
    dom.playerModal.classList.add("p-2", "sm:p-4", "md:p-6");
    dom.playerModal.classList.remove("p-0", "p-3", "sm:p-6");

    dom.playerDialog.classList.remove("w-screen", "h-screen", "max-w-none", "max-h-none", "rounded-none", "border-0");
    dom.playerDialog.classList.add(
      "max-w-6xl",
      "h-[80vh]",
      "max-h-[820px]",
      "min-h-[380px]",
      "rounded-2xl",
      "border",
      "border-slate-800"
    );

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
    dom.playerModal.classList.add("p-2", "sm:p-4", "md:p-6");
    dom.playerModal.classList.remove("p-0");
    dom.playerDialog.classList.remove("w-screen", "h-screen", "max-w-none", "max-h-none", "rounded-none", "border-0");
    if (dom.playerMaximizeIcon) {
      dom.playerMaximizeIcon.setAttribute("data-lucide", "maximize-2");
    }
  }

  if (dom.playerDialog) {
    dom.playerDialog.classList.remove(
      "max-w-md",
      "sm:max-w-lg",
      "h-[84vh]",
      "h-[88vh]",
      "w-screen",
      "h-screen",
      "max-w-none",
      "max-h-none",
      "rounded-none",
      "border-0"
    );
    dom.playerDialog.classList.add(
      "max-w-6xl",
      "h-[80vh]",
      "max-h-[820px]",
      "min-h-[380px]",
      "rounded-2xl",
      "border",
      "border-slate-800"
    );
  }
  if (dom.streamSourceToggleBtn) {
    dom.streamSourceToggleBtn.classList.add("hidden");
    dom.streamSourceToggleBtn.classList.remove("flex");
  }
  dom.extPlayerMenu.classList.add("hidden");
  if (dom.playerSubtitlesMenu) dom.playerSubtitlesMenu.classList.add("hidden");
  dom.playerModal.classList.add("hidden");
  dom.playerModal.classList.remove("flex");
}

function destroyPlayer() {
  hideCodecWarning();
  if (blackScreenWatchdog) {
    clearTimeout(blackScreenWatchdog);
    blackScreenWatchdog = null;
  }
  if (blackScreenQuickTimer) {
    clearTimeout(blackScreenQuickTimer);
    blackScreenQuickTimer = null;
  }
  if (resumeBannerTimer) {
    clearTimeout(resumeBannerTimer);
    resumeBannerTimer = null;
  }
  if (dom.resumePlaybackBanner) {
    dom.resumePlaybackBanner.classList.add("hidden");
    dom.resumePlaybackBanner.classList.remove("flex");
  }
  if (state.activeSubtitleBlobUrl) {
    try {
      URL.revokeObjectURL(state.activeSubtitleBlobUrl);
    } catch (_) {}
    state.activeSubtitleBlobUrl = null;
  }
  state.activeSubtitleItem = null;
  state.currentSubtitleOffset = 0;
  updateSubtitlesUI();

  if (state.playerInstance) {
    try {
      if (typeof state.playerInstance.destroy === "function") {
        state.playerInstance.destroy();
      } else if (state.playerInstance.pause) {
        state.playerInstance.pause();
        state.playerInstance.src = "";
      }
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
      hideCodecWarning();
    });
  }

  // 提示条中一键切换云端转码预览降级
  if (dom.bannerFallbackPreviewBtn) {
    dom.bannerFallbackPreviewBtn.addEventListener("click", () => {
      if (state.activeMediaItem) {
        showToast("正在为您切换为 Google 云端转码预览播放...");
        renderGooglePreview(state.activeMediaItem);
      }
    });
  }

  // 画质源切换 (4K 原画 与 Google 预览)
  if (dom.streamSourceToggleBtn) {
    dom.streamSourceToggleBtn.addEventListener("click", toggleStreamSource);
  }

  // 拦截播放器下载按钮与外部播放器空链接的默认行为
  if (dom.playerDownloadBtn) {
    dom.playerDownloadBtn.addEventListener("click", (e) => {
      const href = dom.playerDownloadBtn.getAttribute("href");
      if (!href || href === "#") {
        e.preventDefault();
      }
    });
  }

  [dom.btnMpv, dom.btnExoplayer, dom.btnPotplayer, dom.btnVlc, dom.btnIina, dom.btnInfuse].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", (e) => {
        const href = btn.getAttribute("href");
        if (!href || href === "#") {
          e.preventDefault();
          showToast("未检测到有效视频流地址");
        }
      });
    }
  });

  // 外部播放器菜单点击切换
  dom.extPlayerMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dom.extPlayerMenu.classList.toggle("hidden");
    if (dom.playerSubtitlesMenu) dom.playerSubtitlesMenu.classList.add("hidden");
  });

  // 外挂字幕菜单点击切换 (OpenList 播放器增强)
  if (dom.playerSubtitlesBtn && dom.playerSubtitlesMenu) {
    dom.playerSubtitlesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.isGooglePreview) {
        showToast("外挂字幕将在切换为原画直链播放时生效，点击片名旁【切换原画】即可启用！");
      }
      dom.playerSubtitlesMenu.classList.toggle("hidden");
      if (dom.extPlayerMenu) dom.extPlayerMenu.classList.add("hidden");
    });
  }

  // 本地上传字幕触发 (.srt / .vtt)
  if (dom.btnUploadLocalSub && dom.localSubInput) {
    dom.btnUploadLocalSub.addEventListener("click", (e) => {
      e.stopPropagation();
      dom.localSubInput.click();
    });

    dom.localSubInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      loadLocalSubtitleFile(file);
      if (dom.playerSubtitlesMenu) dom.playerSubtitlesMenu.classList.add("hidden");
      e.target.value = "";
    });
  }

  // 字幕时间轴微调按键绑定 (+0.5s / -0.5s / 重置)
  if (dom.btnSubDelay) {
    dom.btnSubDelay.addEventListener("click", (e) => {
      e.stopPropagation();
      adjustSubtitleOffset(0.5);
    });
  }
  if (dom.btnSubAdvance) {
    dom.btnSubAdvance.addEventListener("click", (e) => {
      e.stopPropagation();
      adjustSubtitleOffset(-0.5);
    });
  }
  if (dom.btnSubReset) {
    dom.btnSubReset.addEventListener("click", (e) => {
      e.stopPropagation();
      resetSubtitleOffset();
    });
  }

  // 点击外部空白区域自动关闭所有菜单
  document.addEventListener("click", () => {
    dom.extPlayerMenu.classList.add("hidden");
    if (dom.playerSubtitlesMenu) dom.playerSubtitlesMenu.classList.add("hidden");
  });

  // 前台站点访问密码表单提交
  if (dom.sitePasswordForm) {
    dom.sitePasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pwd = dom.sitePasswordInput.value.trim();
      if (!pwd) return;

      try {
        const res = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify_access", password: pwd }),
        });
        const data = await res.json();
        if (data.success && data.token) {
          state.accessToken = data.token;
          localStorage.setItem("access_token", data.token);
          closeSitePasswordModal();
          showToast("密码验证成功！");
          loadFolder(state.currentFolderId);
        } else {
          showToast(data.error || "访问密码错误");
        }
      } catch (err) {
        showToast("验证失败: " + err.message);
      }
    });
  }

  // 打开后台管理模态框
  if (dom.adminEntryBtn) {
    dom.adminEntryBtn.addEventListener("click", () => {
      openAdminModal();
    });
  }

  if (dom.closeAdminBtn) {
    dom.closeAdminBtn.addEventListener("click", closeAdminModal);
  }

  // 点击外部遮罩层自动平滑关闭后台管理窗口
  if (dom.adminModal) {
    dom.adminModal.addEventListener("click", (e) => {
      // 严格判定：当且仅当点击事件的目标为最外层遮罩容器自身时触发关闭，内部所有交互均不会误触
      if (e.target === dom.adminModal) {
        closeAdminModal();
      }
    });
  }

  // 管理员登录表单
  if (dom.adminLoginForm) {
    dom.adminLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pwd = dom.adminPasswordInput.value.trim();
      if (!pwd) return;

      try {
        const res = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "admin_login", password: pwd }),
        });
        const data = await res.json();
        if (data.success && data.token) {
          state.adminToken = data.token;
          state.isAdmin = true;
          localStorage.setItem("admin_token", data.token);
          dom.adminPasswordInput.value = "";
          updateAdminUIState();
          showToast("管理员登录成功！");
          loadAdminDashboard();
          renderItems(); // 重新渲染列表以展示管理员专属按钮
        } else {
          showToast(data.error || "管理员密码错误");
        }
      } catch (err) {
        showToast("登录请求失败: " + err.message);
      }
    });
  }

  // 保存系统配置表单
  if (dom.adminConfigForm) {
    dom.adminConfigForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const siteName = dom.cfgSiteName.value.trim();
      const requirePassword = dom.cfgRequirePassword.checked;
      const accessPassword = dom.cfgAccessPassword.value.trim();
      const newAdminPassword = dom.cfgNewAdminPassword.value.trim();

      if (requirePassword && !accessPassword) {
        showToast("开启密码保护时，访客密码不能为空！");
        return;
      }

      try {
        const res = await fetch("/api/admin/config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.adminToken}`,
          },
          body: JSON.stringify({
            siteName,
            requirePassword,
            accessPassword,
            newAdminPassword,
          }),
        });

        const data = await res.json();
        if (data.success) {
          showToast("系统设置保存成功！" + (data.persisted === "kv" ? "（已持久化至 KV）" : ""));
          if (siteName) {
            dom.siteTitle.textContent = siteName;
            document.title = siteName;
          }
          if (newAdminPassword) {
            dom.cfgNewAdminPassword.value = "";
            if (data.newToken) {
              state.adminToken = data.newToken;
              localStorage.setItem("admin_token", data.newToken);
            }
          }
        } else {
          showToast("保存失败: " + (data.error || "未知原因"));
        }
      } catch (err) {
        showToast("保存异常: " + err.message);
      }
    });
  }

  // 后台退出登录
  if (dom.adminLogoutBtn) {
    dom.adminLogoutBtn.addEventListener("click", () => {
      state.adminToken = "";
      state.isAdmin = false;
      localStorage.removeItem("admin_token");
      updateAdminUIState();
      dom.adminModal.classList.add("hidden");
      dom.adminModal.classList.remove("flex");
      showToast("已退出管理员模式");
      renderItems();
    });
  }

  // 访客密码开关切换
  if (dom.cfgRequirePassword) {
    dom.cfgRequirePassword.addEventListener("change", (e) => {
      if (dom.cfgAccessPasswordContainer) {
        dom.cfgAccessPasswordContainer.classList.toggle("opacity-40", !e.target.checked);
      }
    });
  }

  // 文件操作表单提交
  if (dom.fileActionForm) {
    dom.fileActionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = dom.fileActionInput.value.trim();
      if (!val) return;

      const action = currentFileAction.action;
      const fileId = currentFileAction.fileId;
      const shortcutId = currentFileAction.shortcutId;

      if (action === "rename") {
        await executeFileOperation({ action: "rename", fileId, shortcutId, newName: val });
      } else if (action === "move") {
        await executeFileOperation({ action: "move", fileId, shortcutId, targetFolderId: val });
      } else if (action === "create_folder") {
        await executeFileOperation({ action: "create_folder", name: val, parentFolderId: state.currentFolderId });
      }

      closeFileActionModal();
    });
  }

  if (dom.cancelFileActionBtn) {
    dom.cancelFileActionBtn.addEventListener("click", closeFileActionModal);
  }

  // ==================== 批量操作与 OpenList 多选模式事件绑定 ====================
  // 显式多选开关按钮
  if (dom.toggleSelectModeBtn) {
    dom.toggleSelectModeBtn.addEventListener("click", () => {
      toggleSelectMode();
    });
  }

  // 全选 / 反选复选框 (表头)
  if (dom.selectAllCheckbox) {
    dom.selectAllCheckbox.addEventListener("change", (e) => {
      toggleSelectAllCurrentPage(e.target.checked);
    });
  }

  // 底部工具栏全选按钮
  if (dom.batchSelectAllBtn) {
    dom.batchSelectAllBtn.addEventListener("click", () => {
      toggleSelectAllCurrentPage(true);
    });
  }

  // 底部工具栏反选按钮
  if (dom.batchInvertSelectionBtn) {
    dom.batchInvertSelectionBtn.addEventListener("click", () => {
      invertSelectionCurrentPage();
    });
  }

  // 清空选中并退出多选
  if (dom.batchClearSelectionBtn) {
    dom.batchClearSelectionBtn.addEventListener("click", () => {
      exitSelectMode();
    });
  }

  // 触发批量重命名模态框
  if (dom.batchRenameTriggerBtn) {
    dom.batchRenameTriggerBtn.addEventListener("click", () => {
      openBatchRenameModal();
    });
  }

  // 触发批量移动模态框
  if (dom.batchMoveTriggerBtn) {
    dom.batchMoveTriggerBtn.addEventListener("click", () => {
      openBatchMoveModal();
    });
  }

  // 触发批量删除模态框
  if (dom.batchDeleteTriggerBtn) {
    dom.batchDeleteTriggerBtn.addEventListener("click", () => {
      openBatchDeleteModal();
    });
  }

  // 批量重命名：关闭与取消
  if (dom.closeBatchRenameBtn) {
    dom.closeBatchRenameBtn.addEventListener("click", closeBatchRenameModal);
  }
  if (dom.cancelBatchRenameBtn) {
    dom.cancelBatchRenameBtn.addEventListener("click", closeBatchRenameModal);
  }

  // 批量重命名：Tab 切换
  if (dom.batchRenameTabReplace) {
    dom.batchRenameTabReplace.addEventListener("click", () => setBatchRenameTab("replace"));
  }
  if (dom.batchRenameTabAffix) {
    dom.batchRenameTabAffix.addEventListener("click", () => setBatchRenameTab("affix"));
  }
  if (dom.batchRenameTabSequence) {
    dom.batchRenameTabSequence.addEventListener("click", () => setBatchRenameTab("sequence"));
  }

  // 批量重命名：各输入项实时触发预览更新
  const batchInputs = [
    dom.batchReplaceFindInput,
    dom.batchReplaceToInput,
    dom.batchPrefixInput,
    dom.batchSuffixInput,
    dom.batchSeqBaseInput,
    dom.batchSeqStartInput,
    dom.batchSeqDigitsInput,
  ];
  batchInputs.forEach((inputEl) => {
    if (inputEl) {
      inputEl.addEventListener("input", updateBatchRenamePreview);
    }
  });

  // 批量重命名：表单提交
  if (dom.batchRenameForm) {
    dom.batchRenameForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitBatchRename();
    });
  }

  // 批量移动：关闭与取消
  if (dom.closeBatchMoveBtn) {
    dom.closeBatchMoveBtn.addEventListener("click", closeBatchMoveModal);
  }
  if (dom.cancelBatchMoveBtn) {
    dom.cancelBatchMoveBtn.addEventListener("click", closeBatchMoveModal);
  }

  // 批量移动：快捷下拉目标选择
  if (dom.batchMoveQuickSelect && dom.batchMoveFolderIdInput) {
    dom.batchMoveQuickSelect.addEventListener("change", (e) => {
      if (e.target.value) {
        dom.batchMoveFolderIdInput.value = e.target.value;
      }
    });
  }

  // 批量移动：表单提交
  if (dom.batchMoveForm) {
    dom.batchMoveForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitBatchMove();
    });
  }

  // 批量删除：取消与确认
  if (dom.cancelBatchDeleteBtn) {
    dom.cancelBatchDeleteBtn.addEventListener("click", closeBatchDeleteModal);
  }
  if (dom.confirmBatchDeleteBtn) {
    dom.confirmBatchDeleteBtn.addEventListener("click", () => {
      submitBatchDelete();
    });
  }

  // 键盘 Esc 关闭
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePlayer();
      closeImagePreview();
      closeAdminModal();
      closeAudioStudio();
      closeDocViewer();
    }
  });

  // 主题切换绑定
  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.addEventListener("click", toggleTheme);
  }

  // 音频专注视窗事件绑定
  if (dom.closeAudioStudioBtn) {
    dom.closeAudioStudioBtn.addEventListener("click", closeAudioStudio);
  }
  if (dom.audioPlayToggleBtn) {
    dom.audioPlayToggleBtn.addEventListener("click", toggleAudioPlayback);
  }
  if (dom.audioPrevBtn) {
    dom.audioPrevBtn.addEventListener("click", playPrevAudio);
  }
  if (dom.audioNextBtn) {
    dom.audioNextBtn.addEventListener("click", playNextAudio);
  }
  if (dom.audioPlaylistToggleBtn && dom.audioPlaylistDrawer) {
    dom.audioPlaylistToggleBtn.addEventListener("click", () => {
      dom.audioPlaylistDrawer.classList.toggle("hidden");
    });
  }
  if (dom.closeAudioPlaylistBtn && dom.audioPlaylistDrawer) {
    dom.closeAudioPlaylistBtn.addEventListener("click", () => {
      dom.audioPlaylistDrawer.classList.add("hidden");
    });
  }

  // 文档查看器事件绑定
  if (dom.closeDocViewerBtn) {
    dom.closeDocViewerBtn.addEventListener("click", closeDocViewer);
  }

  // 点击遮罩背景关闭
  dom.playerModal.addEventListener("click", (e) => {
    if (e.target === dom.playerModal) closePlayer();
  });
  dom.imageModal.addEventListener("click", (e) => {
    if (e.target === dom.imageModal) closeImagePreview();
  });
  if (dom.audioStudioModal) {
    dom.audioStudioModal.addEventListener("click", (e) => {
      if (e.target === dom.audioStudioModal) closeAudioStudio();
    });
  }
  if (dom.docViewerModal) {
    dom.docViewerModal.addEventListener("click", (e) => {
      if (e.target === dom.docViewerModal) closeDocViewer();
    });
  }
}

// 启动入口
async function init() {
  initTheme();
  setupEventListeners();
  if (state.viewMode === "list") {
    dom.viewIcon.setAttribute("data-lucide", "list");
  }
  await checkSystemInfo();
}

document.addEventListener("DOMContentLoaded", init);
