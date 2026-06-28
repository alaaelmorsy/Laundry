(function () {
  'use strict';

  var SIDEBAR_ITEMS = [
    {
      group: 'gsb-section-main',
      groupLabel: { ar: 'الرئيسي', en: 'Main' },
      items: [
        {
          screen: 'dashboard',
          labelKey: 'gsb-nav-dashboard',
          label: { ar: 'الرئيسية', en: 'Dashboard' },
          permission: null,
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
        },
        {
          screen: 'pos',
          labelKey: 'gsb-nav-pos',
          label: { ar: 'نقطة البيع', en: 'POS' },
          permission: 'pos',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M6 8h.01M10 8h4M6 12h12"/></svg>'
        },
        {
          screen: 'invoices',
          labelKey: 'gsb-nav-invoices',
          label: { ar: 'الفواتير', en: 'Invoices' },
          permission: 'invoices',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
        },
        {
          screen: 'customers',
          labelKey: 'gsb-nav-customers',
          label: { ar: 'العملاء', en: 'Customers' },
          permission: 'customers',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
        },
        {
          screen: 'customer-custom-prices',
          labelKey: 'gsb-nav-customer-custom-prices',
          label: { ar: 'الأسعار المخصصة', en: 'Custom Prices' },
          permission: 'customer_custom_prices',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
        },
        {
          screen: 'hotels-companies',
          labelKey: 'gsb-nav-hotels-companies',
          label: { ar: 'الفنادق والشركات', en: 'Hotels & Companies' },
          permission: 'hotels_companies',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
        },
        {
          screen: 'reports',
          labelKey: 'gsb-nav-reports',
          label: { ar: 'التقارير', en: 'Reports' },
          permission: 'reports',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><path d="M3 20h18"/></svg>'
        }
      ]
    },
    {
      group: 'gsb-section-admin',
      groupLabel: { ar: 'الإدارة', en: 'Management' },
      items: [
        {
          screen: 'subscriptions',
          labelKey: 'gsb-nav-subscriptions',
          label: { ar: 'الاشتراكات', en: 'Subscriptions' },
          permission: 'subscriptions',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M9 12l2 2 4-4"/></svg>'
        },
        {
          screen: 'consumption-receipts',
          labelKey: 'gsb-nav-consumption-receipts',
          label: { ar: 'إيصالات الاستهلاك', en: 'Consumption' },
          permission: 'consumption_receipts',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h4"/></svg>'
        },
        {
          screen: 'credit-invoices',
          labelKey: 'gsb-nav-credit-invoices',
          label: { ar: 'الفواتير الدائنة', en: 'Credit Inv.' },
          permission: 'credit_invoices',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg>'
        },
        {
          screen: 'hangers',
          labelKey: 'gsb-nav-hangers',
          label: { ar: 'سير الملابس', en: 'Hangers' },
          permission: 'hangers',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 18H3.62a1 1 0 0 1-.73-1.68l7.12-7.7A3 3 0 0 1 12 8a3 3 0 0 1 2 .75V6a2 2 0 1 0-4 0"/><path d="M12 2v4"/></svg>'
        },
        {
          screen: 'expenses',
          labelKey: 'gsb-nav-expenses',
          label: { ar: 'المصروفات', en: 'Expenses' },
          permission: 'expenses',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>'
        },
        {
          screen: 'offers',
          labelKey: 'gsb-nav-offers',
          label: { ar: 'العروض', en: 'Offers' },
          permission: 'offers',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
        },
        {
          screen: 'users',
          labelKey: 'gsb-nav-users',
          label: { ar: 'المستخدمون', en: 'Users' },
          permission: 'users',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
        },
        {
          screen: 'roles',
          labelKey: 'gsb-nav-roles',
          label: { ar: 'الصلاحيات', en: 'Roles' },
          permission: 'roles',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M9 12l2 2 4-5"/></svg>'
        },
        {
          screen: 'services',
          labelKey: 'gsb-nav-services',
          label: { ar: 'العمليات', en: 'Services' },
          permission: 'services',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>'
        },
        {
          screen: 'products',
          labelKey: 'gsb-nav-products',
          label: { ar: 'الخدمات', en: 'Products' },
          permission: 'products',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'
        },
        {
          screen: 'whatsapp',
          labelKey: 'gsb-nav-whatsapp',
          label: { ar: 'واتساب', en: 'WhatsApp' },
          permission: 'whatsapp',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
        },
        {
          screen: 'zatca-settings',
          labelKey: 'gsb-nav-zatca',
          label: { ar: 'ZATCA', en: 'ZATCA' },
          permission: 'zatca_settings',
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 19 6v6c0 5-3 9-7 10C8 21 5 17 5 12V6l7-4z"/><path d="M9 12l2 2 4-5"/></svg>'
        },
        {
          screen: 'settings',
          labelKey: 'gsb-nav-settings',
          label: { ar: 'الإعدادات', en: 'Settings' },
          permission: null,
          adminOnly: true,
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3"/></svg>'
        }
      ]
    }
  ];

  function getLang() {
    try {
      return (document.documentElement.lang || 'ar').substring(0, 2);
    } catch (e) {
      return 'ar';
    }
  }

  function getLabel(item) {
    var lang = getLang();
    if (window.I18N && window.I18N.t) {
      var translated = window.I18N.t(item.labelKey);
      if (translated && translated !== item.labelKey) return translated;
    }
    return item.label[lang] || item.label.ar;
  }

  function getGroupLabel(group) {
    var lang = getLang();
    if (window.I18N && window.I18N.t) {
      var translated = window.I18N.t(group.group);
      if (translated && translated !== group.group) return translated;
    }
    return group.groupLabel[lang] || group.groupLabel.ar;
  }

  function getSidebarTitle() {
    if (window.I18N && window.I18N.t) {
      var translated = window.I18N.t('gsb-menu');
      if (translated && translated !== 'gsb-menu') return translated;
    }
    return getLang() === 'en' ? 'Menu' : 'القائمة';
  }

  function getToggleTitle() {
    if (window.I18N && window.I18N.t) {
      var translated = window.I18N.t('gsb-toggle');
      if (translated && translated !== 'gsb-toggle') return translated;
    }
    return getLang() === 'en' ? 'Toggle sidebar' : 'طي القائمة';
  }

  function isActive(screen) {
    var path = location.pathname.replace(/\\/g, '/');
    return path.indexOf('/screens/' + screen + '/') !== -1 ||
      path.indexOf('/screens/' + screen + '.html') !== -1;
  }

  function loadCollapsed() {
    try {
      return localStorage.getItem('sidebar_collapsed') === '1';
    } catch (e) {
      return false;
    }
  }

  function saveCollapsed(val) {
    try {
      localStorage.setItem('sidebar_collapsed', val ? '1' : '0');
    } catch (e) {}
  }

  function escHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildHTML() {
    var itemsHTML = '';
    for (var g = 0; g < SIDEBAR_ITEMS.length; g++) {
      var group = SIDEBAR_ITEMS[g];
      itemsHTML += '<div class="gsb-sec">' + escHtml(getGroupLabel(group)) + '</div>';
      for (var i = 0; i < group.items.length; i++) {
        var item = group.items[i];
        var active = isActive(item.screen) ? ' active' : '';
        var label = getLabel(item);
        itemsHTML += '<button type="button" class="gsb-item' + active + '" data-screen="' + item.screen + '" data-tooltip="' + escHtml(label) + '">' +
          '<span class="gsb-ico">' + item.svg + '</span>' +
          '<span class="gsb-lbl">' + escHtml(label) + '</span>' +
          '</button>';
      }
    }

    var toggleSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>';

    return '<div class="gsb-hdr">' +
      '<span class="gsb-label">' + escHtml(getSidebarTitle()) + '</span>' +
      '<button type="button" class="gsb-toggle" id="gsbToggle" title="' + escHtml(getToggleTitle()) + '">' + toggleSvg + '</button>' +
      '</div>' +
      '<nav class="gsb-nav">' + itemsHTML + '</nav>';
  }

  function applyPermissions() {
    var sidebar = document.getElementById('globalSidebar');
    if (!sidebar) return;

    var user = window.__currentUser;
    var isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');
    var buttons = sidebar.querySelectorAll('.gsb-item[data-screen]');

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var screen = btn.getAttribute('data-screen');
      var itemDef = findItem(screen);
      if (!itemDef) continue;

      var show = true;
      if (itemDef.adminOnly && !isAdmin) {
        show = false;
      } else if (itemDef.permission && typeof window.hasPermission === 'function') {
        show = window.hasPermission(itemDef.permission);
      }

      btn.style.display = show ? '' : 'none';
    }
  }

  function findItem(screen) {
    for (var g = 0; g < SIDEBAR_ITEMS.length; g++) {
      var items = SIDEBAR_ITEMS[g].items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].screen === screen) return items[i];
      }
    }
    return null;
  }

  function setupNavigation(aside) {
    aside.addEventListener('click', function (e) {
      var btn = e.target.closest('.gsb-item[data-screen]');
      if (!btn) return;

      var screen = btn.getAttribute('data-screen');
      if (!screen) return;

      if (screen === 'dashboard') {
        location.href = '/screens/dashboard/dashboard.html';
      } else if (window.api && window.api.navigateTo) {
        window.api.navigateTo(screen);
      } else {
        location.href = '/screens/' + screen + '/' + screen + '.html';
      }
    });
  }

  function toggle(aside) {
    var isCollapsed = aside.classList.toggle('gsb-collapsed');
    saveCollapsed(isCollapsed);
  }

  function bindSidebarEvents(aside) {
    setupNavigation(aside);

    var toggleBtn = aside.querySelector('#gsbToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        toggle(aside);
      });
    }
  }

  function rerenderSidebar() {
    var aside = document.getElementById('globalSidebar');
    if (!aside) return;

    aside.innerHTML = buildHTML();
    bindSidebarEvents(aside);
    applyPermissions();
  }

  function init() {
    var path = location.pathname.replace(/\\/g, '/');
    var excluded = ['/screens/login/', '/screens/installing/', '/screens/invoice-a4/', '/screens/payment/', '/screens/settings/'];
    for (var i = 0; i < excluded.length; i++) {
      if (path.indexOf(excluded[i]) !== -1) return;
    }

    var aside = document.createElement('aside');
    aside.id = 'globalSidebar';
    if (loadCollapsed()) aside.classList.add('gsb-collapsed');
    aside.innerHTML = buildHTML();

    var layout = document.createElement('div');
    layout.className = 'gsb-layout';

    var content = document.createElement('div');
    content.className = 'gsb-content';
    while (document.body.firstChild) {
      content.appendChild(document.body.firstChild);
    }

    var dir = document.documentElement.getAttribute('dir') || 'rtl';
    if (dir === 'rtl') {
      layout.appendChild(aside);
      layout.appendChild(content);
    } else {
      layout.appendChild(content);
      layout.appendChild(aside);
    }

    document.body.appendChild(layout);

    var printRoots = document.querySelectorAll('[data-print-root]');
    for (var pr = 0; pr < printRoots.length; pr++) {
      document.body.appendChild(printRoots[pr]);
    }

    applyPermissions();

    window.addEventListener('userReady', function () {
      applyPermissions();
    });

    window.addEventListener('app-language-changed', function () {
      rerenderSidebar();
    });

    bindSidebarEvents(aside);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Sidebar = {
    toggle: toggle,
    applyPermissions: applyPermissions,
    rerender: rerenderSidebar
  };
})();
