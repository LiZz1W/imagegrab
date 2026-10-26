/* =========================================================
   图提取 ImageGrab 官网交互
   - 吸顶导航阴影
   - 移动端汉堡菜单
   - 滚动进入动画（IntersectionObserver）
   - 当前区块导航高亮
   - 回到顶部
   ========================================================= */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var navToggle = document.getElementById('navToggle');
  var mobileNav = document.getElementById('mobileNav');
  var backTop = document.getElementById('backTop');
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav a, .mobile-nav nav a')
  );

  var sectionIds = ['intro', 'features', 'install', 'download'];
  var sections = sectionIds
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  /* ---------- 吸顶导航 & 回到顶部 ---------- */
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var scrollY = window.scrollY || window.pageYOffset;
      header.classList.toggle('is-scrolled', scrollY > 8);
      if (backTop) backTop.hidden = scrollY < 520;
      updateActiveSection(scrollY);
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- 当前区块高亮 ---------- */
  function updateActiveSection(scrollY) {
    if (!sections.length) return;
    var probe = scrollY + (header.offsetHeight || 76) + 120;
    var currentId = '';

    sections.forEach(function (section) {
      if (section.offsetTop <= probe) currentId = section.id;
    });

    // 首屏时不高亮任何导航项
    if (scrollY < sections[0].offsetTop - 240) currentId = '';

    navLinks.forEach(function (link) {
      var isActive = link.getAttribute('href') === '#' + currentId;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  /* ---------- 移动端菜单 ---------- */
  function setMenu(open) {
    if (!mobileNav || !navToggle) return;
    mobileNav.hidden = !open;
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    document.body.classList.toggle('menu-open', open);
  }

  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
      setMenu(mobileNav.hidden);
    });

    document.addEventListener('click', function (event) {
      if (mobileNav.hidden) return;
      if (!mobileNav.contains(event.target) && !navToggle.contains(event.target)) {
        setMenu(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !mobileNav.hidden) {
        setMenu(false);
        navToggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 860 && !mobileNav.hidden) setMenu(false);
    });
  }

  // 点击移动端菜单里的锚点后自动收起
  if (mobileNav) {
    mobileNav.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });
  }

  /* ---------- 滚动进入动画 ---------- */
  var revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealItems.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(function (item) { revealObserver.observe(item); });
  } else {
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  }

  /* ---------- 回到顶部 ---------- */
  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- 初始化 ---------- */
  onScroll();
})();
