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
    if (v === "yes") return "Would recommend: yes";
    if (v === "no") return "Would recommend: no";
    return "Would recommend: not stated";
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

  async function refreshBoard() {
    if (!list) return;
    try {
      const res = await fetch("/api/feedback", { credentials: "same-origin" });
      if (res.status === 401) {
        list.innerHTML = "";
        if (staffGate) staffGate.hidden = false;
        if (staffBoard) staffBoard.hidden = true;
        return;
      }
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
        if (staffWho) staffWho.textContent = data.username;
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
