/**
 * 图提取 ImageGrab - Service Worker
 * 职责：接收内容脚本提取到的图片列表，写入 storage，并打开画廊页面。
 */

const GALLERY_PAGE = 'gallery.html';

async function openGallery() {
  await chrome.tabs.create({ url: chrome.runtime.getURL(GALLERY_PAGE) });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'IMAGE_GRAB_SESSION') return false;

  const payload = message.payload || {};
  const images = Array.isArray(payload.images) ? payload.images : [];

  const session = {
    id: Date.now(),
    images,
    pageUrl: payload.pageUrl || '',
    pageTitle: payload.pageTitle || '未命名页面',
    host: payload.host || '',
    sourceTabId: sender.tab ? sender.tab.id : null,
    createdAt: new Date().toISOString()
  };

  chrome.storage.local
    .set({ lastSession: session })
    .then(() => openGallery())
    .then(() => sendResponse({ ok: true, count: images.length }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true; // 异步 sendResponse
});

// 点击工具栏图标：打开最近一次提取结果（没有结果时画廊会显示使用说明）
chrome.action.onClicked.addListener(() => {
  openGallery();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ lastSession: null });
  }
});
