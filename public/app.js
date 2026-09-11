(function () {
  const form = document.getElementById("feedback-form");
  const status = document.getElementById("status");
  const list = document.getElementById("list");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function refresh() {
    try {
      const res = await fetch("/api/feedback", { credentials: "same-origin" });
      const data = await res.json();
      if (!data.items || !data.items.length) {
        list.innerHTML = '<p class="empty">No feedback yet.</p>';
        return;
      }
      list.innerHTML = data.items
        .map(function (item) {
          return (
            '<article class="card">' +
            '<div class="meta">Rating ' +
            escapeHtml(item.rating) +
            "/5 · " +
            escapeHtml(item.createdAt) +
            "</div>" +
            "<strong>" +
            escapeHtml(item.sessionLabel) +
            "</strong>" +
            "<p><em>Went well:</em> " +
            escapeHtml(item.whatWentWell) +
            "</p>" +
            "<p><em>Improve:</em> " +
            escapeHtml(item.whatCouldImprove) +
            "</p>" +
            "</article>"
          );
        })
        .join("");
    } catch (e) {
      list.innerHTML = '<p class="empty">Could not load feedback.</p>';
    }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    status.textContent = "Submitting…";
    const body = new URLSearchParams(new FormData(form));
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "same-origin",
        body,
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        status.textContent = data.error || "Submit failed.";
        return;
      }
      status.textContent = "Thanks — feedback recorded.";
      form.reset();
      // Refresh CSRF by reloading the page token via a soft reload of home markup
      location.reload();
    } catch (err) {
      status.textContent = "Network error.";
    }
  });

  refresh();
})();
