/* =========================================================
   KV Cache 调研 — interactions
   ========================================================= */

(function () {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.getElementById("siteHeader");
  const progress = document.querySelector(".progress span");
  const mainTabbar = document.querySelector(".tabbar");

  const archTabs = Array.from(document.querySelectorAll(".tab"));
  const archPanels = new Map(
    archTabs.map((tab) => [tab.dataset.arch, document.getElementById("panel-" + tab.dataset.arch)])
  );

  const enginePanels = Array.from(document.querySelectorAll(".engine"));
  const engineTabs = Array.from(document.querySelectorAll(".engine-tab"));

  const enginesByArch = new Map();
  const engineTabsByArch = new Map();
  const lastEngine = {};

  enginePanels.forEach((panel) => {
    const arch = panel.id.split("-")[0];
    const engine = panel.id.slice(arch.length + 1);
    panel.dataset.arch = arch;
    panel.dataset.engine = engine;
    panel.setAttribute("role", "tabpanel");
    if (!enginesByArch.has(arch)) enginesByArch.set(arch, []);
    enginesByArch.get(arch).push(engine);
  });

  engineTabs.forEach((button) => {
    const arch = button.dataset.arch;
    if (!engineTabsByArch.has(arch)) engineTabsByArch.set(arch, []);
    engineTabsByArch.get(arch).push(button);
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (panel) panel.setAttribute("aria-labelledby", button.id);
  });

  function stickyOffset() {
    return header.offsetHeight + (mainTabbar ? mainTabbar.offsetHeight : 0) + 14;
  }

  function setEngine(arch, engine, opts) {
    const options = opts || {};
    const engines = enginesByArch.get(arch);
    if (!engines || !engines.length) return;
    if (!engines.includes(engine)) engine = engines[0];
    lastEngine[arch] = engine;

    enginePanels.forEach((panel) => {
      if (panel.dataset.arch === arch) panel.hidden = panel.dataset.engine !== engine;
    });

    (engineTabsByArch.get(arch) || []).forEach((button) => {
      const active = button.dataset.engine === engine;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });

    if (options.updateHash !== false) {
      const next = "#" + arch + "-" + engine;
      if (window.location.hash !== next) history.replaceState(null, "", next);
    }

    if (options.scroll) {
      const bar = document.querySelector("#panel-" + arch + " .engine-tabs");
      if (bar) {
        window.requestAnimationFrame(() => {
          const rect = bar.getBoundingClientRect();
          const top = rect.top + window.scrollY - stickyOffset();
          window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
        });
      }
    }
  }

  function setArch(arch, opts) {
    const options = opts || {};
    if (!archPanels.has(arch)) arch = "swa";
    root.dataset.arch = arch;

    archTabs.forEach((tab) => {
      const active = tab.dataset.arch === arch;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
    });

    archPanels.forEach((panel, key) => {
      const active = key === arch;
      if (active) {
        panel.hidden = false;
        panel.style.animation = "none";
        void panel.offsetWidth;
        panel.style.animation = "";
      } else {
        panel.hidden = true;
      }
    });

    const engines = enginesByArch.get(arch) || [];
    setEngine(arch, lastEngine[arch] || engines[0], { updateHash: false });

    if (options.updateHash !== false) {
      const next = "#" + arch;
      if (window.location.hash !== next) history.replaceState(null, "", next);
    }

    if (options.scroll) {
      const panel = archPanels.get(arch);
      window.requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        const top = rect.top + window.scrollY - stickyOffset();
        window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }
  }

  archTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setArch(tab.dataset.arch, { scroll: true }));
    tab.addEventListener("keydown", (event) => {
      let next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % archTabs.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + archTabs.length) % archTabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = archTabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      archTabs[next].focus();
      setArch(archTabs[next].dataset.arch, { scroll: true });
    });
  });

  engineTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setArch(button.dataset.arch, { updateHash: false });
      setEngine(button.dataset.arch, button.dataset.engine, { scroll: true });
    });

    button.addEventListener("keydown", (event) => {
      const group = engineTabsByArch.get(button.dataset.arch) || [];
      const index = group.indexOf(button);
      let next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % group.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + group.length) % group.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = group.length - 1;
      if (next === null) return;
      event.preventDefault();
      const target = group[next];
      target.focus();
      setArch(button.dataset.arch, { updateHash: false });
      setEngine(button.dataset.arch, target.dataset.engine, { scroll: true });
    });
  });

  // deeplinks: #swa, #dsa-vllm, #swa-deepinfer ...
  function applyHash(scrollToTarget) {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;
    const arch = raw.split("-")[0];
    if (!archPanels.has(arch)) return;

    const engine = raw === arch ? null : raw.slice(arch.length + 1);
    setArch(arch, { updateHash: false });
    if (engine) setEngine(arch, engine, { updateHash: false });

    if (!scrollToTarget) return;
    const tabOnly = raw === arch;
    const target = tabOnly ? document.getElementById("architectures") : document.getElementById(raw);
    if (!target) return;

    window.requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      const offset = tabOnly ? header.offsetHeight + 20 : stickyOffset();
      const top = rect.top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "auto" });
    });
  }

  if (window.location.hash) {
    applyHash(true);
  } else {
    // initialise one visible engine per architecture (for clean print output too)
    ["swa", "dsa", "msa"].forEach((arch) => {
      const engines = enginesByArch.get(arch) || [];
      setEngine(arch, engines[0], { updateHash: false });
    });
    setArch("swa", { updateHash: false });
  }

  window.addEventListener("hashchange", () => applyHash(true));

  /* ---------- scroll chrome ---------- */

  function onScroll() {
    const y = window.scrollY || 0;
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      progress.style.width = (pct * 100).toFixed(2) + "%";
    }
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    },
    { passive: true }
  );
  onScroll();

  /* ---------- lightbox ---------- */

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxCap = document.getElementById("lightboxCap");
  const lightboxClose = document.querySelector(".lightbox-close");
  let lastFocused = null;

  document.querySelectorAll("img.zoomable").forEach((img) => {
    img.addEventListener("click", () => {
      if (!lightbox || !lightboxImg) return;
      lastFocused = img;
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt || "";
      if (lightboxCap) lightboxCap.textContent = img.dataset.caption || img.alt || "";
      lightbox.showModal();
    });
  });

  if (lightbox) {
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("close", () => {
      if (lastFocused) lastFocused.focus();
    });
  }

  if (lightboxClose) {
    lightboxClose.addEventListener("click", () => {
      if (lightbox) lightbox.close();
    });
  }

  /* ---------- print ---------- */

  const printBtn = document.querySelector(".print-btn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }
})();
