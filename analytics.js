(function () {
  try {
    var params = new URLSearchParams(location.search);
    var source = params.get("src") || params.get("utm_source") || "";

    fetch("/.netlify/functions/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: location.pathname,
        referrer: document.referrer || "",
        source: source,
      }),
    }).catch(function () {});
  } catch (e) {
    /* fail silently — analytics should never break the page */
  }
})();
