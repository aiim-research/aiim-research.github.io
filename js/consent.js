/*
 * Opt-in-only Google Analytics (GA4) with a locally stored consent receipt.
 * Nothing is sent to Google until the visitor explicitly accepts statistics.
 * Configuration comes from data-* attributes on #cookie-banner (see _config.yml).
 */
(function () {
  "use strict";

  var banner = document.getElementById("cookie-banner");
  if (!banner) return;

  var measurementId = banner.getAttribute("data-ga-id") || "";
  var version = (banner.getAttribute("data-version") || "1") + ":" + measurementId;
  var gaEnabled = /^G-[A-Z0-9]+$/.test(measurementId);
  var KEY = "aiimlab-consent";
  var SCRIPT_ID = "aiimlab-analytics";
  var SIX_MONTHS_PARAM = 6;

  var memory = null; // used only when localStorage is unavailable
  var active = false;

  function $(id) { return document.getElementById(id); }

  /* ---------- consent receipt ---------- */

  function readChoice() {
    try {
      var value = memory || JSON.parse(window.localStorage.getItem(KEY) || "null");
      if (!value || value.version !== version || typeof value.analytics !== "boolean") return null;
      var saved = new Date(value.saved_at);
      var expiry = new Date(value.saved_at);
      var now = new Date();
      expiry.setUTCMonth(expiry.getUTCMonth() + SIX_MONTHS_PARAM);
      return isFinite(saved.getTime()) && saved <= now && now < expiry ? value : null;
    } catch (e) {
      return null;
    }
  }

  function writeChoice(analytics) {
    var value = { version: version, analytics: analytics === true, saved_at: new Date().toISOString() };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(value));
      memory = null;
    } catch (e) {
      memory = value; // valid for this page only; the visitor is asked again next time
    }
    return value;
  }

  function allowed() {
    var choice = readChoice();
    return gaEnabled && !!choice && choice.analytics === true;
  }

  /* ---------- Google Analytics ---------- */

  function pageParameters() {
    return {
      page_location: window.location.origin + window.location.pathname,
      page_referrer: "",
      page_title: document.title
    };
  }

  function enableAnalytics() {
    if (active || !allowed()) return;
    window["ga-disable-" + measurementId] = false;
    window.dataLayer = [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied"
    });
    window.gtag("consent", "update", {
      analytics_storage: "granted", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied"
    });
    window.gtag("set", "ads_data_redaction", true);
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 5184000, // 60 days, no automatic renewal
      cookie_update: false,
      cookie_path: "/",
      cookie_flags: "SameSite=Lax;Secure"
    });
    var script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
    active = true;
    document.head.appendChild(script);
    window.gtag("event", "page_view", pageParameters());
  }

  function disableAnalytics() {
    if (gaEnabled) window["ga-disable-" + measurementId] = true;
    var wasLoaded = !!$(SCRIPT_ID);
    var tag = $(SCRIPT_ID);
    if (tag) tag.parentNode.removeChild(tag);
    if (window.dataLayer) window.dataLayer.length = 0;
    active = false;

    var host = window.location.hostname.split(".");
    var domains = [""];
    for (var i = 0; i < host.length - 1; i++) domains.push(host.slice(i).join("."));
    var pairs = document.cookie ? document.cookie.split(";") : [];
    for (var p = 0; p < pairs.length; p++) {
      var name = pairs[p].split("=")[0].replace(/^\s+|\s+$/g, "");
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (var d = 0; d < domains.length; d++) {
        document.cookie = name + "=; Max-Age=0; Path=/; SameSite=Lax" + (domains[d] ? "; Domain=" + domains[d] : "");
      }
    }
    return wasLoaded;
  }

  /* ---------- banner ---------- */

  var returnFocus = null;

  function showBanner(fromPreferences) {
    if (fromPreferences) {
      returnFocus = document.activeElement;
      $("cookie-preferences").open = true;
      $("cookie-analytics").checked = allowed();
    }
    banner.hidden = false;
    var target = fromPreferences ? $("cookie-close") : $("cookie-accept");
    if (target && !target.disabled) target.focus();
  }

  function hideBanner() {
    banner.hidden = true;
    $("cookie-preferences").open = false;
    if (returnFocus && returnFocus.focus) returnFocus.focus();
    returnFocus = null;
  }

  function choose(analytics) {
    var wanted = analytics === true && gaEnabled;
    writeChoice(wanted);
    var status = $("cookie-status");
    if (status) {
      status.textContent = memory
        ? "Your browser could not store this choice; it applies to this page only."
        : "";
    }
    if (wanted) {
      enableAnalytics();
    } else if (disableAnalytics()) {
      // An already-loaded tag cannot be unloaded reliably; reload to drop it.
      window.location.reload();
      return;
    }
    if (!memory) hideBanner();
  }

  function checkConsent() {
    if (allowed()) {
      enableAnalytics();
    } else {
      if (disableAnalytics()) { window.location.reload(); return; }
      if (!readChoice() && banner.hidden) showBanner(false);
    }
  }

  /* ---------- wiring ---------- */

  if (!gaEnabled) {
    // No measurement ID configured: nothing to consent to.
    return;
  }

  $("cookie-accept").addEventListener("click", function () { choose(true); });
  $("cookie-reject").addEventListener("click", function () { choose(false); });
  $("cookie-close").addEventListener("click", function () { choose(false); });
  $("cookie-save").addEventListener("click", function () { choose($("cookie-analytics").checked); });

  var openers = document.querySelectorAll("[data-cookie-settings]");
  for (var i = 0; i < openers.length; i++) {
    openers[i].addEventListener("click", function () { showBanner(true); });
  }

  banner.addEventListener("keydown", function (event) {
    if (event.key === "Escape") choose(readChoice() ? allowed() : false);
  });

  window.addEventListener("storage", checkConsent);
  window.addEventListener("focus", checkConsent);
  window.addEventListener("pageshow", checkConsent);

  if (allowed()) {
    enableAnalytics();
  } else if (!readChoice()) {
    showBanner(false);
  }
})();
