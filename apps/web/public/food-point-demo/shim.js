/*
 * Not part of the 2024 code: the portfolio demo adds this one script before
 * everything else in index.html. The Food Point frontend runs as it was;
 * only what it needs from a server changes:
 *
 * - requests to /api go to the simulated server of the page around it
 *   (src/components/food-point/server.ts), which keeps the data in this
 *   browser, instead of the Express API and PostgreSQL;
 * - the app starts at "/", the path its router expects;
 * - uploaded profile pictures come from that same browser storage.
 */
(function () {
  "use strict";

  var host = null;
  try {
    host = window.parent !== window ? window.parent.__foodPointDemo : null;
  } catch {
    // A parent from another origin: no bridge.
  }
  if (!host) {
    // Opened on its own: the demo lives on the case study page.
    window.location.replace("/projects/food-point");
    return;
  }

  // The router reads location.pathname; the file is served from elsewhere.
  history.replaceState(null, "", "/");
  host.navigate("/");

  var push = history.pushState;
  history.pushState = function () {
    push.apply(history, arguments);
    host.navigate(location.pathname);
  };
  window.addEventListener("popstate", function () {
    host.navigate(location.pathname);
  });

  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.origin !== location.origin || url.pathname.indexOf("/api/") !== 0) {
      return realFetch.apply(window, arguments);
    }
    init = init || {};
    return host
      .request(init.method || "GET", url.pathname.slice(4) + url.search, init.body)
      .then(function (reply) {
        return new Response(reply.text, {
          status: reply.status,
          headers: { "Content-Type": reply.type },
        });
      });
  };

  // <img src="/assets/uploads/<hash>"> and background-image: url(...).
  var UPLOADS = "/assets/uploads/";
  function swap(el) {
    if (el.tagName === "IMG") {
      var src = el.getAttribute("src");
      if (src && src.indexOf(UPLOADS) === 0) {
        var image = host.upload(src.slice(UPLOADS.length));
        if (image) el.setAttribute("src", image);
      }
    }
    var bg = el.style && el.style.backgroundImage;
    var at = bg ? bg.indexOf(UPLOADS) : -1;
    if (at !== -1) {
      var hash = bg.slice(at + UPLOADS.length).replace(/["')].*$/, "");
      var picture = host.upload(hash);
      if (picture) el.style.backgroundImage = 'url("' + picture + '")';
    }
  }
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      if (record.type === "attributes") return swap(record.target);
      record.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        swap(node);
        node.querySelectorAll("img, [style]").forEach(swap);
      });
    });
  }).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "style"],
  });
})();
