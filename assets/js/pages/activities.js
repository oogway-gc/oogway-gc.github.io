window.PageActivities = {
  currentDate: new Date(),

  async render(area, user) {
    const self = this;
    self.currentDate = new Date();

    area.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
          <h2 style="font-size:22px;font-weight:800">📅 Activities</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select id="filter-user" style="width:auto;min-width:130px">
              <option value="">All Users</option>
              <option value="${user.user_id}">My Events</option>
            </select>
            <input type="text" id="filter-cat" placeholder="Filter by category" style="width:auto;min-width:150px" />
            <button class="btn btn-primary btn-sm" id="add-event-btn">+ Add Event</button>
          </div>
        </div>

        <!-- Calendar header -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <button class="btn btn-ghost btn-sm" id="cal-prev">‹ Prev</button>
            <span id="cal-month-label" style="font-weight:700;font-size:16px"></span>
            <button class="btn btn-ghost btn-sm" id="cal-next">Next ›</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px">
            ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => `<div style="text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);padding:4px">${d}</div>`).join("")}
          </div>
          <div class="calendar-grid" id="calendar-grid"></div>
        </div>

        <!-- Events List -->
        <div class="card" style="padding:18px">
          <div style="font-weight:700;font-size:15px;margin-bottom:12px">Upcoming Events</div>
          <div id="events-list"><div class="spinner"></div></div>
        </div>
      </div>

      <!-- Add Event Modal -->
      <div class="modal-overlay" id="add-event-modal">
        <div class="modal-box">
          <div class="modal-title">Add Event</div>
          <div class="form-group"><label>Title</label><input type="text" id="ev-title" placeholder="Event title" /></div>
          <div class="form-group"><label>Description</label><textarea id="ev-desc" placeholder="Optional description" style="min-height:60px"></textarea></div>
          <div class="form-group"><label>Category</label><input type="text" id="ev-cat" placeholder="e.g. Work, Personal, Health" /></div>
          <div style="display:flex;gap:10px">
            <div class="form-group" style="flex:1"><label>Start Date & Time</label><input type="datetime-local" id="ev-start" /></div>
            <div class="form-group" style="flex:1"><label>End Date & Time</label><input type="datetime-local" id="ev-end" /></div>
          </div>
          <div class="form-group"><label>Color</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap" id="color-picker">
              ${["#7c3aed","#e91e8c","#2563eb","#22c55e","#f59e0b","#ef4444","#06b6d4","#64748b"].map(c =>
                `<div class="color-dot" data-color="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:2px solid transparent;transition:border-color 0.15s" title="${c}"></div>`
              ).join("")}
            </div>
          </div>
          <div id="ev-error" style="color:#ef4444;font-size:13px;display:none;margin-bottom:8px"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-ghost" onclick="document.getElementById('add-event-modal').classList.remove('open')">Cancel</button>
            <button class="btn btn-primary" id="save-event-btn">Save Event</button>
          </div>
        </div>
      </div>`;

    let selectedColor = "#7c3aed";
    let events = [];

    // Color picker
    area.querySelectorAll(".color-dot").forEach(dot => {
      dot.addEventListener("click", function() {
        area.querySelectorAll(".color-dot").forEach(d => d.style.borderColor = "transparent");
        this.style.borderColor = "#fff";
        selectedColor = this.dataset.color;
      });
    });
    area.querySelector('.color-dot').style.borderColor = "#fff";

    // Nav
    document.getElementById("cal-prev").addEventListener("click", () => {
      self.currentDate.setMonth(self.currentDate.getMonth() - 1);
      renderCalendar(events);
    });
    document.getElementById("cal-next").addEventListener("click", () => {
      self.currentDate.setMonth(self.currentDate.getMonth() + 1);
      renderCalendar(events);
    });

    document.getElementById("add-event-btn").addEventListener("click", () => {
      document.getElementById("add-event-modal").classList.add("open");
    });
    document.getElementById("add-event-modal").addEventListener("click", e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
    });

    // Filters
    let filterTimeout;
    function applyFilters() {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(() => loadEvents(), 400);
    }
    document.getElementById("filter-user").addEventListener("change", applyFilters);
    document.getElementById("filter-cat").addEventListener("input", applyFilters);

    // Save event
    document.getElementById("save-event-btn").addEventListener("click", async () => {
      const title = document.getElementById("ev-title").value.trim();
      const description = document.getElementById("ev-desc").value.trim();
      const category = document.getElementById("ev-cat").value.trim();
      const start_date = document.getElementById("ev-start").value;
      const end_date = document.getElementById("ev-end").value;
      const errEl = document.getElementById("ev-error");
      errEl.style.display = "none";
      if (!title || !start_date) { errEl.textContent = "Title and start date are required."; errEl.style.display = "block"; return; }
      const btn = document.getElementById("save-event-btn");
      btn.disabled = true; btn.textContent = "Saving...";
      try {
        await OogwayAPI.Events.create({ title, description, category, start_date, end_date: end_date || null, color: selectedColor });
        document.getElementById("add-event-modal").classList.remove("open");
        ["ev-title","ev-desc","ev-cat","ev-start","ev-end"].forEach(id => document.getElementById(id).value = "");
        toast("Event added! 📅", "success");
        await loadEvents();
      } catch(e) { errEl.textContent = "Failed to save event."; errEl.style.display = "block"; }
      finally { btn.disabled = false; btn.textContent = "Save Event"; }
    });

    async function loadEvents() {
      const params = {};
      const uid = document.getElementById("filter-user").value;
      const cat = document.getElementById("filter-cat").value.trim();
      if (uid) params.user_id = uid;
      if (cat) params.category = cat;
      try {
        const data = await OogwayAPI.Events.list(params);
        events = data.events || [];
        renderCalendar(events);
        renderEventList(events);
      } catch(e) { document.getElementById("events-list").innerHTML = '<p style="color:#ef4444">Failed to load events.</p>'; }
    }

    function renderCalendar(evts) {
      const d = self.currentDate;
      const y = d.getFullYear(), m = d.getMonth();
      document.getElementById("cal-month-label").textContent =
        d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const today = new Date();

      let html = "";
      for (let i = 0; i < firstDay; i++) html += '<div></div>';
      for (let day = 1; day <= daysInMonth; day++) {
        const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
        const dayEvts = evts.filter(e => {
          const ed = new Date(e.start_date);
          return ed.getFullYear() === y && ed.getMonth() === m && ed.getDate() === day;
        });
        html += `<div class="calendar-day${isToday ? " today" : ""}">
          <div class="calendar-day-num">${day}</div>
          ${dayEvts.slice(0, 3).map(e => `<div class="event-pill" style="background:${e.color||"#7c3aed"}">${escHtml(e.title)}</div>`).join("")}
          ${dayEvts.length > 3 ? `<div style="font-size:10px;color:var(--text-muted)">+${dayEvts.length-3} more</div>` : ""}
        </div>`;
      }
      document.getElementById("calendar-grid").innerHTML = html;
    }

    function renderEventList(evts) {
      const list = document.getElementById("events-list");
      if (!evts.length) { list.innerHTML = '<p style="color:var(--text-muted)">No events found.</p>'; return; }
      const upcoming = evts.filter(e => new Date(e.start_date) >= new Date()).slice(0, 20);
      if (!upcoming.length) { list.innerHTML = '<p style="color:var(--text-muted)">No upcoming events.</p>'; return; }
      list.innerHTML = upcoming.map(e => `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:10px;border-radius:12px;border-left:4px solid ${e.color||"#7c3aed"};background:var(--surface2);margin-bottom:8px">
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${escHtml(e.title)}</div>
            ${e.description ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(e.description)}</div>` : ""}
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
              📅 ${new Date(e.start_date).toLocaleString()}
              ${e.category ? ` · 🏷️ ${escHtml(e.category)}` : ""}
              · 👤 ${escHtml(e.first_name)} ${escHtml(e.last_name)}
            </div>
          </div>
          ${e.user_id === window.CURRENT_USER.user_id ? `<button class="btn btn-sm btn-danger delete-event-btn" data-id="${e.event_id}">🗑️</button>` : ""}
        </div>`).join("");

      list.querySelectorAll(".delete-event-btn").forEach(btn => {
        btn.addEventListener("click", async function() {
          if (!confirm("Delete event?")) return;
          try {
            await OogwayAPI.Events.delete(parseInt(this.dataset.id));
            toast("Event deleted.", "success");
            await loadEvents();
          } catch(e) { toast("Failed to delete.", "error"); }
        });
      });
    }

    await loadEvents();
  }
};