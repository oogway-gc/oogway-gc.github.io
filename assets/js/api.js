const API_BASE = window.OOGWAY_API || "https://oogway-gc-api.vercel.app";

function getSession() {
  return localStorage.getItem("oogway_session");
}

function setSession(id) {
  localStorage.setItem("oogway_session", id);
}

function clearSession() {
  localStorage.removeItem("oogway_session");
  localStorage.removeItem("oogway_user");
}

function getUser() {
  try { return JSON.parse(localStorage.getItem("oogway_user")); } catch { return null; }
}

function setUser(user) {
  localStorage.setItem("oogway_user", JSON.stringify(user));
}

async function apiFetch(path, options = {}) {
  const sid = getSession();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (sid) headers["X-Session-Id"] = sid;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: data.error || "Request failed" };
  return data;
}

// Auth
const Auth = {
  async register(body) {
    const data = await apiFetch("/api/auth?action=register", { method: "POST", body: JSON.stringify(body) });
    setSession(data.sessionId);
    setUser(data.user);
    return data;
  },
  async login(body) {
    const data = await apiFetch("/api/auth?action=login", { method: "POST", body: JSON.stringify(body) });
    setSession(data.sessionId);
    setUser(data.user);
    return data;
  },
  async logout() {
    await apiFetch("/api/auth?action=logout", { method: "POST" }).catch(() => {});
    clearSession();
    location.href = "/frontend/index.html";
  },
  async me() {
    const data = await apiFetch("/api/auth?action=me");
    setUser(data.user);
    return data.user;
  }
};

// Posts
const Posts = {
  feed: () => apiFetch("/api/posts?action=feed"),
  userPosts: (uid) => apiFetch(`/api/posts?action=user&user_id=${uid}`),
  create: (body) => apiFetch("/api/posts?action=create", { method: "POST", body: JSON.stringify(body) }),
  delete: (pid) => apiFetch(`/api/posts?action=delete&post_id=${pid}`, { method: "DELETE" }),
  like: (post_id) => apiFetch("/api/posts?action=like", { method: "POST", body: JSON.stringify({ post_id }) }),
  comments: (pid) => apiFetch(`/api/posts?action=comments&post_id=${pid}`),
  comment: (body) => apiFetch("/api/posts?action=comment", { method: "POST", body: JSON.stringify(body) }),
};

// Users
const Users = {
  search: (q) => apiFetch(`/api/users?action=search&q=${encodeURIComponent(q)}`),
  profile: (uid) => apiFetch(`/api/users?action=profile${uid ? "&user_id=" + uid : ""}`),
  follow: (target_id) => apiFetch("/api/users?action=follow", { method: "POST", body: JSON.stringify({ target_id }) }),
  updateProfile: (body) => apiFetch("/api/users?action=profile", { method: "PUT", body: JSON.stringify(body) }),
  updateTheme: (theme) => apiFetch("/api/users?action=theme", { method: "PUT", body: JSON.stringify({ theme }) }),
  suggestions: () => apiFetch("/api/users?action=suggestions"),
};

// Messages
const Messages = {
  conversations: () => apiFetch("/api/messages?action=conversations"),
  thread: (other_id) => apiFetch(`/api/messages?action=thread&other_id=${other_id}`),
  send: (body) => apiFetch("/api/messages?action=send", { method: "POST", body: JSON.stringify(body) }),
};

// Events
const Events = {
  list: (params = {}) => {
    const q = new URLSearchParams({ action: "list", ...params }).toString();
    return apiFetch(`/api/events?${q}`);
  },
  create: (body) => apiFetch("/api/events?action=create", { method: "POST", body: JSON.stringify(body) }),
  delete: (eid) => apiFetch(`/api/events?action=delete&event_id=${eid}`, { method: "DELETE" }),
};

// Notifications
const Notifications = {
  list: () => apiFetch("/api/notifications?action=list"),
  unreadCount: () => apiFetch("/api/notifications?action=unread_count"),
  readAll: () => apiFetch("/api/notifications?action=read_all", { method: "POST" }),
};

window.OogwayAPI = { Auth, Posts, Users, Messages, Events, Notifications, getUser, getSession };