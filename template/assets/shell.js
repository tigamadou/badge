/* Badge — admin shell renderer (Staff / Org / Event).
   Each admin screen sets window.BADGE = {...} then includes its content in <div id="page">.
   This builds the navy sidebar + white header + optional banner around it. */
(function () {
  var NAV = {
    staff: [
      { route: "dashboard", label: "Tableau de bord", icon: "layout-dashboard", href: "staff-dashboard.html" },
      { route: "orgs", label: "Organisations", icon: "building-2", href: "staff-orgs.html" },
      { route: "users", label: "Utilisateurs", icon: "users", href: "staff-users.html" },
      { route: "settings", label: "Paramètres", icon: "settings", href: "staff-settings.html" },
      { route: "log", label: "Journal", icon: "scroll-text", href: "staff-log.html" },
    ],
    org: [
      { route: "dashboard", label: "Tableau de bord", icon: "layout-dashboard", href: "org-dashboard.html" },
      { route: "events", label: "Événements", icon: "calendar", href: "org-events.html" },
      { route: "members", label: "Membres", icon: "users", href: "org-members.html" },
      { route: "templates", label: "Modèles catégories", icon: "tags", href: "org-category-templates.html" },
      { route: "settings", label: "Paramètres", icon: "settings", href: "org-settings.html" },
      { route: "log", label: "Journal", icon: "scroll-text", href: "org-log.html" },
    ],
    event: [
      { route: "dashboard", label: "Tableau de bord", icon: "layout-dashboard", href: "event-dashboard.html" },
      { route: "inscriptions", label: "Inscriptions", icon: "user-check", href: "event-inscriptions.html" },
      { route: "badges", label: "Badges", icon: "id-card", href: "event-badges.html" },
      { route: "categories", label: "Catégories", icon: "tags", href: "event-categories.html" },
      { route: "scan", label: "Scan", icon: "scan-line", href: "event-scanner.html" },
      { route: "members", label: "Membres", icon: "users", href: "event-members.html" },
      { group: "Administration" },
      { route: "settings", label: "Paramètres", icon: "settings", href: "event-settings.html" },
      { route: "log", label: "Journal", icon: "scroll-text", href: "event-log.html" },
    ],
  };

  function initials(name) {
    return (name || "?").split(" ").map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase();
  }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  function buildSidebar(cfg) {
    var items = NAV[cfg.shell] || [];
    var ident = "";
    if (cfg.shell === "org") {
      ident = '<div class="sidebar-ident"><div class="title">' + (cfg.org ? cfg.org.name : "") + "</div></div>";
    } else if (cfg.shell === "event") {
      ident = '<div class="sidebar-ident"><a class="back" href="org-dashboard.html"><span data-ico="arrow-left" data-size="13"></span> ' +
        (cfg.org ? cfg.org.name : "Organisation") + '</a><div class="title">' + (cfg.event ? cfg.event.name : "") + "</div></div>";
    }
    var nav = items.map(function (it) {
      if (it.group) return '<div class="nav-group-label">' + it.group + "</div>";
      var active = it.route === cfg.active ? " active" : "";
      return '<a class="nav-item' + active + '" href="' + it.href + '"' + (active ? ' aria-current="page"' : "") +
        '><span class="ico" data-ico="' + it.icon + '" data-size="18"></span>' + it.label + "</a>";
    }).join("");
    return el(
      '<aside class="sidebar">' +
        '<img class="sidebar-logo" src="../assets/logo-light.svg" alt="Badge" />' +
        ident +
        '<nav style="display:flex;flex-direction:column;gap:4px;">' + nav + "</nav>" +
        '<div style="margin-top:auto;padding:8px;"><a class="nav-item" href="../connexion.html"><span class="ico" data-ico="log-out" data-size="18"></span>Déconnexion</a></div>' +
      "</aside>");
  }

  function buildHeader(cfg) {
    var crumbs = cfg.crumbs;
    if (!crumbs) {
      var active = (NAV[cfg.shell] || []).find(function (i) { return i.route === cfg.active; });
      var lbl = active ? active.label : "";
      if (cfg.shell === "staff") crumbs = ["Staff", lbl];
      else if (cfg.shell === "org") crumbs = [cfg.org ? cfg.org.name : "Organisation", lbl];
      else crumbs = [cfg.org ? cfg.org.name : "Org", cfg.event ? cfg.event.name : "Événement", lbl];
    }
    var crumbHtml = crumbs.map(function (c, i) {
      return (i > 0 ? '<span class="sep">/</span>' : "") + '<span class="c' + (i === crumbs.length - 1 ? " last" : "") + '">' + c + "</span>";
    }).join("");

    var right = "";
    var u = cfg.user || { name: "Marie Dubois" };
    var roleBadge = u.role ? '<span class="role-badge ' + (cfg.shell === "staff" ? "navy" : "") + '">' + u.role + "</span>" : "";
    if (cfg.shell === "staff") {
      right = roleBadge +
        '<div class="user-chip"><span class="nm">' + u.name + '</span><span class="avatar">' + initials(u.name) + "</span></div>";
    } else if (cfg.shell === "org") {
      right = '<button class="org-select"><span data-ico="building-2" data-size="15"></span>' + (cfg.org ? cfg.org.name : "") +
        '<span data-ico="chevrons-up-down" data-size="14"></span></button>' +
        '<div class="user-chip"><span class="avatar">' + initials(u.name) + "</span></div>";
    } else {
      right = (u.role ? '<span class="role-badge">' + u.role + "</span>" : "") +
        '<div class="user-chip"><span class="nm">' + u.name + '</span><span class="avatar">' + initials(u.name) + "</span></div>";
    }
    return el(
      '<header class="header">' +
        '<button class="menu-btn" aria-label="Menu"><span data-ico="menu" data-size="20"></span></button>' +
        '<nav class="crumbs">' + crumbHtml + "</nav>" +
        '<div style="display:flex;align-items:center;gap:12px;">' + right + "</div>" +
      "</header>");
  }

  function buildBanner(cfg) {
    if (cfg.banner === "staff") {
      return el('<div class="staff-banner"><span data-ico="shield" data-size="16"></span>' +
        'Mode staff — vous agissez au nom de ' + (cfg.org ? cfg.org.name : "cette organisation") + "." +
        '<button class="btn-ghost-sm x" style="background:transparent;color:var(--amber-700);border-color:var(--amber-200);">Quitter le mode staff</button></div>');
    }
    if (cfg.banner === "readonly") {
      return el('<div class="readonly-banner"><span data-ico="eye" data-size="16"></span>' +
        'Lecture seule — votre rôle (AUDITOR) ne permet pas de modifier ces données.</div>');
    }
    return null;
  }

  function render() {
    var cfg = window.BADGE || { shell: "staff", active: "dashboard" };
    var page = document.getElementById("page");
    var app = el('<div class="app"></div>');
    app.appendChild(buildSidebar(cfg));
    var wrap = el('<div class="main-wrap"></div>');
    wrap.appendChild(buildHeader(cfg));
    var banner = buildBanner(cfg);
    if (banner) wrap.appendChild(banner);
    var main = el('<main class="main"></main>');
    if (page) { while (page.firstChild) main.appendChild(page.firstChild); page.remove(); }
    wrap.appendChild(main);
    app.appendChild(wrap);
    document.body.insertBefore(app, document.body.firstChild);
    if (window.badgeHydrateIcons) window.badgeHydrateIcons(app);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
