/**
 * 图提取 ImageGrab - 画廊页
 * 职责：展示提取结果、勾选、单张/批量下载 PNG、打包 ZIP。
 */
(function () {
  'use strict';

  var MIN_SIZE = 100;
  var SOURCE_LABELS = {
    img: '页面图片',
    srcset: '响应式图',
    background: '背景图',
    meta: '分享图'
  };

  var els = {
    pageTitle: document.getElementById('pageTitle'),
    pageMeta: document.getElementById('pageMeta'),
    sourceLink: document.getElementById('sourceLink'),
    sourceHost: document.getElementById('sourceHost'),
    stats: document.getElementById('stats'),
    totalCount: document.getElementById('totalCount'),
    selectedCount: document.getElementById('selectedCount'),
    filteredCount: document.getElementById('filteredCount'),
    toolbar: document.getElementById('toolbar'),
    selectAll: document.getElementById('selectAll'),
    invert: document.getElementById('invert'),
    selectionText: document.getElementById('selectionText'),
    downloadPng: document.getElementById('downloadPng'),
    downloadZip: document.getElementById('downloadZip'),
    grid: document.getElementById('grid'),
    emptyState: document.getElementById('emptyState'),
    progress: document.getElementById('progress'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    progressBar: document.getElementById('progressBar'),
    toast: document.getElementById('toast'),
    preview: document.getElementById('preview'),
    previewImage: document.getElementById('previewImage'),
    previewName: document.getElementById('previewName'),
    previewSize: document.getElementById('previewSize'),
    previewOriginal: document.getElementById('previewOriginal'),
    previewDownload: document.getElementById('previewDownload'),
    previewClose: document.getElementById('previewClose')
  };

  var state = {
    items: [],
    selected: new Set(),
    filtered: 0,
    busy: false,
    previewIndex: -1,
    toastTimer: null
  };

  /* ---------- 初始化 ---------- */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindEvents();
    if (typeof JSZip === 'undefined') {
      els.downloadZip.disabled = true;
      els.downloadZip.title = 'ZIP 组件加载失败';
    }
    loadSession();
  }

  async function loadSession() {
    try {
      var data = await chrome.storage.local.get('lastSession');
      var session = data.lastSession;
      if (!session || !Array.isArray(session.images) || session.images.length === 0) {
        showEmpty();
        return;
      }

      state.items = session.images.map(function (img, index) {
        return {
          url: img.url,
          source: img.source || 'img',
          width: img.width || 0,
          height: img.height || 0,
          index: index,
          filename: '商品图_' + String(index + 1).padStart(3, '0') + '.png',
          filtered: false
        };
      });
      state.selected = new Set(state.items.map(function (item) { return item.index; }));
      state.filtered = 0;

      renderHeader(session);
      renderGrid();
      updateCounts();
    } catch (error) {
      showEmpty();
    }
  }

  function renderHeader(session) {
    els.pageTitle.textContent = session.pageTitle || '商品图片';
    var time = '';
    if (session.createdAt) {
      var date = new Date(session.createdAt);
      if (!isNaN(date.getTime())) {
        time = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
      }
    }
    els.pageMeta.textContent = [
      session.host || '',
      time ? '提取于 ' + time : '',
      '共扫描到 ' + state.items.length + ' 张图片'
    ].filter(Boolean).join(' · ');

    if (session.pageUrl) {
      els.sourceLink.href = session.pageUrl;
      els.sourceHost.textContent = '返回商品页';
      els.sourceLink.hidden = false;
    }

    els.stats.hidden = false;
    els.toolbar.hidden = false;
    els.emptyState.hidden = true;
  }

  function renderGrid() {
    var fragment = document.createDocumentFragment();

    state.items.forEach(function (item, index) {
      var card = document.createElement('article');
      card.className = 'card is-selected';
      card.dataset.index = String(item.index);
      card.style.animationDelay = Math.min(index * 18, 360) + 'ms';

      var figure = document.createElement('div');
      figure.className = 'card-figure';
      figure.title = '点击预览';
      figure.addEventListener('click', function (event) {
        if (event.target.closest('.card-check')) return;
        openPreview(item.index);
      });

      var checkWrap = document.createElement('label');
      checkWrap.className = 'card-check';
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.setAttribute('aria-label', '选择第 ' + (index + 1) + ' 张图片');
      checkbox.addEventListener('change', function () {
        toggleItem(item.index, checkbox.checked);
      });
      checkWrap.appendChild(checkbox);

      var sizeBadge = document.createElement('span');
      sizeBadge.className = 'card-size';
      sizeBadge.textContent = '加载中…';

      var indexBadge = document.createElement('span');
      indexBadge.className = 'card-index';
      indexBadge.textContent = '#' + String(item.index + 1).padStart(3, '0');

      var image = document.createElement('img');
      image.alt = '商品图片 ' + (index + 1);
      // 首屏图片优先加载，其余懒加载，兼顾速度与滚动体验
      image.loading = index < 30 ? 'eager' : 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('load', function () {
        var width = image.naturalWidth || 0;
        var height = image.naturalHeight || 0;
        item.width = width;
        item.height = height;
        sizeBadge.textContent = width + ' × ' + height;
        var tooSmall = width > 0 && height > 0 && width < MIN_SIZE && height < MIN_SIZE;
        var tooThin = (width >= 600 && height > 0 && height <= 80) ||
          (height >= 600 && width > 0 && width <= 80);
        if (tooSmall || tooThin) {
          markFiltered(item, card);
        }
      });
      image.addEventListener('error', function () {
        sizeBadge.textContent = '加载失败';
        card.classList.add('is-error');
      });
      image.src = item.url;

      figure.appendChild(checkWrap);
      figure.appendChild(sizeBadge);
      figure.appendChild(indexBadge);
      figure.appendChild(image);

      var footer = document.createElement('div');
      footer.className = 'card-footer';

      var meta = document.createElement('div');
      meta.className = 'card-meta';
      var name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = item.filename;
      var source = document.createElement('span');
      source.className = 'card-source';
      source.textContent = (SOURCE_LABELS[item.source] || '页面图片') + ' · ' + getHost(item.url);
      meta.appendChild(name);
      meta.appendChild(source);

      var downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'icon-btn';
      downloadBtn.title = '下载这张 PNG';
      downloadBtn.setAttribute('aria-label', '下载第 ' + (index + 1) + ' 张图片');
      downloadBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
      downloadBtn.addEventListener('click', function () {
        downloadSingle(item);
      });

      footer.appendChild(meta);
      footer.appendChild(downloadBtn);

      card.appendChild(figure);
      card.appendChild(footer);
      fragment.appendChild(card);
    });

    els.grid.textContent = '';
    els.grid.appendChild(fragment);
  }

  function markFiltered(item, card) {
    if (item.filtered) return;
    item.filtered = true;
    state.filtered += 1;
    state.selected.delete(item.index);
    if (card && card.parentNode) card.remove();
    updateCounts();
  }

  /* ---------- 选择 ---------- */
  function toggleItem(index, checked) {
    if (checked) state.selected.add(index);
    else state.selected.delete(index);
    var card = els.grid.querySelector('.card[data-index="' + index + '"]');
    if (card) card.classList.toggle('is-selected', checked);
    updateCounts();
  }

  function visibleItems() {
    return state.items.filter(function (item) { return !item.filtered; });
  }

  function selectedItems() {
    return state.items.filter(function (item) {
      return !item.filtered && state.selected.has(item.index);
    });
  }

  function updateCounts() {
    var visible = visibleItems();
    var chosen = selectedItems();
    els.totalCount.textContent = String(state.items.length);
    els.selectedCount.textContent = String(chosen.length);
    els.filteredCount.textContent = String(state.filtered);
    els.selectionText.textContent = '已选 ' + chosen.length + ' / ' + visible.length;
    var disabled = state.busy || chosen.length === 0;
    els.downloadPng.disabled = disabled;
    els.downloadZip.disabled = disabled || typeof JSZip === 'undefined';
  }

  function setBusy(busy) {
    state.busy = busy;
    els.selectAll.disabled = busy;
    els.invert.disabled = busy;
    updateCounts();
  }

  function bindEvents() {
    els.selectAll.addEventListener('click', function () {
      visibleItems().forEach(function (item) {
        state.selected.add(item.index);
        var card = els.grid.querySelector('.card[data-index="' + item.index + '"]');
        if (card) {
          card.classList.add('is-selected');
          var input = card.querySelector('.card-check input');
          if (input) input.checked = true;
        }
      });
      updateCounts();
    });

    els.invert.addEventListener('click', function () {
      visibleItems().forEach(function (item) {
        var card = els.grid.querySelector('.card[data-index="' + item.index + '"]');
        var input = card ? card.querySelector('.card-check input') : null;
        if (state.selected.has(item.index)) {
          state.selected.delete(item.index);
          if (card) card.classList.remove('is-selected');
          if (input) input.checked = false;
        } else {
          state.selected.add(item.index);
          if (card) card.classList.add('is-selected');
          if (input) input.checked = true;
        }
      });
      updateCounts();
    });

    els.downloadPng.addEventListener('click', function () { downloadSelected(false); });
    els.downloadZip.addEventListener('click', function () { downloadSelected(true); });

    els.previewClose.addEventListener('click', closePreview);
    els.preview.addEventListener('click', function (event) {
      if (event.target.dataset.close === '1') closePreview();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !els.preview.hidden) closePreview();
    });
    els.previewDownload.addEventListener('click', function () {
      var item = state.items[state.previewIndex];
      if (item) {
        closePreview();
        downloadSingle(item);
      }
    });
  }

  /* ---------- 预览 ---------- */
  function openPreview(index) {
    var item = state.items[index];
    if (!item) return;
    state.previewIndex = index;
    els.previewImage.src = item.url;
    els.previewImage.referrerPolicy = 'no-referrer';
    els.previewName.textContent = item.filename;
    els.previewSize.textContent = item.width && item.height
      ? item.width + ' × ' + item.height + ' px'
      : '尺寸未知';
    els.previewOriginal.href = item.url;
    els.preview.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closePreview() {
    els.preview.hidden = true;
    els.previewImage.removeAttribute('src');
    document.body.style.overflow = '';
    state.previewIndex = -1;
  }

  /* ---------- 下载 ---------- */
  async function downloadSingle(item) {
    if (state.busy) return;
    setBusy(true);
    showProgress('正在转换 PNG…', 12);
    try {
      var png = await urlToPng(item.url);
      updateProgress('正在保存到下载目录…', 72);
      await downloadBlob(png, item.filename);
      hideProgress();
      toast('已下载 ' + item.filename, 'success');
    } catch (error) {
      hideProgress();
      toast('下载失败：' + error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function downloadSelected(asZip) {
    if (state.busy) return;
    var list = selectedItems();
    if (!list.length) {
      toast('请先勾选要下载的图片', 'error');
      return;
    }

    setBusy(true);
    var failures = [];
    showProgress('准备下载 ' + list.length + ' 张图片…', 2);

    try {
      if (asZip) {
        await downloadZip(list, failures);
      } else {
        await downloadPngs(list, failures);
      }
    } catch (error) {
      hideProgress();
      toast('下载失败：' + error.message, 'error');
      setBusy(false);
      return;
    }

    hideProgress();
    var success = list.length - failures.length;
    if (success > 0) {
      toast(
        '下载完成：成功 ' + success + ' 张' + (failures.length ? '，失败 ' + failures.length + ' 张' : ''),
        failures.length ? 'error' : 'success'
      );
    } else {
      toast('下载失败：图片可能受站点防盗链限制', 'error');
    }
    setBusy(false);
  }

  async function downloadPngs(list, failures) {
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      updateProgress(
        '正在处理第 ' + (i + 1) + ' / ' + list.length + ' 张：' + item.filename,
        Math.round((i / list.length) * 100)
      );
      try {
        var png = await urlToPng(item.url);
        await downloadBlob(png, item.filename);
      } catch (error) {
        failures.push(item);
      }
      updateProgress(
        '已完成 ' + (i + 1) + ' / ' + list.length + ' 张',
        Math.round(((i + 1) / list.length) * 100)
      );
      await sleep(120);
    }
  }

  async function downloadZip(list, failures) {
    var zip = new JSZip();
    var added = 0;

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      updateProgress(
        '正在转换第 ' + (i + 1) + ' / ' + list.length + ' 张…',
        Math.round((i / list.length) * 80)
      );
      try {
        var png = await urlToPng(item.url);
        zip.file(item.filename, png, { compression: 'STORE' });
        added++;
      } catch (error) {
        failures.push(item);
      }
      await sleep(30);
    }

    if (added === 0) throw new Error('没有成功转换的图片');

    updateProgress('正在生成 ZIP 压缩包…', 84);
    var blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, function (meta) {
      updateProgress('正在生成 ZIP 压缩包…', 84 + Math.round(meta.percent * 0.12));
    });

    updateProgress('正在保存 ZIP…', 98);
    await downloadBlob(blob, '商品图_打包_' + formatDate(new Date()) + '.zip');
  }

  /* ---------- 图片转 PNG ---------- */
  async function urlToPng(url) {
    var sourceBlob = await fetchImageBlob(url);
    var bitmap;
    try {
      bitmap = await createImageBitmap(sourceBlob);
    } catch (error) {
      throw new Error('图片解码失败');
    }

    var width = bitmap.width;
    var height = bitmap.height;
    if (!width || !height) {
      bitmap.close && bitmap.close();
      throw new Error('图片尺寸无效');
    }

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close && bitmap.close();

    return await new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('PNG 编码失败'));
      }, 'image/png');
    });
  }

  async function fetchImageBlob(url) {
    var attempts = [
      { cache: 'no-store', credentials: 'omit' },
      { cache: 'no-store', credentials: 'include' }
    ];
    var lastError = null;

    for (var i = 0; i < attempts.length; i++) {
      try {
        var response = await fetch(url, attempts[i]);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var blob = await response.blob();
        if (blob.size === 0) throw new Error('空文件');
        return blob;
      } catch (error) {
        lastError = error;
      }
    }

    // 某些 CDN 不允许扩展页 fetch 时，退回 <img> + canvas 方式
    try {
      return await loadViaImage(url);
    } catch (error) {
      throw new Error(lastError ? lastError.message : error.message);
    }
  }

  function loadViaImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.crossOrigin = 'anonymous';
      image.referrerPolicy = 'no-referrer';
      image.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext('2d').drawImage(image, 0, 0);
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('PNG 编码失败'));
          }, 'image/png');
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = function () {
        reject(new Error('图片加载失败'));
      };
      image.src = url;
    });
  }

  /* ---------- chrome.downloads 封装 ---------- */
  function chromeDownload(url, filename) {
    return new Promise(function (resolve, reject) {
      chrome.downloads.download(
        { url: url, filename: filename, saveAs: false, conflictAction: 'uniquify' },
        function (downloadId) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!downloadId) {
            reject(new Error('下载未启动'));
            return;
          }
          resolve(downloadId);
        }
      );
    });
  }

  function waitForDownload(downloadId) {
    return new Promise(function (resolve) {
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        chrome.downloads.onChanged.removeListener(listener);
        resolve();
      }
      function listener(delta) {
        if (delta.id !== downloadId || !delta.state) return;
        var current = delta.state.current;
        if (current === 'complete' || current === 'interrupted') finish();
      }
      chrome.downloads.onChanged.addListener(listener);
      setTimeout(async function () {
        if (settled) return;
        try {
          var found = await chrome.downloads.search({ id: downloadId });
          var record = found && found[0];
          if (record && record.state !== 'in_progress') finish();
        } catch (error) {
          // 查询失败时继续等待 onChanged
        }
      }, 600);
      setTimeout(finish, 90000);
    });
  }

  async function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    try {
      var downloadId = await chromeDownload(url, filename);
      await waitForDownload(downloadId);
    } finally {
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    }
  }

  /* ---------- 进度 / 提示 ---------- */
  function showProgress(text, percent) {
    els.progress.hidden = false;
    updateProgress(text, percent);
  }

  function updateProgress(text, percent) {
    var value = Math.max(0, Math.min(100, Math.round(percent)));
    els.progressText.textContent = text;
    els.progressPercent.textContent = value + '%';
    els.progressBar.style.width = value + '%';
  }

  function hideProgress() {
    els.progress.hidden = true;
    els.progressBar.style.width = '0%';
  }

  function toast(message, type) {
    els.toast.textContent = message;
    els.toast.className = 'toast is-visible' + (type ? ' is-' + type : '');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      els.toast.className = 'toast';
    }, 3600);
  }

  /* ---------- 辅助 ---------- */
  function showEmpty() {
    els.grid.textContent = '';
    els.stats.hidden = true;
    els.toolbar.hidden = true;
    els.emptyState.hidden = false;
    els.pageTitle.textContent = '还没有提取记录';
    els.pageMeta.textContent = '在商品详情页点击右下角的「获取图片」，图片就会出现在这里。';
    els.sourceLink.hidden = true;
  }

  function getHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (error) {
      return '';
    }
  }

  function formatDate(date) {
    return date.getFullYear() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0') + '_' +
      String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0');
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }
})();
