(function () {
  const form = document.getElementById("feedback-form");
  const status = document.getElementById("status");
  const list = document.getElementById("list");
  const csrfInput = document.getElementById("csrf");
  const savedPanel = document.getElementById("saved-panel");
  const savedSummary = document.getElementById("saved-summary");
  const submitAnother = document.getElementById("submit-another");
  const staffForm = document.getElementById("staff-form");
  const staffGate = document.getElementById("staff-gate");
  const staffBoard = document.getElementById("staff-board");
  const staffStatus = document.getElementById("staff-status");
  const staffWho = document.getElementById("staff-who");
  const staffSignout = document.getElementById("staff-signout");
  const panelStudent = document.getElementById("panel-student");
  const panelStaff = document.getElementById("panel-staff");
  const tabs = document.querySelectorAll(".tab");
  var lastEntry = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clearFieldErrors() {
    ["sessionLabel", "rating", "whatWentWell", "whatCouldImprove"].forEach(function (k) {
      var el = document.getElementById("err-" + k);
      if (el) {
        el.hidden = true;
        el.textContent = "";
      }
    });
  }

  function showFieldErrors(fieldErrors) {
    clearFieldErrors();
    if (!fieldErrors) return;
    var order = ["sessionLabel", "rating", "whatWentWell", "whatCouldImprove"];
    var firstKey = null;
    order.forEach(function (k) {
      if (!fieldErrors[k]) return;
      var el = document.getElementById("err-" + k);
      if (el) {
        el.textContent = fieldErrors[k];
        el.hidden = false;
      }
      if (!firstKey) firstKey = k;
    });
    if (firstKey === "rating") {
      var fs = document.getElementById("rating-fieldset");
      if (fs) fs.querySelector("input") && fs.querySelector("input").focus();
    } else if (firstKey) {
      var focusEl = document.getElementById(firstKey);
      if (focusEl) focusEl.focus();
    }
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
    if (v === "yes") return "Recommend: yes";
    if (v === "no") return "Recommend: no";
    return "Recommend: skip / not stated";
  }

  function friendlyTime(iso) {
    if (!iso) return "—";
    var t = Date.parse(iso);
    if (!t) return iso;
    var sec = Math.round((Date.now() - t) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return Math.floor(sec / 60) + "m ago";
    if (sec < 86400) return Math.floor(sec / 3600) + "h ago";
    if (sec < 86400 * 7) return Math.floor(sec / 86400) + "d ago";
    try {
      return new Date(t).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  function showSaved(entry) {
    lastEntry = entry;
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

  function setTab(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-tab") === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    panelStudent.hidden = name !== "student";
    panelStaff.hidden = name !== "staff";
    if (name === "staff" && staffBoard && !staffBoard.hidden) refreshBoard();
  }

  function renderMetrics(m) {
    var el = document.getElementById("metrics");
    if (!el) return;
    if (!m) {
      el.innerHTML = '<p class="empty">No metrics yet.</p>';
      return;
    }
    var hist = m.ratingHistogram || {};
    var rec = m.recommend || {};
    var sub = m.subjectMix || {};
    var total = m.totalSubmissions || 0;
    function bar(n) {
      var count = hist[n] || 0;
      var pct = total ? Math.round((count / total) * 100) : 0;
      return (
        '<div class="bar-row"><span class="bar-label">' + n + '★</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="bar-count">' + count + '</span></div>'
      );
    }
    el.innerHTML =
      '<div class="metric-grid">' +
      '<div class="metric"><span class="metric-label">Submissions</span><span class="metric-value">' + escapeHtml(String(total)) + '</span></div>' +
      '<div class="metric"><span class="metric-label">Avg rating</span><span class="metric-value">' + escapeHtml(m.avgRating == null ? "—" : String(m.avgRating)) + '</span></div>' +
      '<div class="metric"><span class="metric-label">Last submit</span><span class="metric-value metric-small">' + escapeHtml(friendlyTime(m.lastSubmitAt)) + '</span></div>' +
      '</div>' +
      '<div class="rating-bars">' + [5,4,3,2,1].map(bar).join("") + '</div>' +
      '<div class="metric-row"><strong>Recommend:</strong> yes ' + (rec.yes || 0) + ' · no ' + (rec.no || 0) + ' · skip / not stated ' + (rec.skip || 0) + '</div>' +
      '<div class="metric-row"><strong>Subjects:</strong> Math ' + (sub.Math || 0) + ' · Science ' + (sub.Science || 0) + ' · Writing ' + (sub.Writing || 0) + ' · Test prep ' + (sub["Test prep"] || 0) + ' · Other ' + (sub.Other || 0) + '</div>' +
      '<details class="ops-metrics"><summary>Ops metrics</summary>' +
      '<div class="metric-row">Soft PII rejects: ' + (m.softPiiRejects || 0) + '</div>' +
      '<div class="metric-row">Staff sign-ins: ' + (m.staffSignins || 0) + '</div>' +
      '<div class="metric-row">Staff cookie TTL: ' + (m.staffCookieTtlSeconds || 3600) + 's</div>' +
      '</details>';
  }

  async function refreshBoard() {
    if (!list) return;
    try {
      const res = await fetch("/api/feedback", { credentials: "same-origin" });
      if (res.status === 401) {
        list.innerHTML = "";
        var metrics = document.getElementById("metrics");
        if (metrics) metrics.innerHTML = "";
        if (staffGate) staffGate.hidden = false;
        if (staffBoard) staffBoard.hidden = true;
        return;
      }
      const data = await res.json();
      renderMetrics(data.metrics);
      if (!data.items || !data.items.length) {
        list.innerHTML = '<p class="empty">No submissions yet — metrics will fill as students submit synthetic feedback.</p>';
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
            escapeHtml(item.subject || "Other") +
            " · " +
            escapeHtml(friendlyTime(item.createdAt)) +
            "</div>" +
            "</article>"
          );
        })
        .join("");
    } catch (e) {
      list.innerHTML = '<p class="empty">Couldn’t load the staff board — try again in a moment.</p>';
    }
  }

  function clearOneFieldError(id) {
    var el = document.getElementById("err-" + id);
    if (el) { el.hidden = true; el.textContent = ""; }
    maybeClearStatusSummary();
  }

  function maybeClearStatusSummary() {
    var ids = ["sessionLabel", "rating", "whatWentWell", "whatCouldImprove"];
    var anyVisible = ids.some(function (id) {
      var el = document.getElementById("err-" + id);
      return el && !el.hidden && el.textContent;
    });
    if (!anyVisible && status && status.textContent.indexOf("Please fix") === 0) {
      status.textContent = "";
    }
  }

  // Clear field errors as the student fixes them (StudentBot feedback).
  var sessionInput = document.getElementById("sessionLabel");
  if (sessionInput) {
    sessionInput.addEventListener("input", function () { clearOneFieldError("sessionLabel"); });
  }
  document.querySelectorAll('input[name="rating"]').forEach(function (r) {
    r.addEventListener("change", function () { clearOneFieldError("rating"); });
  });
  ["whatWentWell", "whatCouldImprove"].forEach(function (id) {
    var ta = document.getElementById(id);
    if (!ta) return;
    ta.addEventListener("input", function () { clearOneFieldError(id); });
  });


  // Subject chips
  document.querySelectorAll("#subject-chips .chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var input = document.getElementById("sessionLabel");
      if (!input) return;
      var label = chip.getAttribute("data-chip") || chip.textContent;
      input.value = label + " session";
      clearOneFieldError("sessionLabel");
      input.focus();
    });
  });

  function bindCount(id, suffix) {
    var ta = document.getElementById(id);
    var out = document.getElementById(id + "-count");
    if (!ta || !out) return;
    function sync() {
      out.textContent = ta.value.length + " / 1000" + (suffix || "");
    }
    ta.addEventListener("input", sync);
    sync();
  }
  bindCount("whatWentWell", "");
  bindCount("whatCouldImprove", " · short is fine");


    form.addEventListener("submit", async function (e) {
    e.preventDefault();
    status.textContent = "Submitting…";
    clearFieldErrors();
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
        if (data.fieldErrors) showFieldErrors(data.fieldErrors);
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
    } catch (err) {
      status.textContent = "Couldn’t reach the server — check your connection or try again in a moment.";
    }
  });

  if (submitAnother) {
    submitAnother.addEventListener("click", async function () {
      savedPanel.hidden = true;
      form.hidden = false;
      form.reset();
      lastEntry = null;
      var skip = form.querySelector('input[name="wouldRecommend"][value="skip"]');
      if (skip) skip.checked = true;
      await refreshCsrf();
      status.textContent = "";
    });
  }

  var editSaved = document.getElementById("edit-saved");
  if (editSaved) {
    editSaved.addEventListener("click", async function () {
      if (!lastEntry) return;
      savedPanel.hidden = true;
      form.hidden = false;
      document.getElementById("sessionLabel").value = lastEntry.sessionLabel || "";
      document.getElementById("whatWentWell").value = lastEntry.whatWentWell || "";
      document.getElementById("whatCouldImprove").value = lastEntry.whatCouldImprove || "";
      var rating = String(lastEntry.rating || "");
      var radio = form.querySelector('input[name="rating"][value="' + rating + '"]');
      if (radio) radio.checked = true;
      var rec = lastEntry.wouldRecommend || "skip";
      var recEl = form.querySelector('input[name="wouldRecommend"][value="' + rec + '"]');
      if (recEl) recEl.checked = true;
      document.getElementById("whatWentWell").dispatchEvent(new Event("input"));
      document.getElementById("whatCouldImprove").dispatchEvent(new Event("input"));
      await refreshCsrf();
      status.textContent = "Edit and submit again to replace this draft locally.";
      document.getElementById("sessionLabel").focus();
    });
  }

  var copyReceipt = document.getElementById("copy-receipt");
  if (copyReceipt) {
    copyReceipt.addEventListener("click", async function () {
      if (!lastEntry) return;
      var text = "Nerdy Tutors feedback receipt (demo)\nSession: " + lastEntry.sessionLabel + "\nRating: " + lastEntry.rating + "/5";
      try {
        await navigator.clipboard.writeText(text);
        copyReceipt.textContent = "Copied";
        setTimeout(function () { copyReceipt.textContent = "Copy receipt"; }, 1500);
      } catch (e) {
        status.textContent = "Couldn’t copy — select and copy manually.";
      }
    });
  }


  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      setTab(t.getAttribute("data-tab"));
    });
  });

  function staffCsrf() {
    var el = document.getElementById("staff-csrf");
    return el ? el.value : "";
  }

  function setStaffCsrf(token) {
    var el = document.getElementById("staff-csrf");
    if (el && token) el.value = token;
    if (token) setCsrf(token);
  }

  if (staffForm) {
    staffForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      staffStatus.textContent = "Checking…";
      var username = document.getElementById("staff-username").value;
      try {
        const res = await fetch("/api/staff/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ username: username, _csrf: staffCsrf() }),
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          staffStatus.textContent = data.error || "Sign-in failed.";
          if (data.csrf) setStaffCsrf(data.csrf);
          else if (res.status === 403) {
            var c = await fetch("/api/csrf", { credentials: "same-origin" }).then(function (r) { return r.json(); });
            setStaffCsrf(c.csrf);
          }
          return;
        }
        staffStatus.textContent = "";
        if (data.csrf) setStaffCsrf(data.csrf);
        if (staffWho) staffWho.textContent = data.label || "Staff session";
        staffGate.hidden = true;
        staffBoard.hidden = false;
        await refreshBoard();
      } catch (err) {
        staffStatus.textContent = "Network error.";
      }
    });
  }

  if (staffSignout) {
    staffSignout.addEventListener("click", async function () {
      await fetch("/api/staff/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ _csrf: staffCsrf() }),
      }).then(async function (res) {
        var data = await res.json().catch(function () { return {}; });
        if (data.csrf) setStaffCsrf(data.csrf);
      });
      staffBoard.hidden = true;
      staffGate.hidden = false;
      list.innerHTML = "";
    });
  }
})();
