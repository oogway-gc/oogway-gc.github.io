window.PageMessages = {
  activeConvId: null,
  pollInterval: null,

  async render(area, user) {
    const self = this;
    if (self.pollInterval) clearInterval(self.pollInterval);

    area.innerHTML = `
      <div class="card" style="height:calc(100vh - 120px);overflow:hidden">
        <div class="chat-layout" style="height:100%">
          <!-- Conversation List -->
          <div class="chat-list">
            <div style="padding:12px 14px;border-bottom:1.5px solid var(--border)">
              <div style="font-weight:700;font-size:15px;margin-bottom:8px">Messages</div>
              <input type="text" id="new-msg-search" placeholder="New message..." style="font-size:13px;padding:8px 12px" />
              <div id="new-msg-results" style="margin-top:6px"></div>
            </div>
            <div id="conv-list"><div class="spinner" style="margin:16px auto"></div></div>
          </div>

          <!-- Chat Area -->
          <div class="chat-area" id="chat-area">
            <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">
              <div style="text-align:center">
                <div style="font-size:48px">💬</div>
                <div style="margin-top:12px;font-weight:600">Select a conversation</div>
                <div style="font-size:13px">Or search for someone to message.</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    await loadConversations();

    // Search for new message recipient
    let searchTimeout;
    document.getElementById("new-msg-search").addEventListener("input", function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const q = this.value.trim();
        const resultsEl = document.getElementById("new-msg-results");
        if (!q) { resultsEl.innerHTML = ""; return; }
        try {
          const { users } = await OogwayAPI.Users.search(q);
          resultsEl.innerHTML = users.slice(0, 5).map(u => `
            <div class="chat-item" data-uid="${u.user_id}" style="border-radius:10px;cursor:pointer">
              <div class="avatar" style="width:30px;height:30px;font-size:11px">
                ${u.avatar_base64 ? `<img src="${u.avatar_base64}">` : (u.first_name[0]+u.last_name[0]).toUpperCase()}
              </div>
              <div>${u.first_name} ${u.last_name}</div>
            </div>`).join("");
          resultsEl.querySelectorAll("[data-uid]").forEach(el => {
            el.addEventListener("click", function() {
              document.getElementById("new-msg-search").value = "";
              resultsEl.innerHTML = "";
              openChat(parseInt(this.dataset.uid));
            });
          });
        } catch(e) {}
      }, 350);
    });

    async function loadConversations() {
      const list = document.getElementById("conv-list");
      if (!list) return;
      try {
        const { conversations } = await OogwayAPI.Messages.conversations();
        if (!conversations.length) {
          list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:16px">No conversations yet.</p>';
          return;
        }
        list.innerHTML = conversations.map(c => `
          <div class="chat-item ${self.activeConvId === c.other_user_id ? "active" : ""}" data-uid="${c.other_user_id}">
            <div class="avatar" style="width:38px;height:38px;font-size:13px;flex-shrink:0">
              ${c.avatar_base64 ? `<img src="${c.avatar_base64}">` : (c.first_name[0]+c.last_name[0]).toUpperCase()}
            </div>
            <div class="chat-item-info">
              <div class="chat-item-name">${escHtml(c.first_name)} ${escHtml(c.last_name)}</div>
              <div class="chat-item-preview">${escHtml(c.last_message || "")}</div>
            </div>
            ${c.unread_count > 0 ? `<span style="background:var(--accent2);color:#fff;border-radius:99px;font-size:10px;font-weight:700;padding:2px 7px">${c.unread_count}</span>` : ""}
          </div>`).join("");
        list.querySelectorAll(".chat-item").forEach(el => {
          el.addEventListener("click", function() { openChat(parseInt(this.dataset.uid)); });
        });
      } catch(e) {}
    }

    async function openChat(uid) {
      self.activeConvId = uid;
      if (self.pollInterval) clearInterval(self.pollInterval);

      // Fetch user info
      let chatUser;
      try { const d = await OogwayAPI.Users.profile(uid); chatUser = d.user; } catch(e) { return; }

      const initials = (chatUser.first_name[0]+chatUser.last_name[0]).toUpperCase();
      const chatArea = document.getElementById("chat-area");
      chatArea.innerHTML = `
        <div style="padding:12px 16px;border-bottom:1.5px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0">
          <div class="avatar" style="width:36px;height:36px;font-size:13px">
            ${chatUser.avatar_base64 ? `<img src="${chatUser.avatar_base64}">` : initials}
          </div>
          <div>
            <div style="font-weight:700;font-size:14.5px;cursor:pointer" onclick="navigateTo('profile',{user_id:${uid}})">${escHtml(chatUser.first_name)} ${escHtml(chatUser.last_name)}</div>
            <div style="font-size:12px;color:var(--text-muted)">@${escHtml(chatUser.username)}</div>
          </div>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" placeholder="Type a message..." />
          <button class="btn btn-primary btn-sm" id="chat-send-btn">Send</button>
        </div>`;

      await loadMessages(uid);

      document.getElementById("chat-send-btn").addEventListener("click", () => sendMessage(uid));
      document.getElementById("chat-input").addEventListener("keydown", e => {
        if (e.key === "Enter") sendMessage(uid);
      });

      // Poll for new messages
      self.pollInterval = setInterval(() => loadMessages(uid), 5000);

      // Highlight active conv
      document.querySelectorAll(".chat-item").forEach(el => {
        el.classList.toggle("active", parseInt(el.dataset.uid) === uid);
      });
    }

    async function loadMessages(uid) {
      const container = document.getElementById("chat-messages");
      if (!container) return;
      const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      try {
        const { messages } = await OogwayAPI.Messages.thread(uid);
        const me = window.CURRENT_USER;
        container.innerHTML = messages.map(m => {
          const isMine = m.sender_id === me.user_id;
          return `<div style="display:flex;flex-direction:column;align-items:${isMine ? "flex-end" : "flex-start"}">
            <div class="chat-bubble ${isMine ? "mine" : "theirs"}">${escHtml(m.content)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;padding:0 4px">${timeAgo(m.created_at)}</div>
          </div>`;
        }).join("");
        if (wasAtBottom || messages.length < 5) {
          container.scrollTop = container.scrollHeight;
        }
      } catch(e) {}
      await loadConversations();
    }

    async function sendMessage(uid) {
      const input = document.getElementById("chat-input");
      const content = input.value.trim();
      if (!content) return;
      input.value = "";
      try {
        await OogwayAPI.Messages.send({ receiver_id: uid, content });
        await loadMessages(uid);
      } catch(e) { toast("Failed to send message.", "error"); }
    }
  }
};