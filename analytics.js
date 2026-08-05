(function () {
  try {
    fetch("/.netlify/functions/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: location.pathname,
        referrer: document.referrer || "",
      }),
    }).catch(function () {});
  } catch (e) {
    /* fail silently — analytics should never break the page */
  }
})();
