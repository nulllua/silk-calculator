// Admin runtime orchestrator (safe split):
// - helpers are in admin-utils.js
// - feature CRUD logic lives in section files
// - this file handles auth, tab routing, and lazy loading

async function doLogin() {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: v("user"), password: el("pw").value }),
  });
  if (res.ok) {
    const data = await res.json();
    localStorage.setItem("admin_token", data.token);
    window.ADMIN_CTX.role = data.role;
    window.ADMIN_CTX.username = data.username;
    await showMain();
  } else {
    el("loginErr").style.display = "block";
  }
}

function logout() {
  localStorage.removeItem("admin_token");
  location.reload();
}

const TAB_NODES = Array.from(document.querySelectorAll(".tab"));
const PANEL_NODES = Array.from(document.querySelectorAll(".panel"));
const TAB_LOADERS = {
  analytics: loadAnalytics,
  site: loadSite,
  goods: loadGoods,
  travel: loadTravel,
  events: loadEvents,
  cities: loadCities,
  traits: loadTraits,
  religions: loadReligions,
  languages: loadLanguages,
  activity: loadActivity,
};
const loadedTabs = new Set();
let analyticsTimerId = null;

function loadTabOnce(tabName) {
  const loader = TAB_LOADERS[tabName];
  if (!loader || loadedTabs.has(tabName)) return;
  loadedTabs.add(tabName);
  loader();
}

async function showMain() {
  el("login").style.display = "none";
  el("main").style.display = "flex";
  await refreshGovernance();
  loadTabOnce("analytics");
  loadTabOnce("activity");
  if (analyticsTimerId === null)
    analyticsTimerId = setInterval(loadAnalytics, 30000);
}

TAB_NODES.forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    TAB_NODES.forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === name),
    );
    PANEL_NODES.forEach((p) => p.classList.remove("active"));
    el("panel-" + name).classList.add("active");
    loadTabOnce(name);
  });
});

if (token()) showMain();
else el("login").style.display = "flex";
