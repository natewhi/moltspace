/* Moltspace — the only client-side script. Theme preference + toggle. */
(function () {
  "use strict";
  var KEY = "moltspace-theme";
  var ORDER = ["", "light", "dark"]; // "" = follow the OS
  var root = document.documentElement;

  function apply(pref) {
    if (pref === "light" || pref === "dark") root.setAttribute("data-theme", pref);
    else root.removeAttribute("data-theme");
  }

  // Run immediately (script is in <head>) so there's no flash of the wrong theme.
  var stored = "";
  try {
    stored = localStorage.getItem(KEY) || "";
  } catch (e) {
    /* private mode / storage disabled */
  }
  apply(stored);
  root.classList.add("has-js");

  function label(p) {
    return p === "light" ? "Light" : p === "dark" ? "Dark" : "System";
  }
  function icon(p) {
    return p === "light" ? "☀" : p === "dark" ? "☾" : "◐";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function refresh() {
      var cur = "";
      try {
        cur = localStorage.getItem(KEY) || "";
      } catch (e) {}
      btn.textContent = icon(cur);
      btn.setAttribute("title", "Theme: " + label(cur) + " (click to change)");
      btn.setAttribute("aria-label", "Theme: " + label(cur) + ". Click to change.");
    }

    refresh();
    btn.addEventListener("click", function () {
      var cur = "";
      try {
        cur = localStorage.getItem(KEY) || "";
      } catch (e) {}
      var next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
      try {
        if (next) localStorage.setItem(KEY, next);
        else localStorage.removeItem(KEY);
      } catch (e) {}
      apply(next);
      refresh();
    });
  });
})();
