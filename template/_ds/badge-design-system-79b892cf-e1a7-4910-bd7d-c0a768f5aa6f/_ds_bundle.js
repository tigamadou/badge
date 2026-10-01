/* @ds-bundle: {"format":3,"namespace":"BadgeDesignSystem_79b892","components":[],"sourceHashes":{"ui_kits/badge-app/app.jsx":"0d53e6102890","ui_kits/badge-app/data.jsx":"31568495d5e3","ui_kits/badge-app/icons.jsx":"8de4b05a3358","ui_kits/badge-app/primitives.jsx":"0dac6c30ba7a","ui_kits/badge-app/screens_admin.jsx":"e1f7fcc48cda","ui_kits/badge-app/screens_event.jsx":"a38a3bc875d9","ui_kits/badge-app/shell.jsx":"d2a410bfa4b5"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BadgeDesignSystem_79b892 = window.BadgeDesignSystem_79b892 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/badge-app/app.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Badge UI Kit — root app: routing across the 3 shells */
const {
  useState: useAppState
} = React;
const NAV = {
  staff: [{
    route: "orgs",
    label: "Organisations",
    icon: "building-2"
  }, {
    route: "staff-users",
    label: "Utilisateurs staff",
    icon: "users"
  }, {
    route: "platform-settings",
    label: "Paramètres plateforme",
    icon: "settings"
  }, {
    route: "activity",
    label: "Journal d'activité",
    icon: "scroll-text"
  }],
  org: [{
    route: "dashboard",
    label: "Tableau de bord",
    icon: "layout-dashboard"
  }, {
    route: "events",
    label: "Événements",
    icon: "calendar"
  }, {
    route: "members",
    label: "Membres",
    icon: "users"
  }, {
    route: "settings",
    label: "Paramètres org",
    icon: "settings"
  }],
  event: [{
    route: "dashboard",
    label: "Tableau de bord",
    icon: "layout-dashboard"
  }, {
    route: "inscriptions",
    label: "Inscriptions",
    icon: "user-check"
  }, {
    route: "badges",
    label: "Badges",
    icon: "id-card"
  }, {
    route: "categories",
    label: "Catégories",
    icon: "tags"
  }, {
    route: "scanner",
    label: "Scanner",
    icon: "scan-line"
  }, {
    route: "members",
    label: "Membres",
    icon: "users"
  }, {
    group: "Admin"
  }, {
    route: "settings",
    label: "Paramètres",
    icon: "settings"
  }, {
    route: "log",
    label: "Journal",
    icon: "scroll-text"
  }]
};
const USER = {
  name: "Marie Dubois"
};
function App() {
  const [nav, setNav] = useAppState({
    shell: "staff",
    route: "orgs",
    orgId: "acme",
    eventId: "conf-2026"
  });
  const [regs, setRegs] = useAppState(REGISTRATIONS);
  const [toDelete, setToDelete] = useAppState(null);
  const [toast, setToast] = useAppState(null);
  const org = ORGS.find(o => o.id === nav.orgId);
  const event = EVENTS.find(e => e.id === nav.eventId);
  const eventOrg = event ? ORGS.find(o => o.id === event.org) : null;
  const go = next => {
    setNav(prev => ({
      shell: next.shell || prev.shell,
      route: next.route || (next.shell ? NAV[next.shell][0].route : prev.route),
      orgId: next.org || prev.orgId,
      eventId: next.event || prev.eventId
    }));
    setToast(null);
  };
  const onNav = next => go({
    ...next
  });
  const notify = (kind, msg) => {
    setToast({
      kind,
      msg
    });
  };
  const confirmDelete = r => setToDelete(r);
  const doDelete = () => {
    setRegs(rs => rs.filter(r => r.id !== toDelete.id));
    setToDelete(null);
    notify("ok", "Inscription supprimée.");
  };

  // crumbs
  const navList = NAV[nav.shell];
  const current = navList.find(i => i.route === nav.route);
  let crumbs = [];
  if (nav.shell === "staff") crumbs = ["Staff", current ? current.label : ""];
  if (nav.shell === "org") crumbs = [org.name, current ? current.label : ""];
  if (nav.shell === "event") crumbs = [eventOrg ? eventOrg.name : "", event.name, current ? current.label : ""];

  // screen
  const ctx = {
    go,
    notify
  };
  let screen = null;
  if (nav.shell === "staff") {
    if (nav.route === "orgs") screen = /*#__PURE__*/React.createElement(StaffOrgs, ctx);else if (nav.route === "staff-users") screen = /*#__PURE__*/React.createElement(StaffUsers, ctx);else if (nav.route === "platform-settings") screen = /*#__PURE__*/React.createElement(StaffSettings, null);else if (nav.route === "activity") screen = /*#__PURE__*/React.createElement(ActivityLog, null);
  } else if (nav.shell === "org") {
    if (nav.route === "dashboard") screen = /*#__PURE__*/React.createElement(OrgDashboard, _extends({
      org: org
    }, ctx));else if (nav.route === "events") screen = /*#__PURE__*/React.createElement(OrgEvents, ctx);else if (nav.route === "members") screen = /*#__PURE__*/React.createElement(SimpleList, {
      title: "Membres",
      rows: STAFF_USERS
    });else if (nav.route === "settings") screen = /*#__PURE__*/React.createElement(OrgSettings, null);
  } else if (nav.shell === "event") {
    if (nav.route === "dashboard") screen = /*#__PURE__*/React.createElement(EventDashboard, {
      event: event
    });else if (nav.route === "inscriptions") screen = /*#__PURE__*/React.createElement(EventInscriptions, {
      regs: regs,
      setRegs: setRegs,
      confirmDelete: confirmDelete,
      notify: notify
    });else if (nav.route === "badges") screen = /*#__PURE__*/React.createElement(EventBadges, {
      event: event,
      notify: notify
    });else if (nav.route === "categories") screen = /*#__PURE__*/React.createElement(EventCategories, {
      notify: notify
    });else if (nav.route === "scanner") screen = /*#__PURE__*/React.createElement(EventScanner, {
      notify: notify
    });else if (nav.route === "members") screen = /*#__PURE__*/React.createElement(SimpleList, {
      title: "Membres de l'\xE9v\xE9nement",
      rows: STAFF_USERS
    });else if (nav.route === "settings") screen = /*#__PURE__*/React.createElement(OrgSettings, null);else if (nav.route === "log") screen = /*#__PURE__*/React.createElement(ActivityLog, null);
  }
  const sidebar = /*#__PURE__*/React.createElement(Sidebar, {
    shell: nav.shell,
    route: nav.route,
    nav: navList,
    org: org,
    event: event,
    onNav: onNav,
    onLogo: () => go({
      shell: "staff",
      route: "orgs"
    })
  });
  const header = /*#__PURE__*/React.createElement(Header, {
    crumbs: crumbs,
    user: USER,
    onMenu: () => {}
  });
  return /*#__PURE__*/React.createElement(AppShell, {
    sidebar: sidebar,
    header: header
  }, toast && /*#__PURE__*/React.createElement(Alert, {
    kind: toast.kind
  }, toast.msg), screen, toDelete && /*#__PURE__*/React.createElement(Modal, {
    title: "Supprimer l'inscription ?",
    onClose: () => setToDelete(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => setToDelete(null)
    }, "Annuler"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: doDelete
    }, "Supprimer"))
  }, "Cette action est irr\xE9versible. L'inscription de ", /*#__PURE__*/React.createElement("b", null, toDelete.name), " et le badge associ\xE9 seront d\xE9finitivement supprim\xE9s."));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/badge-app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/badge-app/data.jsx
try { (() => {
/* Badge UI Kit — fake data */
const ORGS = [{
  id: "acme",
  name: "Acme Events",
  events: 6,
  members: 14,
  plan: "Pro"
}, {
  id: "techsummit",
  name: "Tech Summit Group",
  events: 3,
  members: 8,
  plan: "Business"
}, {
  id: "salons-pro",
  name: "Salons Pro France",
  events: 12,
  members: 22,
  plan: "Enterprise"
}, {
  id: "asso-culture",
  name: "Association Culture+",
  events: 2,
  members: 5,
  plan: "Gratuit"
}];
const EVENTS = [{
  id: "conf-2026",
  org: "acme",
  name: "Conférence annuelle 2026",
  date: "14–16 juin 2026",
  regs: 1248,
  status: "Ouvert"
}, {
  id: "expo-print",
  org: "acme",
  name: "Expo Print & Pack",
  date: "3 sept. 2026",
  regs: 542,
  status: "Brouillon"
}, {
  id: "gala",
  org: "acme",
  name: "Gala de remise des prix",
  date: "20 nov. 2026",
  regs: 210,
  status: "Ouvert"
}];
const REGISTRATIONS = [{
  id: 1,
  name: "Marie Dubois",
  email: "marie.dubois@example.fr",
  cat: "Visiteur",
  status: "APPROVED",
  date: "12 mai"
}, {
  id: 2,
  name: "Lucas Bernard",
  email: "l.bernard@example.fr",
  cat: "Exposant",
  status: "PENDING",
  date: "12 mai"
}, {
  id: 3,
  name: "Amélie Roux",
  email: "amelie.roux@example.fr",
  cat: "Presse",
  status: "APPROVED",
  date: "11 mai"
}, {
  id: 4,
  name: "Thomas Martin",
  email: "t.martin@example.fr",
  cat: "Visiteur",
  status: "PENDING",
  date: "11 mai"
}, {
  id: 5,
  name: "Sophie Lefebvre",
  email: "s.lefebvre@example.fr",
  cat: "VIP",
  status: "APPROVED",
  date: "10 mai"
}, {
  id: 6,
  name: "Hugo Moreau",
  email: "hugo.moreau@example.fr",
  cat: "Exposant",
  status: "REJECTED",
  date: "10 mai"
}, {
  id: 7,
  name: "Camille Girard",
  email: "c.girard@example.fr",
  cat: "Visiteur",
  status: "PENDING",
  date: "9 mai"
}, {
  id: 8,
  name: "Léa Fontaine",
  email: "lea.fontaine@example.fr",
  cat: "Presse",
  status: "APPROVED",
  date: "9 mai"
}];
const CATEGORIES = [{
  id: 1,
  name: "Visiteur",
  color: "#16a34a",
  count: 612,
  price: "Gratuit"
}, {
  id: 2,
  name: "Exposant",
  color: "#0ea5e9",
  count: 184,
  price: "250 €"
}, {
  id: 3,
  name: "Presse",
  color: "#10b981",
  count: 47,
  price: "Gratuit"
}, {
  id: 4,
  name: "VIP",
  color: "#f59e0b",
  count: 31,
  price: "Sur invitation"
}];
const STAFF_USERS = [{
  id: 1,
  name: "Julien Petit",
  email: "julien@badge.app",
  role: "Super-admin",
  date: "Actif"
}, {
  id: 2,
  name: "Nadia Khelifi",
  email: "nadia@badge.app",
  role: "Support",
  date: "Actif"
}, {
  id: 3,
  name: "Marc Lambert",
  email: "marc@badge.app",
  role: "Support",
  date: "Inactif"
}];
Object.assign(window, {
  ORGS,
  EVENTS,
  REGISTRATIONS,
  CATEGORIES,
  STAFF_USERS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/badge-app/data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/badge-app/icons.jsx
try { (() => {
/* Badge UI Kit — Icon component. Faithful Lucide path data (stroke 1.5, currentColor). */
const LUCIDE = {
  "building-2": '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  "settings": '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  "calendar": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  "user-check": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  "id-card": '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
  "tags": '<path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z"/><path d="M6 9.01V9"/><path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/>',
  "scan-line": '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  "scroll-text": '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  "menu": '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "check": '<path d="M20 6 9 17l-5-5"/>',
  "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  "more-horizontal": '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  "filter": '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  "circle-x": '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  "mail": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  "qr-code": '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>'
};
function Icon({
  name,
  size = 18,
  stroke = 1.5,
  className = "",
  style = {}
}) {
  const d = LUCIDE[name] || "";
  return /*#__PURE__*/React.createElement("svg", {
    className: "ico " + className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: style,
    "aria-hidden": "true",
    dangerouslySetInnerHTML: {
      __html: d
    }
  });
}
Object.assign(window, {
  Icon,
  LUCIDE
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/badge-app/icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/badge-app/primitives.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Badge UI Kit — primitive components */
const {
  useState
} = React;
function Button({
  variant = "secondary",
  size,
  icon,
  children,
  onClick,
  type = "button"
}) {
  const cls = ["btn", "btn-" + variant, size === "sm" ? "btn-sm" : ""].join(" ");
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    className: cls,
    onClick: onClick
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === "sm" ? 15 : 16
  }), children);
}
function IconButton({
  name,
  onClick,
  title
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "btn-icon",
    onClick: onClick,
    title: title,
    "aria-label": title
  }, /*#__PURE__*/React.createElement(Icon, {
    name: name,
    size: 16
  }));
}
function Card({
  title,
  subtitle,
  children,
  pad = true
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, title && /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, title), subtitle && /*#__PURE__*/React.createElement("p", null, subtitle)), /*#__PURE__*/React.createElement("div", {
    className: pad ? "card-pad" : ""
  }, children));
}
function StatCard({
  label,
  value,
  sub
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "statcard"
  }, /*#__PURE__*/React.createElement("p", {
    className: "lbl"
  }, label), /*#__PURE__*/React.createElement("p", {
    className: "val"
  }, value), sub && /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, sub));
}
const STATUS_LABEL = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée"
};
function StatusBadge({
  status
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "status status-" + status.toLowerCase()
  }, STATUS_LABEL[status]);
}
function Alert({
  kind = "info",
  children
}) {
  const map = {
    ok: "alert-ok",
    err: "alert-err",
    info: "alert-info"
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "alert " + map[kind]
  }, children);
}
function Field({
  label,
  error,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, label && /*#__PURE__*/React.createElement("label", null, label), children, error && /*#__PURE__*/React.createElement("p", {
    className: "err"
  }, error));
}
function Input(props) {
  return /*#__PURE__*/React.createElement("input", _extends({
    className: "input"
  }, props));
}
function Avatar({
  name
}) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return /*#__PURE__*/React.createElement("div", {
    className: "avatar"
  }, initials);
}
function EmptyState({
  icon = "calendar",
  title,
  sub,
  cta
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 44,
    className: "eico"
  }), /*#__PURE__*/React.createElement("p", {
    className: "t"
  }, title), sub && /*#__PURE__*/React.createElement("p", {
    className: "s"
  }, sub), cta);
}
function Modal({
  title,
  children,
  footer,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "mh"
  }, /*#__PURE__*/React.createElement("h3", null, title)), /*#__PURE__*/React.createElement("div", {
    className: "mb"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "mf"
  }, footer)));
}
Object.assign(window, {
  Button,
  IconButton,
  Card,
  StatCard,
  StatusBadge,
  STATUS_LABEL,
  Alert,
  Field,
  Input,
  Avatar,
  EmptyState,
  Modal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/badge-app/primitives.jsx", error: String((e && e.message) || e) }); }

// ui_kits/badge-app/screens_admin.jsx
try { (() => {
/* Badge UI Kit — Staff + Org shell screens */

/* ---------------- STAFF ---------------- */
function StaffOrgs({
  go,
  notify
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Organisations"), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Toutes les organisations de la plateforme")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "plus",
    onClick: () => notify("ok", "Formulaire de création (démo).")
  }, "Cr\xE9er une organisation")), /*#__PURE__*/React.createElement("div", {
    className: "toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-input"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 16,
    className: "ico"
  }), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Rechercher\u2026"
  })), /*#__PURE__*/React.createElement("button", {
    className: "chip-filter"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "filter",
    size: 15
  }), " Plan")), /*#__PURE__*/React.createElement("div", {
    className: "tbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Organisation"), /*#__PURE__*/React.createElement("th", null, "\xC9v\xE9nements"), /*#__PURE__*/React.createElement("th", null, "Membres"), /*#__PURE__*/React.createElement("th", null, "Plan"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, ORGS.map(o => /*#__PURE__*/React.createElement("tr", {
    key: o.id,
    style: {
      cursor: "pointer"
    },
    onClick: () => go({
      shell: "org",
      route: "dashboard",
      org: o.id
    })
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "icon-tile"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "building-2",
    size: 18
  })), /*#__PURE__*/React.createElement("span", {
    className: "cell-name"
  }, o.name))), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, o.events), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, o.members), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "status status-approved",
    style: {
      background: "var(--slate-100)",
      color: "var(--slate-600)"
    }
  }, o.plan)), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 16,
    style: {
      color: "var(--slate-300)"
    }
  }))))))));
}
function StaffUsers({
  notify
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Utilisateurs staff"), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "\xC9quipe interne Badge")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "plus",
    onClick: () => notify("ok", "Invitation envoyée (démo).")
  }, "Inviter un membre")), /*#__PURE__*/React.createElement("div", {
    className: "tbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nom"), /*#__PURE__*/React.createElement("th", null, "E-mail"), /*#__PURE__*/React.createElement("th", null, "R\xF4le"), /*#__PURE__*/React.createElement("th", null, "Statut"))), /*#__PURE__*/React.createElement("tbody", null, STAFF_USERS.map(u => /*#__PURE__*/React.createElement("tr", {
    key: u.id
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: u.name
  }), /*#__PURE__*/React.createElement("span", {
    className: "cell-name"
  }, u.name))), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, u.email), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, u.role), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "dot-wrap",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 13,
      color: "var(--fg2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: u.date === "Actif" ? "var(--emerald-700)" : "var(--slate-300)"
    }
  }), u.date))))))));
}
function StaffSettings() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Param\xE8tres plateforme")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Enregistrer")), /*#__PURE__*/React.createElement("div", {
    className: "form-narrow"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "G\xE9n\xE9ral",
    subtitle: "Configuration globale de l'instance"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nom de l'instance"
  }, /*#__PURE__*/React.createElement(Input, {
    defaultValue: "Badge"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Domaine public"
  }, /*#__PURE__*/React.createElement(Input, {
    defaultValue: "app.badge.fr"
  })), /*#__PURE__*/React.createElement("div", {
    className: "row-2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Fuseau horaire"
  }, /*#__PURE__*/React.createElement(Input, {
    defaultValue: "Europe/Paris"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Langue par d\xE9faut"
  }, /*#__PURE__*/React.createElement(Input, {
    defaultValue: "Fran\xE7ais"
  }))))));
}
function ActivityLog() {
  const items = [{
    who: "Marie Dubois",
    what: "a approuvé l'inscription de Léa Fontaine",
    when: "il y a 12 min",
    ico: "check-circle"
  }, {
    who: "Système",
    what: "a généré 184 badges pour Exposant",
    when: "il y a 1 h",
    ico: "id-card"
  }, {
    who: "Lucas Bernard",
    what: "a créé la catégorie « VIP »",
    when: "il y a 3 h",
    ico: "tags"
  }, {
    who: "Marie Dubois",
    what: "a rejeté l'inscription de Hugo Moreau",
    when: "hier",
    ico: "circle-x"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Journal d'activit\xE9"), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Historique des actions"))), /*#__PURE__*/React.createElement(Card, {
    pad: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 24px"
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    className: "list-row",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "icon-tile"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: it.ico,
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--fg1)"
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 600
    }
  }, it.who), " ", it.what), /*#__PURE__*/React.createElement("div", {
    className: "cell-meta"
  }, it.when)))))));
}

/* ---------------- ORG ---------------- */
function OrgDashboard({
  org,
  go
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Tableau de bord"), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, org.name))), /*#__PURE__*/React.createElement("div", {
    className: "stat-grid"
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "\xC9v\xE9nements",
    value: org.events,
    sub: "2 \xE0 venir"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Inscriptions",
    value: "2 000",
    sub: "+8 % ce mois"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Membres",
    value: org.members,
    sub: "de l'organisation"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Badges \xE9mis",
    value: "1 743",
    sub: "87 % des inscrits"
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-grid"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "\xC9v\xE9nements r\xE9cents"
  }, EVENTS.map(e => /*#__PURE__*/React.createElement("div", {
    className: "list-row",
    key: e.id,
    style: {
      cursor: "pointer"
    },
    onClick: () => go({
      shell: "event",
      route: "dashboard",
      event: e.id
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "icon-tile"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500
    }
  }, e.name), /*#__PURE__*/React.createElement("div", {
    className: "cell-meta"
  }, e.date)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 16,
    style: {
      color: "var(--slate-300)"
    }
  })))), /*#__PURE__*/React.createElement(Card, {
    title: "Activit\xE9"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--fg2)",
      lineHeight: 1.7
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "list-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: "var(--emerald-700)"
    }
  }), "37 inscriptions en attente de validation"), /*#__PURE__*/React.createElement("div", {
    className: "list-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: "var(--green-500)"
    }
  }), "Conf\xE9rence 2026 ouvre dans 14 jours"), /*#__PURE__*/React.createElement("div", {
    className: "list-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: "var(--amber-700)"
    }
  }), "Quota du plan Pro \xE0 82 %")))));
}
function OrgEvents({
  go,
  notify
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "\xC9v\xE9nements")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "plus",
    onClick: () => notify("ok", "Formulaire de création (démo).")
  }, "Cr\xE9er un \xE9v\xE9nement")), /*#__PURE__*/React.createElement("div", {
    className: "tbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\xC9v\xE9nement"), /*#__PURE__*/React.createElement("th", null, "Date"), /*#__PURE__*/React.createElement("th", null, "Inscriptions"), /*#__PURE__*/React.createElement("th", null, "Statut"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, EVENTS.map(e => /*#__PURE__*/React.createElement("tr", {
    key: e.id,
    style: {
      cursor: "pointer"
    },
    onClick: () => go({
      shell: "event",
      route: "dashboard",
      event: e.id
    })
  }, /*#__PURE__*/React.createElement("td", {
    className: "cell-name"
  }, e.name), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, e.date), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, e.regs.toLocaleString("fr-FR")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "status",
    style: {
      background: e.status === "Ouvert" ? "var(--emerald-50)" : "var(--slate-100)",
      color: e.status === "Ouvert" ? "var(--emerald-700)" : "var(--slate-600)"
    }
  }, e.status)), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 16,
    style: {
      color: "var(--slate-300)"
    }
  }))))))));
}
function OrgSettings() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Param\xE8tres de l'organisation")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Enregistrer")), /*#__PURE__*/React.createElement("div", {
    className: "form-narrow"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Profil"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nom de l'organisation"
  }, /*#__PURE__*/React.createElement(Input, {
    defaultValue: "Acme Events"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "E-mail de contact"
  }, /*#__PURE__*/React.createElement(Input, {
    defaultValue: "contact@acme-events.fr"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Site web"
  }, /*#__PURE__*/React.createElement(Input, {
    defaultValue: "https://acme-events.fr"
  })))));
}
Object.assign(window, {
  StaffOrgs,
  StaffUsers,
  StaffSettings,
  ActivityLog,
  OrgDashboard,
  OrgEvents,
  OrgSettings
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/badge-app/screens_admin.jsx", error: String((e && e.message) || e) }); }

// ui_kits/badge-app/screens_event.jsx
try { (() => {
/* Badge UI Kit — Event shell screens */
const {
  useState: useStateEv
} = React;
function EventDashboard({
  event
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Tableau de bord"), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, event.name, " \xB7 ", event.date))), /*#__PURE__*/React.createElement("div", {
    className: "stat-grid"
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Inscriptions",
    value: event.regs.toLocaleString("fr-FR"),
    sub: "+12 % cette semaine"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "En attente",
    value: "37",
    sub: "\xE0 valider"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Badges \xE9mis",
    value: "1 094",
    sub: "88 % des inscrits"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Cat\xE9gories",
    value: "4",
    sub: "Visiteur, Exposant\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel-grid"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Inscriptions par cat\xE9gorie"
  }, CATEGORIES.map(c => {
    const pct = Math.round(c.count / 874 * 100);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--fg2)"
      }
    }, c.name), /*#__PURE__*/React.createElement("span", {
      className: "cell-meta"
    }, c.count)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 6,
        background: "var(--slate-100)",
        borderRadius: 9999
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: pct + "%",
        height: "100%",
        background: c.color,
        borderRadius: 9999
      }
    })));
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Derni\xE8res inscriptions"
  }, REGISTRATIONS.slice(0, 5).map(r => /*#__PURE__*/React.createElement("div", {
    className: "list-row",
    key: r.id
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r.name
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    className: "cell-meta"
  }, r.cat)), /*#__PURE__*/React.createElement(StatusBadge, {
    status: r.status
  }))))));
}
function EventInscriptions({
  regs,
  setRegs,
  confirmDelete,
  notify
}) {
  const [q, setQ] = useStateEv("");
  const [filter, setFilter] = useStateEv("ALL");
  const filtered = regs.filter(r => (filter === "ALL" || r.status === filter) && (r.name.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase())));
  const setStatus = (id, status) => {
    setRegs(rs => rs.map(r => r.id === id ? {
      ...r,
      status
    } : r));
    notify("ok", status === "APPROVED" ? "Inscription approuvée." : "Inscription rejetée.");
  };
  const counts = {
    ALL: regs.length,
    PENDING: regs.filter(r => r.status === "PENDING").length
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Inscriptions"), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, regs.length, " participants \xB7 ", counts.PENDING, " en attente")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "plus",
    onClick: () => notify("info", "Ajout manuel (démo).")
  }, "Ajouter")), /*#__PURE__*/React.createElement("div", {
    className: "toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-input"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 16,
    className: "ico"
  }), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Rechercher un participant\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, [["ALL", "Tous"], ["PENDING", "En attente"], ["APPROVED", "Approuvées"], ["REJECTED", "Rejetées"]].map(([k, lbl]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "chip-filter",
    onClick: () => setFilter(k),
    style: filter === k ? {
      borderColor: "var(--green-500)",
      color: "var(--accent)",
      background: "var(--accent-nav-bg)"
    } : {}
  }, lbl))), /*#__PURE__*/React.createElement("div", {
    className: "spacer"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: "download",
    onClick: () => notify("info", "Export CSV (démo).")
  }, "Exporter")), filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "tbl-wrap"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    icon: "user-check",
    title: "Aucune inscription",
    sub: "Aucun participant ne correspond \xE0 ce filtre."
  })) : /*#__PURE__*/React.createElement("div", {
    className: "tbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Participant"), /*#__PURE__*/React.createElement("th", null, "Cat\xE9gorie"), /*#__PURE__*/React.createElement("th", null, "Statut"), /*#__PURE__*/React.createElement("th", null, "Inscrit"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r.name
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "cell-name"
  }, r.name), /*#__PURE__*/React.createElement("div", {
    className: "cell-meta"
  }, r.email)))), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, r.cat), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusBadge, {
    status: r.status
  })), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, r.date), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "row-actions"
  }, r.status === "PENDING" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
    name: "check",
    title: "Approuver",
    onClick: () => setStatus(r.id, "APPROVED")
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "x",
    title: "Rejeter",
    onClick: () => setStatus(r.id, "REJECTED")
  })), /*#__PURE__*/React.createElement(IconButton, {
    name: "trash-2",
    title: "Supprimer",
    onClick: () => confirmDelete(r)
  })))))))), /*#__PURE__*/React.createElement("div", {
    className: "pager"
  }, /*#__PURE__*/React.createElement("span", {
    className: "info"
  }, filtered.length, " sur ", regs.length), /*#__PURE__*/React.createElement("div", {
    className: "ctrls"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "Pr\xE9c\xE9dent"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "Suivant"))));
}
function EventBadges({
  event,
  notify
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Badges"), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Aper\xE7u et impression")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "download",
    onClick: () => notify("ok", "Génération PDF lancée (démo).")
  }, "G\xE9n\xE9rer les badges")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      gap: 16
    }
  }, REGISTRATIONS.filter(r => r.status === "APPROVED").map(r => /*#__PURE__*/React.createElement("div", {
    className: "card",
    key: r.id,
    style: {
      padding: 0,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--brand-navy)",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-light.svg",
    alt: "Badge",
    style: {
      height: 18
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "var(--slate-400)",
      textTransform: "uppercase",
      letterSpacing: ".08em"
    }
  }, r.cat)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: "flex",
      gap: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    className: "cell-meta",
    style: {
      marginTop: 2
    }
  }, event.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 6,
      background: "var(--slate-100)",
      color: "var(--slate-400)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "qr-code",
    size: 26
  })))))));
}
function EventCategories({
  notify
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Cat\xE9gories")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "plus",
    onClick: () => notify("ok", "Nouvelle catégorie (démo).")
  }, "Cr\xE9er une cat\xE9gorie")), /*#__PURE__*/React.createElement("div", {
    className: "tbl-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Cat\xE9gorie"), /*#__PURE__*/React.createElement("th", null, "Inscrits"), /*#__PURE__*/React.createElement("th", null, "Tarif"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, CATEGORIES.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 4,
      background: c.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "cell-name"
  }, c.name))), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, c.count), /*#__PURE__*/React.createElement("td", {
    className: "cell-meta"
  }, c.price), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "row-actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    name: "trash-2",
    title: "Supprimer"
  })))))))));
}
function EventScanner({
  notify
}) {
  const [scanned, setScanned] = useStateEv(null);
  const scan = () => {
    const r = REGISTRATIONS[Math.floor(Math.random() * 5)];
    setScanned(r);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Scanner"), /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Contr\xF4le d'acc\xE8s \xE0 l'entr\xE9e"))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 420,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card card-pad",
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 200,
      height: 200,
      margin: "0 auto 20px",
      borderRadius: 16,
      background: "var(--brand-navy)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scan-line",
    size: 72,
    style: {
      color: "rgba(255,255,255,0.35)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 20,
      border: "2px solid var(--green-400)",
      borderRadius: 8,
      opacity: .6
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: scan
  }, "Simuler un scan")), scanned && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Alert, {
    kind: scanned.status === "APPROVED" ? "ok" : "err"
  }, scanned.status === "APPROVED" ? `Accès autorisé — ${scanned.name} (${scanned.cat})` : `Accès refusé — ${scanned.name} n'est pas approuvé`))));
}
function SimpleList({
  title,
  rows
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, title))), /*#__PURE__*/React.createElement(Card, {
    pad: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 24px"
    }
  }, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    className: "list-row",
    key: i
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r.name
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    className: "cell-meta"
  }, r.email)), /*#__PURE__*/React.createElement("span", {
    className: "cell-meta"
  }, r.role))))));
}
Object.assign(window, {
  EventDashboard,
  EventInscriptions,
  EventBadges,
  EventCategories,
  EventScanner,
  SimpleList
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/badge-app/screens_event.jsx", error: String((e && e.message) || e) }); }

// ui_kits/badge-app/shell.jsx
try { (() => {
/* Badge UI Kit — Shell: Sidebar (3 variants) + Header + AppShell */

function NavItem({
  icon,
  label,
  active,
  onClick
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: "nav-item" + (active ? " active" : ""),
    onClick: onClick
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 18,
    className: "ico"
  }), label);
}
function Sidebar({
  shell,
  route,
  nav,
  org,
  event,
  onNav,
  onLogo
}) {
  return /*#__PURE__*/React.createElement("aside", {
    className: "sidebar"
  }, /*#__PURE__*/React.createElement("img", {
    className: "sidebar-logo",
    src: "../../assets/logo-light.svg",
    alt: "Badge",
    onClick: onLogo,
    style: {
      cursor: "pointer"
    }
  }), shell === "org" && org && /*#__PURE__*/React.createElement("div", {
    className: "sidebar-ident"
  }, /*#__PURE__*/React.createElement("div", {
    className: "title"
  }, org.name)), shell === "event" && event && /*#__PURE__*/React.createElement("div", {
    className: "sidebar-ident"
  }, /*#__PURE__*/React.createElement("a", {
    className: "back",
    onClick: () => onNav({
      shell: "org",
      route: "dashboard",
      org: event.org
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 13
  }), " ", org ? org.name : "Organisation"), /*#__PURE__*/React.createElement("div", {
    className: "title"
  }, event.name)), nav.map((item, i) => item.sep ? /*#__PURE__*/React.createElement("div", {
    className: "nav-sep",
    key: "s" + i
  }) : item.group ? /*#__PURE__*/React.createElement("div", {
    className: "nav-group-label",
    key: "g" + i
  }, item.group) : /*#__PURE__*/React.createElement(NavItem, {
    key: item.route,
    icon: item.icon,
    label: item.label,
    active: route === item.route,
    onClick: () => onNav({
      route: item.route
    })
  })));
}
function Header({
  crumbs,
  user,
  onMenu
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "header"
  }, /*#__PURE__*/React.createElement("button", {
    className: "menu-btn",
    onClick: onMenu,
    "aria-label": "Menu"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 20
  })), /*#__PURE__*/React.createElement("nav", {
    className: "crumbs"
  }, crumbs.map((c, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: "c" + (i === crumbs.length - 1 ? " last" : "")
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "user-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nm"
  }, user.name), /*#__PURE__*/React.createElement(Avatar, {
    name: user.name
  })));
}
function AppShell({
  sidebar,
  header,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, sidebar, /*#__PURE__*/React.createElement("div", {
    className: "main-wrap"
  }, header, /*#__PURE__*/React.createElement("main", {
    className: "main"
  }, children)));
}
Object.assign(window, {
  Sidebar,
  Header,
  AppShell,
  NavItem
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/badge-app/shell.jsx", error: String((e && e.message) || e) }); }

})();
