# 图提取 ImageGrab

一个真实可用的 Chrome 电商图片下载扩展：在淘宝、天猫、京东、拼多多商品详情页一键提取全部商品图片，集中预览、自由勾选，批量下载为 PNG 或打包 ZIP。

配套官网部署在 GitHub Pages。插件使用 Manifest V3，纯本地处理，不上传任何图片。

## 目录结构

```
imagegrab/
├── extension/                     # Chrome 扩展源码
│   ├── manifest.json
│   ├── content.js / content.css   # 注入「获取图片」按钮并扫描页面图片
│   ├── background.js              # Service Worker：接收图片列表、打开画廊
│   ├── gallery.html / .css / .js  # 画廊页：预览、勾选、PNG / ZIP 下载
│   ├── libs/jszip.min.js          # 本地 ZIP 库（无 CDN 依赖）
│   ├── icons/                     # 16 / 48 / 128 图标
│   └── README.md                  # 安装与使用说明
├── docs/                          # 静态官网（GitHub Pages 根目录）
│   ├── index.html
│   ├── css/style.css
│   ├── js/main.js
│   ├── assets/icon.svg
│   └── downloads/ImageGrab-1.0.0.zip
├── tools/
│   ├── make_icons.py              # 生成插件图标
│   └── build_zip.py               # 打包插件压缩包
└── README.md
```

## 功能

- 右下角悬浮「获取图片」按钮，仅在支持的平台商品详情页显示
- 扫描 `<img>`、`srcset`、`data-src`、`data-lazy-src` 等懒加载属性与 CSS 背景图
- 过滤 logo、图标、占位图和小于 100×100 的图片
- 新标签页网格预览，显示图片尺寸
- 全选 / 反选 / 按需勾选
- 单张下载或批量下载，统一转换为 PNG，文件名自动补零编号
- 一键打包 ZIP，实时进度与结果提示

## 本地加载插件

1. 运行 `python tools/build_zip.py` 生成压缩包，或直接使用 `extension/` 目录。
2. 打开 `chrome://extensions`，开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择 `extension/` 目录。
4. 打开电商商品详情页，点击右下角「获取图片」。

## 本地预览官网

直接双击 `docs/index.html`，或在项目根目录启动任意静态服务器：

```bash
python -m http.server 8000 --directory docs
```

然后访问 `http://localhost:8000/`。

## 部署到 GitHub Pages

1. 将本目录推送到 GitHub 仓库。
2. 进入仓库 `Settings → Pages`。
3. Source 选择 `Deploy from a branch`，分支选 `main`，目录选 `/docs`。
4. 保存后访问 `https://<用户名>.github.io/imagegrab/`。

## 技术栈

Manifest V3 · 原生 JavaScript · Canvas / createImageBitmap · chrome.downloads · JSZip · 纯静态 HTML/CSS

## 说明

图片仅在本地扫描和转换，不会上传服务器。请遵守各平台规则与图片版权，仅用于个人学习与素材整理。
