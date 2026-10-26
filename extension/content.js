/**
 * 图提取 ImageGrab - 内容脚本
 * 职责：判断商品详情页、注入右下角悬浮按钮、扫描页面图片并交给后台打开画廊。
 */
(function () {
  'use strict';

  if (window.__imageGrabLoaded) return;
  window.__imageGrabLoaded = true;

  var MAX_IMAGES = 300;
  var MIN_SIZE = 100; // 小于 100x100 的图片视为图标/占位图

  /* ---------- 1. 商品详情页判断 ---------- */
  function isProductPage() {
    var host = location.hostname;
    var path = location.pathname;
    var search = location.search;

    if (/(^|\.)taobao\.com$/i.test(host) || /(^|\.)tmall\.com$/i.test(host)) {
      return /item\.htm/i.test(path + search);
    }
    if (/(^|\.)jd\.com$/i.test(host)) {
      // item.jd.com/100012043978.html 或 item.m.jd.com/product/100012043978.html
      return /\/\d+\.html$/i.test(path) || /\/product\/\d+\.html$/i.test(path);
    }
    if (/(^|\.)pinduoduo\.com$/i.test(host) || /(^|\.)yangkeduo\.com$/i.test(host)) {
      return /goods_id=\d+/i.test(search) || /goods\.html/i.test(path);
    }
    return false;
  }

  if (!isProductPage()) return;

  /* ---------- 2. 图片收集与过滤 ---------- */
  var BAD_URL = /(logo|icon|sprite|avatar|qrcode|erweima|placeholder|spacer|1x1|transparent|favicon|share_|weixin|weibo)/i;
  // 已知的页面 UI 素材路径（促销标签、店铺 logo、页头页尾图标等）
  var UI_URL = /(\/umm\/|\/jxfe\/|\/jdphoto\/|\/popshop\/|\/img\/|\/logo|\/icon|\/sprite|\/banner|\/advert|\/ad\/|coupon|activity|promo)/i;
  var UI_ID_CLASS = /(logo|icon|badge|tag|label|avatar|qrcode|sprite|btn|tip|coupon|banner|advert|promo|share|collect|score|star)/i;
  // 猜你喜欢 / 相关推荐 / 排行榜等推荐模块里的图片不属于当前商品
  var RECOMMEND_CONTAINER = /(recommend|guess|similar|may-?like|youmaylike|related|hotlist|ranking|toplist|feed)/i;

  function normalizeUrl(raw) {
    if (!raw) return null;
    var value = String(raw).trim().replace(/^['"]|['"]$/g, '');
    if (!value) return null;
    if (/^(data|blob|javascript|about):/i.test(value)) return null;
    if (value.indexOf('//') === 0) value = location.protocol + value;
    try {
      value = new URL(value, document.baseURI).href;
    } catch (e) {
      return null;
    }
    if (!/^https?:/i.test(value)) return null;
    value = value.split('#')[0];
    if (BAD_URL.test(value)) return null;
    if (UI_URL.test(value)) return null;
    if (/\.(svg|gif)(\?|$)/i.test(value)) return null;
    // 明显的小尺寸缩略图：_60x60.jpg、/50x50/ 之类
    var sizeMatch = value.match(/(?:^|[\/_])(\d{1,2})x(\d{1,2})(?:[\/_.]|$)/);
    if (sizeMatch && Number(sizeMatch[1]) < MIN_SIZE && Number(sizeMatch[2]) < MIN_SIZE) return null;
    return value;
  }

  // 从 URL 里推断原图尺寸，例如 s1350x1350_jfs、_750x750.jpg
  function sizeHintFromUrl(url) {
    var match = url.match(/s(\d{2,4})x(\d{2,4})_/i) || url.match(/_(\d{2,4})x(\d{2,4})(?=[._!-])/i);
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
  }

  // 同一张图的不同尺寸地址归一化为同一个 key，避免重复展示
  function dedupeKey(url) {
    var key = url.replace(/\/s\d+x\d+_/i, '/');
    key = key.replace(/!q\d+(?:\.[a-z0-9]+)*$/i, '');
    key = key.replace(/_\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|avif))/i, '');
    return key;
  }

  function pickLargestFromSrcset(srcset) {
    if (!srcset) return null;
    var best = null;
    var bestWeight = -1;
    srcset.split(',').forEach(function (part) {
      var tokens = part.trim().split(/\s+/);
      if (!tokens[0]) return;
      var weight = parseFloat((tokens[1] || '').replace(/[^\d.]/g, ''));
      if (isNaN(weight)) weight = 1;
      if (weight > bestWeight) {
        bestWeight = weight;
        best = tokens[0];
      }
    });
    return best;
  }

  function extractBackgroundUrl(styleValue) {
    if (!styleValue || styleValue === 'none') return null;
    var match = styleValue.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i);
    return match ? match[1] : null;
  }

  function insideRecommendModule(el) {
    var node = el;
    for (var i = 0; i < 9 && node; i++, node = node.parentElement) {
      var idcls = (node.id || '') + ' ' +
        (typeof node.className === 'string' ? node.className : '');
      if (RECOMMEND_CONTAINER.test(idcls)) return true;
    }
    return false;
  }

  function addCandidate(store, raw, source, width, height, imgEl) {
    var url = normalizeUrl(raw);
    if (!url) return;

    // 图片自身的 id/class 明显是图标、标签、logo 时直接跳过
    if (imgEl) {
      var idcls = (imgEl.id || '') + ' ' +
        (typeof imgEl.className === 'string' ? imgEl.className : '');
      if (UI_ID_CLASS.test(idcls)) return;
      if (insideRecommendModule(imgEl)) return;
    }

    var hint = (width && height) ? { width: width, height: height } : sizeHintFromUrl(url);
    if (hint && hint.width && hint.height) {
      width = hint.width;
      height = hint.height;
      if (width < MIN_SIZE && height < MIN_SIZE) return;
      // 页面里的细长装饰条 / 竖向分隔条
      if (width >= 600 && height <= 80) return;
      if (height >= 600 && width <= 80) return;
    } else {
      width = width || 0;
      height = height || 0;
    }

    var key = dedupeKey(url);
    var existing = store.get(key);
    if (!existing) {
      store.set(key, { url: url, source: source, width: width, height: height });
      return;
    }

    // 同一张图优先保留分辨率更高的地址
    if (width && height && width * height > (existing.width || 0) * (existing.height || 0)) {
      existing.url = url;
      existing.source = source;
      existing.width = width;
      existing.height = height;
    } else if (!existing.width && width) {
      existing.width = width;
      existing.height = height;
    }
  }

  function collectImages() {
    var store = new Map();

    // 2.1 普通图片与常见懒加载属性
    var imgAttrs = [
      'src', 'currentSrc', 'data-src', 'data-lazy-src', 'data-original',
      'data-ks-lazyload', 'data-lazyload', 'data-lazy-img', 'data-img', 'data-image',
      'data-url', 'back_src', 'data-back-src', 'data-lazy-background', 'data-bg', 'data-background'
    ];
    document.querySelectorAll('img').forEach(function (img) {
      var naturalW = img.naturalWidth || 0;
      var naturalH = img.naturalHeight || 0;
      var attrW = parseInt(img.getAttribute('width'), 10) || 0;
      var attrH = parseInt(img.getAttribute('height'), 10) || 0;
      var hintW = Math.max(naturalW, attrW);
      var hintH = Math.max(naturalH, attrH);
      imgAttrs.forEach(function (attr) {
        var isLoadedAttr = attr === 'src' || attr === 'currentSrc';
        var value = attr === 'currentSrc' ? img.currentSrc : img.getAttribute(attr);
        // 懒加载原图属性不继承缩略图的 20x20 尺寸，否则会误过滤掉真图
        addCandidate(store, value, 'img', isLoadedAttr ? hintW : 0, isLoadedAttr ? hintH : 0, img);
      });
      addCandidate(store, pickLargestFromSrcset(img.getAttribute('srcset')), 'srcset', hintW, hintH, img);
      addCandidate(store, pickLargestFromSrcset(img.getAttribute('data-srcset')), 'srcset', 0, 0, img);
      // 部分平台把原图地址放在 picture > source
      var picture = img.closest('picture');
      if (picture) {
        picture.querySelectorAll('source').forEach(function (source) {
          addCandidate(store, pickLargestFromSrcset(source.getAttribute('srcset')), 'srcset', 0, 0, null);
        });
      }
    });

    // 2.2 背景图（商品主图、详情长图常用）
    var bgSelector = [
      '[style*="background"]',
      '[class*="pic"]', '[class*="img"]', '[class*="image"]', '[class*="thumb"]',
      '[class*="photo"]', '[class*="banner"]', '[class*="gallery"]', '[class*="sku"]',
      '[class*="main"]', '[class*="detail"]'
    ].join(',');
    var bgNodes = document.querySelectorAll(bgSelector);
    var bgLimit = Math.min(bgNodes.length, 4000);
    for (var i = 0; i < bgLimit; i++) {
      var el = bgNodes[i];
      var rect = el.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 80) continue;
      if (rect.width * rect.height < 10000) continue;
      if (insideRecommendModule(el)) continue;
      var bg = getComputedStyle(el).backgroundImage;
      addCandidate(store, extractBackgroundUrl(bg), 'background', Math.round(rect.width), Math.round(rect.height), null);
    }

    // 2.3 页面分享图兜底
    document.querySelectorAll('meta[property="og:image"], meta[name="og:image"]').forEach(function (meta) {
      addCandidate(store, meta.getAttribute('content'), 'meta', 0, 0, null);
    });

    var images = Array.from(store.values()).slice(0, MAX_IMAGES);
    // 按页面出现顺序排序，保证文件名序号稳定
    return images;
  }

  /* ---------- 3. 悬浮按钮与轻提示 ---------- */
  var root = document.createElement('div');
  root.id = 'imagegrab-root';
  root.innerHTML =
    '<button id="imagegrab-fab" type="button" aria-label="提取当前页面所有商品图片">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="18" height="18" rx="3"></rect>' +
        '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
        '<path d="m21 15-5-5L5 21"></path>' +
      '</svg>' +
      '<span class="imagegrab-fab-text">获取图片</span>' +
      '<span class="imagegrab-fab-spinner" aria-hidden="true"></span>' +
    '</button>' +
    '<div id="imagegrab-toast" role="status" aria-live="polite"></div>';
  document.body.appendChild(root);

  var fab = root.querySelector('#imagegrab-fab');
  var fabText = root.querySelector('.imagegrab-fab-text');
  var toastEl = root.querySelector('#imagegrab-toast');
  var toastTimer = null;

  function toast(message, type) {
    toastEl.textContent = message;
    toastEl.className = 'imagegrab-toast-visible' + (type ? ' imagegrab-toast-' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.className = '';
    }, 3200);
  }

  function setLoading(loading) {
    if (loading) {
      fab.classList.add('imagegrab-loading');
      fab.disabled = true;
      fabText.textContent = '提取中…';
    } else {
      fab.classList.remove('imagegrab-loading');
      fab.disabled = false;
      fabText.textContent = '获取图片';
    }
  }

  /* ---------- 4. 点击提取 ---------- */
  function handleGrab() {
    setLoading(true);
    toast('正在扫描页面图片…');

    // 让按钮的加载状态先渲染出来，再执行相对耗时的扫描
    setTimeout(function () {
      var images;
      try {
        images = collectImages();
      } catch (error) {
        setLoading(false);
        toast('扫描失败：' + error.message, 'error');
        return;
      }

      if (!images.length) {
        setLoading(false);
        toast('没有找到可下载的商品图片，试试向下滚动加载后再提取', 'error');
        return;
      }

      chrome.runtime.sendMessage({
        type: 'IMAGE_GRAB_SESSION',
        payload: {
          images: images,
          pageUrl: location.href,
          pageTitle: document.title,
          host: location.hostname
        }
      }, function (response) {
        setLoading(false);
        if (chrome.runtime.lastError) {
          toast('扩展通信失败，请刷新页面后重试', 'error');
          return;
        }
        if (!response || !response.ok) {
          toast('打开画廊失败，请重试', 'error');
          return;
        }
        toast('已提取 ' + images.length + ' 张图片，正在打开画廊…', 'success');
      });
    }, 60);
  }

  fab.addEventListener('click', handleGrab);

  // 部分平台（拼多多）会动态清理页面节点，按钮被移除时自动补回
  var keepAlive = setInterval(function () {
    if (!document.body.contains(root)) {
      document.body.appendChild(root);
    }
  }, 2000);
  window.addEventListener('pagehide', function () {
    clearInterval(keepAlive);
  });
})();
