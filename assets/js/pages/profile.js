window.PageProfile = {
  async render(area, currentUser, params) {
    const userId = (params && params.user_id) ? params.user_id : currentUser.user_id;
    const isOwnProfile = userId === currentUser.user_id;
    area.innerHTML = '<div class="spinner"></div>';

    let profile, posts;
    try {
      [{ user: profile }, { posts }] = await Promise.all([
        OogwayAPI.Users.profile(userId),
        OogwayAPI.Posts.userPosts(userId)
      ]);
    } catch(e) {
      area.innerHTML = '<p style="color:#ef4444;padding:24px">Failed to load profile.</p>';
      return;
    }

    const initials = (profile.first_name[0] + profile.last_name[0]).toUpperCase();

    area.innerHTML = `
      <div style="max-width:700px;margin:0 auto">
        <!-- Profile Card -->
        <div class="card" style="margin-bottom:16px">
          <div class="profile-hero">
            <div class="avatar avatar-xl" style="border:3px solid var(--accent1);font-size:36px" id="profile-avatar-el">
              ${profile.avatar_base64 ? `<img src="${profile.avatar_base64}" id="profile-avatar-img">` : initials}
            </div>
            <div style="flex:1">
              <div style="font-size:22px;font-weight:800">${escHtml(profile.first_name)} ${escHtml(profile.last_name)}</div>
              <div style="color:var(--text-muted);font-size:14px">@${escHtml(profile.username)}</div>
              ${profile.bio ? `<div style="margin-top:8px;font-size:14px;line-height:1.5">${escHtml(profile.bio)}</div>` : ""}
              <div class="profile-stats">
                <div class="profile-stat"><div class="num">${posts.length}</div><div class="label">Posts</div></div>
                <div class="profile-stat"><div class="num">${profile.followers_count}</div><div class="label">Followers</div></div>
                <div class="profile-stat"><div class="num">${profile.following_count}</div><div class="label">Following</div></div>
              </div>
              <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
                ${isOwnProfile
                  ? `<button class="btn btn-outline btn-sm" id="edit-profile-btn">✏️ Edit Profile</button>
                     <label class="btn btn-ghost btn-sm" style="cursor:pointer">
                       📷 Change Avatar
                       <input type="file" id="avatar-upload" accept="image/*" style="display:none" />
                     </label>`
                  : `<button class="btn btn-sm ${profile.is_following ? "btn-ghost" : "btn-primary"}" id="follow-btn" data-id="${profile.user_id}" data-following="${profile.is_following ? 1 : 0}">
                       ${profile.is_following ? "Following" : "Follow"}
                     </button>
                     <button class="btn btn-outline btn-sm" onclick="navigateTo('messages')">💬 Message</button>`}
              </div>
            </div>
          </div>
        </div>

        <!-- Posts -->
        <div style="font-weight:700;font-size:16px;margin-bottom:12px">Posts</div>
        <div id="profile-posts">
          ${!posts.length
            ? `<div style="text-align:center;color:var(--text-muted);padding:40px 0"><div style="font-size:40px">🐢</div><div style="margin-top:10px">No posts yet.</div></div>`
            : posts.map(p => renderProfilePost(p, isOwnProfile)).join("")}
        </div>
      </div>

      <!-- Edit Profile Modal -->
      <div class="modal-overlay" id="edit-profile-modal">
        <div class="modal-box">
          <div class="modal-title">Edit Profile</div>
          <div class="form-group"><label>Bio</label><textarea id="edit-bio" style="min-height:80px">${escHtml(profile.bio || "")}</textarea></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
            <button class="btn btn-ghost" onclick="document.getElementById('edit-profile-modal').classList.remove('open')">Cancel</button>
            <button class="btn btn-primary" id="save-profile-btn">Save</button>
          </div>
        </div>
      </div>`;

    // Edit profile
    if (isOwnProfile) {
      document.getElementById("edit-profile-btn")?.addEventListener("click", () => {
        document.getElementById("edit-profile-modal").classList.add("open");
      });
      document.getElementById("edit-profile-modal").addEventListener("click", e => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
      });
      document.getElementById("save-profile-btn").addEventListener("click", async () => {
        const bio = document.getElementById("edit-bio").value.trim();
        const btn = document.getElementById("save-profile-btn");
        btn.disabled = true; btn.textContent = "Saving...";
        try {
          await OogwayAPI.Users.updateProfile({ bio });
          toast("Profile updated!", "success");
          document.getElementById("edit-profile-modal").classList.remove("open");
          window.PageProfile.render(area, currentUser, params);
        } catch(e) { toast("Failed to save.", "error"); }
        finally { btn.disabled = false; btn.textContent = "Save"; }
      });

      // Avatar upload
      document.getElementById("avatar-upload")?.addEventListener("change", async function() {
        const file = this.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast("Image must be under 2MB.", "error"); return; }
        const reader = new FileReader();
        reader.onload = async e => {
          const b64 = e.target.result;
          try {
            await OogwayAPI.Users.updateProfile({ avatar_base64: b64 });
            // Update current user
            const userData = OogwayAPI.getUser();
            if (userData) { userData.avatar_base64 = b64; localStorage.setItem("oogway_user", JSON.stringify(userData)); }
            toast("Avatar updated!", "success");
            window.PageProfile.render(area, currentUser, params);
          } catch(err) { toast("Failed to upload avatar.", "error"); }
        };
        reader.readAsDataURL(file);
      });
    }

    // Follow button
    document.getElementById("follow-btn")?.addEventListener("click", async function() {
      const tid = parseInt(this.dataset.id);
      try {
        const { following } = await OogwayAPI.Users.follow(tid);
        this.dataset.following = following ? "1" : "0";
        this.textContent = following ? "Following" : "Follow";
        this.className = `btn btn-sm ${following ? "btn-ghost" : "btn-primary"}`;
      } catch(e) { toast("Action failed.", "error"); }
    });

    // Post delete
    area.querySelectorAll(".delete-post-btn").forEach(btn => {
      btn.addEventListener("click", async function() {
        if (!confirm("Delete this post?")) return;
        try {
          await OogwayAPI.Posts.delete(parseInt(this.dataset.id));
          toast("Post deleted.", "success");
          window.PageProfile.render(area, currentUser, params);
        } catch(e) { toast("Failed to delete.", "error"); }
      });
    });

    // Likes / comments
    area.querySelectorAll(".like-btn").forEach(btn => {
      btn.addEventListener("click", async function() {
        const postId = parseInt(this.dataset.id);
        try {
          const { liked } = await OogwayAPI.Posts.like(postId);
          this.classList.toggle("liked", liked);
          const countEl = this.querySelector(".like-count");
          countEl.textContent = parseInt(countEl.textContent) + (liked ? 1 : -1);
          this.innerHTML = (liked ? "❤️" : "🤍") + ` <span class="like-count">${countEl.textContent}</span>`;
        } catch(e) {}
      });
    });
    area.querySelectorAll(".comment-btn").forEach(btn => {
      btn.addEventListener("click", function() { openComments(parseInt(this.dataset.id)); });
    });
  }
};

function renderProfilePost(p, canDelete) {
  const me = window.CURRENT_USER;
  const initials = (p.first_name[0] + p.last_name[0]).toUpperCase();
  return `
    <div class="card post-card" data-post-id="${p.post_id}">
      <div class="post-header">
        <div class="post-avatar">${p.avatar_base64 ? `<img src="${p.avatar_base64}">` : initials}</div>
        <div class="post-meta">
          <div class="name">${p.first_name} ${p.last_name} <span style="color:var(--text-muted);font-weight:400">@${p.username}</span></div>
          <div class="time">${timeAgo(p.created_at)}</div>
        </div>
        ${canDelete ? `<button class="btn btn-ghost btn-sm delete-post-btn" data-id="${p.post_id}" style="margin-left:auto">🗑️</button>` : ""}
      </div>
      ${p.content ? `<div class="post-content">${escHtml(p.content)}</div>` : ""}
      ${p.image_base64 ? `<img class="post-image" src="${p.image_base64}" alt="post" onclick="openLightbox(this.src)">` : ""}
      <div class="post-actions">
        <button class="post-action-btn like-btn ${p.user_liked ? "liked" : ""}" data-id="${p.post_id}">
          ${p.user_liked ? "❤️" : "🤍"} <span class="like-count">${p.like_count}</span>
        </button>
        <button class="post-action-btn comment-btn" data-id="${p.post_id}">
          💬 <span>${p.comment_count}</span>
        </button>
      </div>
    </div>`;
}