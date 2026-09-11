(function () {
  const form = document.getElementById("feedback-form");
  const status = document.getElementById("status");
  const list = document.getElementById("list");
  const csrfInput = document.getElementById("csrf");
  const unlockForm = document.getElementById("unlock-form");
  const unlockWrap = document.getElementById("unlock-wrap");
  const unlockStatus = document.getElementById("unlock-status");
  const savedPanel = document.getElementById("saved-panel");
  const savedSummary = document.getElementById("saved-summary");
  const submitAnother = document.getElementById("submit-another");
  const staffBoard = document.getElementById("staff-board");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setCsrf(token) {
    if (token && csrfInput) csrfInput.value = token;
  }

  async function refreshCsrf() {
    const res = await fetch("/api/csrf", { credentials: "same-origin" });
    const data = await res.json();
    setCsrf(data.csrf);
  }

  function recommendLabel(v) {
    if (v === "yes") return "Would recommend: yes";
    if (v === "no") return "Would recommend: no";
    return "Would recommend: not stated";
  }

  function showSaved(entry) {
    savedSummary.innerHTML =
      "<strong>" +
      escapeHtml(entry.sessionLabel) +
      "</strong> · Rating " +
      escapeHtml(String(entry.rating)) +
      "/5 · " +
      escapeHtml(recommendLabel(entry.wouldRecommend)) +
      "<br><em>Went well:</em> " +
      escapeHtml(entry.whatWentWell) +
      "<br><em>Improve:</em> " +
      escapeHtml(entry.whatCouldImprove);
    form.hidden = true;
    savedPanel.hidden = false;
    status.textContent = "";
  }

  async function refresh() {
    if (!list) return;
    try {
      const res = await fetch("/api/feedback", { credentials: "same-origin" });
      if (res.status === 401) {
        list.innerHTML = '<p class="empty">Board locked.</p>';
        if (unlockWrap) unlockWrap.hidden = false;
        return;
      }
      const data = await res.json();
      if (unlockWrap) unlockWrap.hidden = true;
      if (staffBoard) staffBoard.open = true;
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
            escapeHtml(recommendLabel(item.wouldRecommend)) +
            " · " +
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
        if (res.status === 403) await refreshCsrf();
        return;
      }
      if (data.csrf) setCsrf(data.csrf);
      else await refreshCsrf();
      if (data.entry) showSaved(data.entry);
      else {
        status.textContent = "Thanks — feedback recorded.";
        form.reset();
      }
      await refresh();
    } catch (err) {
      status.textContent = "Network error.";
    }
  });

  if (submitAnother) {
    submitAnother.addEventListener("click", async function () {
      savedPanel.hidden = true;
      form.hidden = false;
      form.reset();
      var skip = form.querySelector('input[name="wouldRecommend"][value="skip"]');
      if (skip) skip.checked = true;
      await refreshCsrf();
      status.textContent = "";
    });
  }

  if (unlockForm) {
    unlockForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      unlockStatus.textContent = "Unlocking…";
      const secret = document.getElementById("demo-secret").value;
      try {
        const res = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ secret: secret }),
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          unlockStatus.textContent = data.error || "Unlock failed.";
          return;
        }
        unlockStatus.textContent = "Staff board unlocked.";
        document.getElementById("demo-secret").value = "";
        await refresh();
      } catch (err) {
        unlockStatus.textContent = "Network error.";
      }
    });
  }

  // Only probe the board API when staff details is open or already unlocked
  if (staffBoard) {
    staffBoard.addEventListener("toggle", function () {
      if (staffBoard.open) refresh();
    });
    if (staffBoard.open) refresh();
  }
})();
