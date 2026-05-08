// frontend/assets/js/pages/home.js
window.PageHome = {
  async render(area, user) {
    area.innerHTML = `
      <div style="display:flex;gap:20px;max-width:1100px;margin:0 auto">
        <!-- Feed Column -->
        <div style="flex:1;min-width:0">
          <!-- Create Post -->
          <div class="card create-post" id="create-post-card">
            <div class="create-post-row">
              ${avatarHtml(user, 40)}
              <textarea id="post-textarea" placeholder="What's on your mind, ${user.first_name}? 🐢" style="flex:1"></textarea>
            </div>
            <div class="create-post-actions">
              <label class="btn btn-ghost btn-sm" style="cursor:pointer">
                🖼️ Photo
                <input type="file" id="post-image-input" accept="image/*" style="display:none" />
              </label>
              <span id="image-preview-label" style="font-size:12px;color:var(--text-muted)"></span>
              <button class="btn btn-primary btn-sm" style="margin-left:auto" id="post-submit-btn">Post</button>
            </div>
            <div id="post-image-preview" style="margin-top:8px"></div>
          </div>

          <!-- Feed -->
          <div id="feed-list"><div class="spinner"></div></div>
        </div>

        <!-- Right Column: Find People -->
        <div style="width:280px;flex-shrink:0">
          <div class="card" style="padding:18px;margin-bottom:14px">
            <div style="font-weight:700;font-size:15px;margin-bottom:12px">🔍 Find People</div>
            <input type="text" id="user-search-input" placeholder="Search users..." style="margin-bottom:10px" />
            <div id="user-search-results"></div>
          </div>
          <div class="card" style="padding:18px">
            <div style="font-weight:700;font-size:15px;margin-bottom:12px">👥 People You May Know</div>
            <div id="suggestions-list"><div class="spinner" style="width:20px;height:20px;margin:8px auto"></div></div>
          </div>
        </div>
      </div>`;

    let postImageBase64 = null;

    // Image pick
    document.getElementById("post-image-input").addEventListener("change", function() {
      const file = this.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast("Image must be under 5MB.", "error"); return; }
      const reader = new FileReader();
      reader.onload = e => {
        postImageBase64 = e.target.result;
        document.getElementById("image-preview-label").textContent = file.name;
        document.getElementById("post-image-preview").innerHTML =
          `<img src="${postImageBase64}" style="max-height:200px;border-radius:10px;width:100%;object-fit:cover">`;
      };
      reader.readAsDataURL(file);
    });

    // Submit post
    document.getElementById("post-submit-btn").addEventListener("click", async () => {
      const content = document.getElementById("post-textarea").value.trim();
      if (!content && !postImageBase64) { toast("Write something first!", "error"); return; }
      const btn = document.getElementById("post-submit-btn");
      btn.disabled = true; btn.textContent = "Posting...";
      try {
        await OogwayAPI.Posts.create({ content, image_base64: postImageBase64 });
        document.getElementById("post-textarea").value = "";
        document.getElementById("post-image-preview").innerHTML = "";
        document.getElementById("image-preview-label").textContent = "";
        postImageBase64 = null;
        toast("Posted! 🐢", "success");
        await loadFeed();
      } catch(e) { toast("Failed to post. Try again.", "error"); }
      finally { btn.disabled = false; btn.textContent = "Post"; }
    });

    // Load feed
    await loadFeed();

    // User search
    let searchTimeout;
    document.getElementById("user-search-input").addEventListener("input", function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => searchUsers(this.value.trim()), 350);
    });

    // Suggestions
    loadSuggestions();
  }
};

async function loadFeed() {
  const list = document.getElementById("feed-list");
  if (!list) return;
  list.innerHTML = '<div class="spinner"></div>';
  try {
    const { posts } = await OogwayAPI.Posts.feed();
    if (!posts.length) {
      list.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:48px 0">
        <div style="font-size:48px">🐢</div>
        <div style="margin-top:12px;font-weight:600">Your feed is empty!</div>
        <div style="font-size:13px;margin-top:6px">Follow some users to see their posts here.</div>
      </div>`;
      return;
    }
    list.innerHTML = posts.map(p => renderPost(p)).join("");
    attachPostListeners(list);
  } catch(e) {
    list.innerHTML = '<p style="color:#ef4444;padding:16px">Failed to load feed.</p>';
  }
}

function renderPost(p) {
  const me = window.CURRENT_USER;
  const initials = (p.first_name[0] + p.last_name[0]).toUpperCase();
  return `
    <div class="card post-card" data-post-id="${p.post_id}">
      <div class="post-header">
        <div class="post-avatar">${p.avatar_base64 ? `<img src="${p.avatar_base64}">` : initials}</div>
        <div class="post-meta">
          <div class="name" onclick="navigateTo('profile',{user_id:${p.user_id}})">${p.first_name} ${p.last_name} <span style="color:var(--text-muted);font-weight:400">@${p.username}</span></div>
          <div class="time">${timeAgo(p.created_at)}</div>
        </div>
        ${me.user_id === p.user_id ? `<button class="btn btn-ghost btn-sm delete-post-btn" data-id="${p.post_id}" style="margin-left:auto">🗑️</button>` : ""}
      </div>
      ${p.content ? `<div class="post-content">${escHtml(p.content)}</div>` : ""}
      ${p.image_base64 ? `<img class="post-image" src="${p.image_base64}" alt="post image" onclick="openLightbox(this.src)" />` : ""}
      <div class="post-actions">
        <button class="post-action-btn like-btn ${p.user_liked ? "liked" : ""}" data-id="${p.post_id}" data-liked="${p.user_liked}">
          ${p.user_liked ? "❤️" : "🤍"} <span class="like-count">${p.like_count}</span>
        </button>
        <button class="post-action-btn comment-btn" data-id="${p.post_id}">
          💬 <span>${p.comment_count}</span>
        </button>
      </div>
    </div>`;
}

function attachPostListeners(container) {
  // Likes
  container.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", async function() {
      const postId = parseInt(this.dataset.id);
      try {
        const { liked } = await OogwayAPI.Posts.like(postId);
        this.classList.toggle("liked", liked);
        this.dataset.liked = liked ? "1" : "0";
        const countEl = this.querySelector(".like-count");
        countEl.textContent = parseInt(countEl.textContent) + (liked ? 1 : -1);
        this.innerHTML = (liked ? "❤️" : "🤍") + ` <span class="like-count">${countEl.textContent}</span>`;
      } catch(e) { toast("Action failed.", "error"); }
    });
  });
  // Comments
  container.querySelectorAll(".comment-btn").forEach(btn => {
    btn.addEventListener("click", function() { openComments(parseInt(this.dataset.id)); });
  });
  // Delete
  container.querySelectorAll(".delete-post-btn").forEach(btn => {
    btn.addEventListener("click", async function() {
      if (!confirm("Delete this post?")) return;
      try {
        await OogwayAPI.Posts.delete(parseInt(this.dataset.id));
        toast("Post deleted.", "success");
        await loadFeed();
      } catch(e) { toast("Failed to delete.", "error"); }
    });
  });
}

window.openLightbox = function(src) {
  const lb = document.createElement("div");
  lb.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9000;display:flex;align-items:center;justify-content:center;cursor:zoom-out";
  lb.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:12px">`;
  lb.addEventListener("click", () => lb.remove());
  document.body.appendChild(lb);
};

async function searchUsers(q) {
  const results = document.getElementById("user-search-results");
  if (!results) return;
  if (!q) { results.innerHTML = ""; return; }
  results.innerHTML = '<div class="spinner" style="width:18px;height:18px;margin:6px auto"></div>';
  try {
    const { users } = await OogwayAPI.Users.search(q);
    if (!users.length) { results.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:6px">No users found.</p>'; return; }
    results.innerHTML = users.map(u => userCardHtml(u)).join("");
    attachFollowBtns(results);
  } catch(e) { results.innerHTML = ""; }
}

async function loadSuggestions() {
  const list = document.getElementById("suggestions-list");
  if (!list) return;
  try {
    const { users } = await OogwayAPI.Users.suggestions();
    if (!users.length) { list.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No suggestions yet.</p>'; return; }
    list.innerHTML = users.slice(0, 5).map(u => userCardHtml(u)).join("");
    attachFollowBtns(list);
  } catch(e) { list.innerHTML = ""; }
}

function userCardHtml(u) {
  const initials = (u.first_name[0] + u.last_name[0]).toUpperCase();
  return `<div class="user-card" data-uid="${u.user_id}">
    <div class="avatar" style="width:36px;height:36px;font-size:13px;border:2px solid var(--accent1);cursor:pointer" onclick="navigateTo('profile',{user_id:${u.user_id}})">
      ${u.avatar_base64 ? `<img src="${u.avatar_base64}">` : initials}
    </div>
    <div class="user-card-info">
      <div class="user-card-name" style="cursor:pointer" onclick="navigateTo('profile',{user_id:${u.user_id}})">${u.first_name} ${u.last_name}</div>
      <div class="user-card-handle">@${u.username}</div>
    </div>
    <button class="btn btn-sm follow-btn ${u.is_following ? "btn-ghost" : "btn-primary"}" data-id="${u.user_id}" data-following="${u.is_following ? 1 : 0}">
      ${u.is_following ? "Following" : "Follow"}
    </button>
  </div>`;
}

function attachFollowBtns(container) {
  container.querySelectorAll(".follow-btn").forEach(btn => {
    btn.addEventListener("click", async function() {
      const tid = parseInt(this.dataset.id);
      const isFollowing = this.dataset.following === "1";
      try {
        const { following } = await OogwayAPI.Users.follow(tid);
        this.dataset.following = following ? "1" : "0";
        this.textContent = following ? "Following" : "Follow";
        this.className = `btn btn-sm follow-btn ${following ? "btn-ghost" : "btn-primary"}`;
      } catch(e) { toast("Action failed.", "error"); }
    });
  });
}