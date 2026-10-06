/**
 * INSTAGROM — Modern SPA Client for Python FastAPI Host
 */

const API = {
  async get(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  },
  async post(url, data = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  },
  async patch(url, data = {}) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  },
  async put(url, data = {}) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  },
  async upload(file, category = "posts") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  }
};

const state = {
  currentUser: null,
  currentView: "feed", // feed, messages, notifications, profile, search, login, register
  profileUsername: null,
  activeConversationId: null,
  unreadNotifications: 0,
  unreadMessages: 0,
  posts: [],
  stories: [],
  sseSource: null,
  lanInfo: null,
};

// Relative Time Formatter
function timeAgo(dateString) {
  if (!dateString) return "just now";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderAvatar(photoUrl, name, size = "w-10 h-10") {
  if (photoUrl) {
    return `<img src="${escapeHtml(photoUrl)}" class="${size} rounded-full object-cover border border-slate-700" alt="${escapeHtml(name)}">`;
  }
  const initial = (name || "U").charAt(0).toUpperCase();
  const colors = [
    "from-pink-500 to-rose-500",
    "from-purple-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500"
  ];
  const colorIndex = (name || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  const gradient = colors[colorIndex];
  return `
    <div class="${size} rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-bold text-sm border border-slate-700 select-none shadow-sm">
      ${initial}
    </div>
  `;
}

// ----------------------------------------------------
// Core Routing & Views
// ----------------------------------------------------

async function initApp() {
  try {
    const res = await API.get("/api/auth/me");
    if (res.user) {
      state.currentUser = res.user;
      initRealtime();
      loadUnreadCounts();
      navigate("feed");
    } else {
      navigate("login");
    }
  } catch (err) {
    console.error("Init app error:", err);
    navigate("login");
  }
}

function initRealtime() {
  if (state.sseSource) {
    state.sseSource.close();
  }
  state.sseSource = new EventSource("/api/realtime/stream");
  state.sseSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "NEW_MESSAGE") {
        state.unreadMessages++;
        updateBadges();
        if (state.currentView === "messages" && state.activeConversationId === data.payload.conversationId) {
          appendIncomingMessage(data.payload.message);
        }
      } else if (data.type === "NEW_NOTIFICATION") {
        state.unreadNotifications++;
        updateBadges();
        showToast("New Notification", "You have a new update on Instagrom");
      }
    } catch (e) {
      console.error("SSE parse error:", e);
    }
  };
}

async function loadUnreadCounts() {
  try {
    const data = await API.get("/api/notifications/unread-count");
    state.unreadNotifications = data.unreadNotifications || 0;
    state.unreadMessages = data.unreadMessages || 0;
    updateBadges();
  } catch (e) {}
}

function updateBadges() {
  const notifBadge = document.getElementById("notif-badge");
  if (notifBadge) {
    if (state.unreadNotifications > 0) {
      notifBadge.textContent = state.unreadNotifications > 99 ? "99+" : state.unreadNotifications;
      notifBadge.classList.remove("hidden");
    } else {
      notifBadge.classList.add("hidden");
    }
  }

  const msgBadge = document.getElementById("msg-badge");
  if (msgBadge) {
    if (state.unreadMessages > 0) {
      msgBadge.textContent = state.unreadMessages > 99 ? "99+" : state.unreadMessages;
      msgBadge.classList.remove("hidden");
    } else {
      msgBadge.classList.add("hidden");
    }
  }
}

function showToast(title, message) {
  const toast = document.createElement("div");
  toast.className = "fixed bottom-5 right-5 bg-slate-800 border border-pink-500/50 text-white px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center space-x-3 transition-all transform translate-y-0 opacity-100";
  toast.innerHTML = `
    <i class="fa-solid fa-bell text-pink-500"></i>
    <div>
      <div class="text-xs font-bold">${escapeHtml(title)}</div>
      <div class="text-xs text-slate-300">${escapeHtml(message)}</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function navigate(view, param = null) {
  state.currentView = view;
  if (view === "profile") {
    state.profileUsername = param || (state.currentUser ? state.currentUser.username : null);
  } else if (view === "messages") {
    state.activeConversationId = param;
  }
  render();
}

// ----------------------------------------------------
// Render Main Structure
// ----------------------------------------------------

function render() {
  const app = document.getElementById("app");

  if (!state.currentUser) {
    if (state.currentView === "register") {
      app.innerHTML = renderRegisterView();
    } else {
      app.innerHTML = renderLoginView();
    }
    return;
  }

  app.innerHTML = `
    <!-- Desktop Sidebar -->
    <aside class="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl p-5 justify-between min-h-screen fixed left-0 top-0 bottom-0 z-30">
      <div>
        <!-- Logo -->
        <div class="flex items-center space-x-3 px-2 py-4 mb-6 cursor-pointer" onclick="navigate('feed')">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 flex items-center justify-center text-white text-xl shadow-lg shadow-pink-500/20">
            <i class="fa-brands fa-instagram"></i>
          </div>
          <div>
            <span class="font-extrabold text-lg tracking-wider bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">INSTAGROM</span>
            <div class="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Python LAN Host
            </div>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="space-y-1.5 font-medium text-sm">
          <button onclick="navigate('feed')" class="w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition ${state.currentView === 'feed' ? 'bg-pink-500/10 text-pink-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/60'}">
            <i class="fa-solid fa-house text-lg w-6 text-center"></i>
            <span>Feed</span>
          </button>

          <button onclick="navigate('search')" class="w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition ${state.currentView === 'search' ? 'bg-pink-500/10 text-pink-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/60'}">
            <i class="fa-solid fa-magnifying-glass text-lg w-6 text-center"></i>
            <span>Explore</span>
          </button>

          <button onclick="navigate('messages')" class="relative w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition ${state.currentView === 'messages' ? 'bg-pink-500/10 text-pink-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/60'}">
            <i class="fa-solid fa-paper-plane text-lg w-6 text-center"></i>
            <span>Messages</span>
            <span id="msg-badge" class="${state.unreadMessages > 0 ? '' : 'hidden'} absolute right-4 px-2 py-0.5 text-xs font-bold rounded-full bg-pink-600 text-white">
              ${state.unreadMessages}
            </span>
          </button>

          <button onclick="navigate('notifications')" class="relative w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition ${state.currentView === 'notifications' ? 'bg-pink-500/10 text-pink-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/60'}">
            <i class="fa-solid fa-heart text-lg w-6 text-center"></i>
            <span>Notifications</span>
            <span id="notif-badge" class="${state.unreadNotifications > 0 ? '' : 'hidden'} absolute right-4 px-2 py-0.5 text-xs font-bold rounded-full bg-pink-600 text-white">
              ${state.unreadNotifications}
            </span>
          </button>

          <button onclick="openCreatePostModal()" class="w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition text-slate-300 hover:bg-slate-800/60">
            <i class="fa-solid fa-square-plus text-lg w-6 text-center text-pink-500"></i>
            <span>Create Post</span>
          </button>

          <button onclick="navigate('profile', '${state.currentUser.username}')" class="w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition ${state.currentView === 'profile' && state.profileUsername === state.currentUser.username ? 'bg-pink-500/10 text-pink-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/60'}">
            ${renderAvatar(state.currentUser.profilePhoto, state.currentUser.displayName, "w-6 h-6")}
            <span class="truncate">${escapeHtml(state.currentUser.displayName)}</span>
          </button>
        </nav>
      </div>

      <!-- User footer & logout -->
      <div class="pt-4 border-t border-slate-800">
        <div class="flex items-center justify-between p-2 rounded-xl bg-slate-800/40">
          <div class="flex items-center space-x-2.5 overflow-hidden">
            ${renderAvatar(state.currentUser.profilePhoto, state.currentUser.displayName, "w-8 h-8")}
            <div class="overflow-hidden">
              <div class="text-xs font-semibold text-slate-200 truncate">${escapeHtml(state.currentUser.displayName)}</div>
              <div class="text-[10px] text-slate-400 truncate">@${escapeHtml(state.currentUser.username)}</div>
            </div>
          </div>
          <button onclick="logout()" title="Logout" class="p-2 text-slate-400 hover:text-rose-400 transition">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </aside>

    <!-- Mobile Top Bar -->
    <header class="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
      <div class="flex items-center space-x-2" onclick="navigate('feed')">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-600 to-amber-500 flex items-center justify-center text-white text-sm">
          <i class="fa-brands fa-instagram"></i>
        </div>
        <span class="font-extrabold tracking-wider bg-gradient-to-r from-pink-500 to-amber-400 bg-clip-text text-transparent">INSTAGROM</span>
      </div>
      <div class="flex items-center space-x-3">
        <button onclick="openCreatePostModal()" class="text-slate-200 p-1.5"><i class="fa-solid fa-square-plus text-xl"></i></button>
        <button onclick="navigate('messages')" class="relative text-slate-200 p-1.5">
          <i class="fa-solid fa-paper-plane text-xl"></i>
          <span class="${state.unreadMessages > 0 ? '' : 'hidden'} absolute top-0 right-0 w-2 h-2 bg-pink-500 rounded-full"></span>
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 md:ml-64 pb-20 md:pb-6 min-h-screen bg-slate-950">
      <div id="main-view-container" class="max-w-4xl mx-auto px-3 sm:px-6 py-4">
        <!-- Rendered Subview -->
      </div>
    </main>

    <!-- Mobile Bottom Navigation Bar -->
    <nav class="md:hidden flex items-center justify-around border-t border-slate-800 bg-slate-900/95 backdrop-blur-md fixed bottom-0 left-0 right-0 py-2.5 z-30 text-slate-300">
      <button onclick="navigate('feed')" class="${state.currentView === 'feed' ? 'text-pink-500' : ''} p-2"><i class="fa-solid fa-house text-xl"></i></button>
      <button onclick="navigate('search')" class="${state.currentView === 'search' ? 'text-pink-500' : ''} p-2"><i class="fa-solid fa-magnifying-glass text-xl"></i></button>
      <button onclick="openCreatePostModal()" class="p-2 text-pink-500"><i class="fa-solid fa-circle-plus text-2xl"></i></button>
      <button onclick="navigate('notifications')" class="relative ${state.currentView === 'notifications' ? 'text-pink-500' : ''} p-2">
        <i class="fa-solid fa-heart text-xl"></i>
        <span class="${state.unreadNotifications > 0 ? '' : 'hidden'} absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full"></span>
      </button>
      <button onclick="navigate('profile', '${state.currentUser.username}')" class="${state.currentView === 'profile' && state.profileUsername === state.currentUser.username ? 'ring-2 ring-pink-500 rounded-full' : ''} p-1">
        ${renderAvatar(state.currentUser.profilePhoto, state.currentUser.displayName, "w-6 h-6")}
      </button>
    </nav>

    <!-- Modals Container -->
    <div id="modal-container"></div>
  `;

  // Render the active subview
  renderCurrentSubview();
}

function renderCurrentSubview() {
  const container = document.getElementById("main-view-container");
  if (!container) return;

  if (state.currentView === "feed") {
    loadAndRenderFeed(container);
  } else if (state.currentView === "search") {
    renderSearchView(container);
  } else if (state.currentView === "messages") {
    loadAndRenderMessages(container);
  } else if (state.currentView === "notifications") {
    loadAndRenderNotifications(container);
  } else if (state.currentView === "profile") {
    loadAndRenderProfile(container, state.profileUsername);
  }
}

// ----------------------------------------------------
// 1. Feed View & Stories
// ----------------------------------------------------

async function loadAndRenderFeed(container) {
  container.innerHTML = `
    <!-- Stories Carousel -->
    <div class="mb-6 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-sm flex items-center space-x-4 overflow-x-auto scrollbar-none" id="stories-bar">
      <!-- Create Story Button -->
      <div class="flex flex-col items-center space-y-1.5 cursor-pointer flex-shrink-0" onclick="openCreateStoryModal()">
        <div class="relative w-16 h-16 rounded-full p-0.5 border-2 border-dashed border-pink-500 flex items-center justify-center bg-slate-800 hover:bg-slate-700 transition">
          ${renderAvatar(state.currentUser.profilePhoto, state.currentUser.displayName, "w-14 h-14")}
          <div class="absolute bottom-0 right-0 w-5 h-5 bg-pink-600 rounded-full flex items-center justify-center text-white text-xs border border-slate-900">
            <i class="fa-solid fa-plus"></i>
          </div>
        </div>
        <span class="text-[11px] text-slate-400 font-medium">Your Story</span>
      </div>
      <div id="stories-list" class="flex items-center space-x-4"></div>
    </div>

    <!-- Feed Container -->
    <div class="space-y-6 max-w-xl mx-auto" id="feed-posts-container">
      <div class="text-center py-12 text-slate-500">
        <i class="fa-solid fa-spinner animate-spin text-2xl mb-2"></i>
        <p class="text-sm">Loading classroom feed...</p>
      </div>
    </div>
  `;

  loadStories();
  loadPosts();
}

async function loadStories() {
  try {
    const data = await API.get("/api/stories");
    const list = document.getElementById("stories-list");
    if (!list) return;

    if (!data.stories || data.stories.length === 0) {
      list.innerHTML = `<span class="text-xs text-slate-500 italic pl-2">No active stories</span>`;
      return;
    }

    list.innerHTML = data.stories.map(group => `
      <div class="flex flex-col items-center space-y-1.5 cursor-pointer flex-shrink-0" onclick="viewStory('${group.author.username}', '${escapeHtml(group.stories[0].mediaUrl)}', '${escapeHtml(group.stories[0].caption || '')}')">
        <div class="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 flex items-center justify-center shadow-md">
          <div class="p-[2px] bg-slate-950 rounded-full">
            ${renderAvatar(group.author.profilePhoto, group.author.displayName, "w-13 h-13")}
          </div>
        </div>
        <span class="text-[11px] text-slate-300 font-medium truncate w-16 text-center">${escapeHtml(group.author.username)}</span>
      </div>
    `).join("");
  } catch (err) {
    console.error("Stories error:", err);
  }
}

async function loadPosts() {
  const container = document.getElementById("feed-posts-container");
  if (!container) return;

  try {
    const data = await API.get("/api/posts?limit=25");
    state.posts = data.posts || [];

    if (state.posts.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 px-4 bg-slate-900/40 border border-slate-800 rounded-3xl">
          <div class="w-16 h-16 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center mx-auto text-2xl mb-3">
            <i class="fa-solid fa-camera"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-200">No Posts Yet</h3>
          <p class="text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-5">Be the first in your classroom to share a post or photo on INSTAGROM!</p>
          <button onclick="openCreatePostModal()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-sm font-semibold shadow-lg shadow-pink-500/25 transition">
            Create First Post
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = state.posts.map(post => renderPostCard(post)).join("");
  } catch (err) {
    container.innerHTML = `
      <div class="text-center py-12 text-rose-400">
        <p>Failed to load feed: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function renderPostCard(post) {
  const isLiked = post.isLiked;
  const isSaved = post.isSaved;

  return `
    <article class="bg-slate-900/70 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl" id="post-card-${post.id}">
      <!-- Post Header -->
      <div class="flex items-center justify-between p-3.5 border-b border-slate-800/60">
        <div class="flex items-center space-x-3 cursor-pointer" onclick="navigate('profile', '${post.author.username}')">
          ${renderAvatar(post.author.profilePhoto, post.author.displayName, "w-9 h-9")}
          <div>
            <div class="text-sm font-bold text-slate-100 hover:underline flex items-center gap-1.5">
              ${escapeHtml(post.author.displayName)}
              <span class="text-xs font-normal text-slate-400">@${escapeHtml(post.author.username)}</span>
            </div>
            <div class="text-[11px] text-slate-500">${timeAgo(post.createdAt)}</div>
          </div>
        </div>
        ${state.currentUser.id === post.author.id ? `
          <button onclick="deletePost('${post.id}')" class="text-slate-500 hover:text-rose-400 p-2 transition text-sm">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        ` : ''}
      </div>

      <!-- Post Media with Double-Click Heart -->
      <div class="relative bg-black flex items-center justify-center overflow-hidden select-none cursor-pointer group" ondblclick="triggerLike('${post.id}')">
        <img src="${escapeHtml(post.imageUrl)}" alt="Post" class="w-full max-h-[550px] object-contain bg-slate-950" loading="lazy">
        <div id="heart-anim-${post.id}" class="hidden absolute inset-0 flex items-center justify-center pointer-events-none">
          <i class="fa-solid fa-heart text-white/90 text-7xl filter drop-shadow-lg heart-burst"></i>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="p-3.5 space-y-2.5">
        <div class="flex items-center justify-between text-xl">
          <div class="flex items-center space-x-4">
            <button onclick="triggerLike('${post.id}')" class="transition transform active:scale-125 focus:outline-none" id="like-btn-${post.id}">
              <i class="${isLiked ? 'fa-solid fa-heart text-pink-500' : 'fa-regular fa-heart text-slate-300 hover:text-pink-400'}"></i>
            </button>
            <button onclick="focusCommentInput('${post.id}')" class="text-slate-300 hover:text-slate-100 transition">
              <i class="fa-regular fa-comment"></i>
            </button>
            <button onclick="sharePost('${post.id}', '${escapeHtml(post.author.username)}')" class="text-slate-300 hover:text-slate-100 transition">
              <i class="fa-regular fa-paper-plane"></i>
            </button>
          </div>
          <button onclick="triggerSave('${post.id}')" class="transition text-slate-300 hover:text-amber-400" id="save-btn-${post.id}">
            <i class="${isSaved ? 'fa-solid fa-bookmark text-amber-400' : 'fa-regular fa-bookmark'}"></i>
          </button>
        </div>

        <!-- Likes Count -->
        <div class="text-xs font-bold text-slate-200" id="like-count-${post.id}">
          ${post.likeCount || 0} ${post.likeCount === 1 ? 'like' : 'likes'}
        </div>

        <!-- Caption -->
        ${post.caption ? `
          <div class="text-sm text-slate-300 leading-relaxed">
            <span class="font-bold text-slate-100 cursor-pointer hover:underline mr-1.5" onclick="navigate('profile', '${post.author.username}')">${escapeHtml(post.author.username)}</span>
            <span>${formatCaption(post.caption)}</span>
          </div>
        ` : ''}

        <!-- Recent Comments -->
        <div class="space-y-1.5 pt-1" id="comments-container-${post.id}">
          ${(post.recentComments || []).map(c => `
            <div class="text-xs text-slate-300 flex items-baseline justify-between" id="comment-item-${c.id}">
              <div>
                <span class="font-bold text-slate-200 cursor-pointer hover:underline mr-1" onclick="navigate('profile', '${c.author.username}')">${escapeHtml(c.author.username)}</span>
                <span>${escapeHtml(c.content)}</span>
              </div>
              ${(state.currentUser.id === c.author.id || state.currentUser.id === post.author.id) ? `
                <button onclick="deleteComment('${post.id}', '${c.id}')" class="text-slate-600 hover:text-rose-400 text-[10px] pl-2 transition">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Add Comment Input Box -->
        <form onsubmit="submitComment(event, '${post.id}')" class="flex items-center pt-2 border-t border-slate-800/60 mt-2">
          <input type="text" id="comment-input-${post.id}" placeholder="Add a comment..." class="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none pr-2">
          <button type="submit" class="text-xs font-bold text-pink-500 hover:text-pink-400 transition disabled:opacity-50">Post</button>
        </form>
      </div>
    </article>
  `;
}

function formatCaption(caption) {
  if (!caption) return "";
  const escaped = escapeHtml(caption);
  // Highlight hashtags #tag
  return escaped.replace(/#(\w+)/g, '<span class="text-pink-400 font-medium">#$1</span>');
}

async function triggerLike(postId) {
  try {
    const heartAnim = document.getElementById(`heart-anim-${postId}`);
    if (heartAnim) {
      heartAnim.classList.remove("hidden");
      setTimeout(() => heartAnim.classList.add("hidden"), 700);
    }

    const res = await API.post(`/api/posts/${postId}/like`);
    const likeBtn = document.getElementById(`like-btn-${postId}`);
    const likeCount = document.getElementById(`like-count-${postId}`);

    if (likeBtn) {
      likeBtn.innerHTML = `<i class="${res.liked ? 'fa-solid fa-heart text-pink-500' : 'fa-regular fa-heart text-slate-300 hover:text-pink-400'}"></i>`;
    }
    if (likeCount) {
      likeCount.textContent = `${res.likeCount} ${res.likeCount === 1 ? 'like' : 'likes'}`;
    }
  } catch (err) {
    console.error("Like error:", err);
  }
}

async function triggerSave(postId) {
  try {
    const res = await API.post(`/api/posts/${postId}/save`);
    const saveBtn = document.getElementById(`save-btn-${postId}`);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="${res.saved ? 'fa-solid fa-bookmark text-amber-400' : 'fa-regular fa-bookmark'}"></i>`;
    }
    showToast("Saved", res.saved ? "Post saved to your collection" : "Post removed from saved");
  } catch (err) {
    console.error("Save error:", err);
  }
}

function focusCommentInput(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (input) input.focus();
}

async function submitComment(event, postId) {
  event.preventDefault();
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  input.value = "";

  try {
    const res = await API.post(`/api/posts/${postId}/comments`, { content });
    const container = document.getElementById(`comments-container-${postId}`);
    if (container) {
      const c = res.comment;
      const html = `
        <div class="text-xs text-slate-300 flex items-baseline justify-between animate-fadeIn" id="comment-item-${c.id}">
          <div>
            <span class="font-bold text-slate-200 cursor-pointer hover:underline mr-1" onclick="navigate('profile', '${c.author.username}')">${escapeHtml(c.author.username)}</span>
            <span>${escapeHtml(c.content)}</span>
          </div>
          <button onclick="deleteComment('${postId}', '${c.id}')" class="text-slate-600 hover:text-rose-400 text-[10px] pl-2 transition">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", html);
    }
  } catch (err) {
    alert("Failed to post comment: " + err.message);
  }
}

async function deleteComment(postId, commentId) {
  if (!confirm("Delete this comment?")) return;
  try {
    await API.delete(`/api/posts/${postId}/comments/${commentId}`);
    const el = document.getElementById(`comment-item-${commentId}`);
    if (el) el.remove();
  } catch (err) {
    alert("Failed to delete comment: " + err.message);
  }
}

async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;
  try {
    await API.delete(`/api/posts/${postId}`);
    const card = document.getElementById(`post-card-${postId}`);
    if (card) card.remove();
    showToast("Deleted", "Post was deleted successfully");
  } catch (err) {
    alert("Failed to delete post: " + err.message);
  }
}

function sharePost(postId, authorUsername) {
  const url = `${window.location.origin}/#post-${postId}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast("Link Copied", `Link to @${authorUsername}'s post copied to clipboard`);
  }).catch(() => {
    showToast("Share", `Post ID: ${postId}`);
  });
}

// ----------------------------------------------------
// 2. Direct Messaging View
// ----------------------------------------------------

async function loadAndRenderMessages(container) {
  container.innerHTML = `
    <div class="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-[calc(100vh-6rem)] flex flex-col md:flex-row">
      <!-- Left sidebar: Conversation list -->
      <div class="w-full md:w-80 border-r border-slate-800 flex flex-col ${state.activeConversationId ? 'hidden md:flex' : 'flex'}">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
            <i class="fa-solid fa-messages text-pink-500"></i> Messages
          </h2>
          <button onclick="openNewChatModal()" class="p-2 rounded-xl bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 transition text-sm">
            <i class="fa-solid fa-pen-to-square"></i> New Chat
          </button>
        </div>
        <div class="flex-1 overflow-y-auto divide-y divide-slate-800/40" id="conversations-list">
          <div class="p-8 text-center text-slate-500 text-xs">Loading chats...</div>
        </div>
      </div>

      <!-- Right pane: Chat messages -->
      <div class="flex-1 flex flex-col ${state.activeConversationId ? 'flex' : 'hidden md:flex'} bg-slate-950/40" id="chat-pane">
        ${state.activeConversationId ? `
          <div class="p-8 text-center text-slate-500 text-xs">Loading conversation...</div>
        ` : `
          <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl text-slate-400 mb-3">
              <i class="fa-regular fa-paper-plane"></i>
            </div>
            <h3 class="text-base font-bold text-slate-200">Your Classroom Messages</h3>
            <p class="text-xs text-slate-400 mt-1 mb-4">Send private notes, photos, and messages directly to classmates over LAN.</p>
            <button onclick="openNewChatModal()" class="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-semibold hover:bg-pink-500 transition">
              Send Message
            </button>
          </div>
        `}
      </div>
    </div>
  `;

  loadConversationsList();
  if (state.activeConversationId) {
    loadConversationChat(state.activeConversationId);
  }
}

async function loadConversationsList() {
  const listEl = document.getElementById("conversations-list");
  if (!listEl) return;

  try {
    const data = await API.get("/api/messages");
    const convs = data.conversations || [];

    if (convs.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-slate-500 text-xs">
          No conversations yet. Click "New Chat" to start messaging a classmate.
        </div>
      `;
      return;
    }

    listEl.innerHTML = convs.map(c => {
      const other = c.otherUser || { username: "unknown", displayName: "User" };
      const isActive = state.activeConversationId === c.id;
      const isOnline = c.presence && c.presence.isOnline;

      return `
        <div onclick="selectConversation('${c.id}')" class="flex items-center space-x-3 p-3.5 cursor-pointer transition ${isActive ? 'bg-pink-500/10 border-l-4 border-pink-500' : 'hover:bg-slate-800/40'}">
          <div class="relative flex-shrink-0">
            ${renderAvatar(other.profilePhoto, other.displayName, "w-11 h-11")}
            <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-600'} border-2 border-slate-900"></span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <div class="text-sm font-bold text-slate-100 truncate">${escapeHtml(other.displayName)}</div>
              <div class="text-[10px] text-slate-500">${c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}</div>
            </div>
            <div class="flex items-center justify-between mt-0.5">
              <div class="text-xs text-slate-400 truncate ${c.unreadCount > 0 ? 'font-semibold text-slate-200' : ''}">
                ${c.lastMessage ? escapeHtml(c.lastMessage.content) : 'Started a conversation'}
              </div>
              ${c.unreadCount > 0 ? `
                <span class="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-pink-600 text-white">
                  ${c.unreadCount}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    listEl.innerHTML = `<div class="p-4 text-xs text-rose-400">Failed to load chats: ${err.message}</div>`;
  }
}

async function selectConversation(convId) {
  state.activeConversationId = convId;
  const pane = document.getElementById("chat-pane");
  if (pane) {
    loadConversationChat(convId);
  }
}

async function loadConversationChat(convId) {
  const pane = document.getElementById("chat-pane");
  if (!pane) return;

  try {
    // Mark read
    API.patch(`/api/messages/${convId}/read`).catch(() => {});

    const msgData = await API.get(`/api/messages/${convId}`);
    const messages = msgData.messages || [];

    pane.innerHTML = `
      <!-- Chat Header -->
      <div class="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div class="flex items-center space-x-3">
          <button onclick="state.activeConversationId = null; render();" class="md:hidden text-slate-400 mr-1"><i class="fa-solid fa-arrow-left"></i></button>
          <div id="chat-header-user" class="flex items-center space-x-2.5">
            <div class="text-sm font-bold text-slate-100">Conversation</div>
          </div>
        </div>
        <button onclick="loadConversationChat('${convId}')" title="Refresh" class="text-slate-400 hover:text-slate-200 p-2"><i class="fa-solid fa-rotate-right"></i></button>
      </div>

      <!-- Messages Stream -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3" id="chat-messages-stream">
        ${messages.length === 0 ? `
          <div class="text-center py-12 text-slate-500 text-xs">No messages yet. Send a greeting!</div>
        ` : messages.map(m => renderChatMessage(m)).join("")}
      </div>

      <!-- Chat Input -->
      <form onsubmit="sendChatMessage(event, '${convId}')" class="p-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center space-x-2">
        <input type="text" id="chat-input-text" placeholder="Message..." class="flex-1 bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500" autocomplete="off">
        <button type="submit" class="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold transition flex items-center gap-1.5">
          <span>Send</span>
          <i class="fa-solid fa-paper-plane text-xs"></i>
        </button>
      </form>
    `;

    scrollChatToBottom();
  } catch (err) {
    pane.innerHTML = `<div class="p-6 text-rose-400 text-xs">Error loading conversation: ${err.message}</div>`;
  }
}

function renderChatMessage(m) {
  const isMe = m.senderId === state.currentUser.id;
  return `
    <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
      <div class="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
        isMe
          ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-br-none'
          : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/50'
      }">
        <div>${escapeHtml(m.content)}</div>
      </div>
      <span class="text-[10px] text-slate-500 mt-1 px-1">${timeAgo(m.createdAt)}</span>
    </div>
  `;
}

function appendIncomingMessage(message) {
  const stream = document.getElementById("chat-messages-stream");
  if (!stream) return;
  stream.insertAdjacentHTML("beforeend", renderChatMessage(message));
  scrollChatToBottom();
}

function scrollChatToBottom() {
  const stream = document.getElementById("chat-messages-stream");
  if (stream) {
    stream.scrollTop = stream.scrollHeight;
  }
}

async function sendChatMessage(event, convId) {
  event.preventDefault();
  const input = document.getElementById("chat-input-text");
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  input.value = "";

  try {
    const res = await API.post(`/api/conversations/${convId}/messages`, { content });
    appendIncomingMessage(res.message);
    loadConversationsList();
  } catch (err) {
    alert("Failed to send message: " + err.message);
  }
}

// ----------------------------------------------------
// 3. Notifications View
// ----------------------------------------------------

async function loadAndRenderNotifications(container) {
  container.innerHTML = `
    <div class="max-w-xl mx-auto bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6">
      <div class="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
        <h2 class="text-xl font-bold text-slate-100 flex items-center gap-2">
          <i class="fa-solid fa-heart text-pink-500"></i> Notifications
        </h2>
        <button onclick="markAllNotificationsRead()" class="text-xs font-semibold text-pink-400 hover:text-pink-300">
          Mark all as read
        </button>
      </div>
      <div id="notifications-list" class="space-y-3">
        <div class="text-center py-8 text-slate-500 text-sm">Loading notifications...</div>
      </div>
    </div>
  `;

  try {
    const data = await API.get("/api/notifications");
    const list = document.getElementById("notifications-list");
    if (!list) return;

    const notifs = data.notifications || [];
    if (notifs.length === 0) {
      list.innerHTML = `
        <div class="text-center py-12 text-slate-500 text-sm">
          <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
            <i class="fa-regular fa-bell"></i>
          </div>
          No notifications yet.
        </div>
      `;
      return;
    }

    list.innerHTML = notifs.map(n => {
      let icon = '<i class="fa-solid fa-heart text-pink-500"></i>';
      let actionText = "interacted with you";
      if (n.type === "LIKE") actionText = "liked your post";
      if (n.type === "COMMENT") actionText = "commented on your post";
      if (n.type === "FOLLOW") {
        icon = '<i class="fa-solid fa-user-plus text-indigo-400"></i>';
        actionText = "started following you";
      }
      if (n.type === "MESSAGE") {
        icon = '<i class="fa-solid fa-envelope text-blue-400"></i>';
        actionText = "sent you a direct message";
      }

      return `
        <div class="flex items-center justify-between p-3 rounded-2xl ${n.readAt ? 'bg-slate-900/40' : 'bg-pink-500/5 border border-pink-500/20'}">
          <div class="flex items-center space-x-3">
            ${renderAvatar(n.actor.profilePhoto, n.actor.displayName, "w-10 h-10")}
            <div class="text-xs text-slate-300">
              <span class="font-bold text-slate-100 cursor-pointer hover:underline" onclick="navigate('profile', '${n.actor.username}')">${escapeHtml(n.actor.displayName)}</span>
              <span class="text-slate-400"> ${actionText}</span>
              <div class="text-[10px] text-slate-500 mt-0.5">${timeAgo(n.createdAt)}</div>
            </div>
          </div>
          ${n.post && n.post.imageUrl ? `
            <img src="${escapeHtml(n.post.imageUrl)}" class="w-10 h-10 rounded-lg object-cover border border-slate-700" alt="Post">
          ` : ''}
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Notifs error:", err);
  }
}

async function markAllNotificationsRead() {
  try {
    await API.post("/api/notifications/read-all");
    state.unreadNotifications = 0;
    updateBadges();
    loadAndRenderNotifications(document.getElementById("main-view-container"));
  } catch (err) {
    alert("Error: " + err.message);
  }
}

// ----------------------------------------------------
// 4. Search View
// ----------------------------------------------------

async function renderSearchView(container) {
  container.innerHTML = `
    <div class="max-w-2xl mx-auto space-y-6">
      <!-- Search Input -->
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-500"></i>
        <input type="text" id="search-input" oninput="debounceSearch()" placeholder="Search classmates, usernames, hashtags..." class="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 shadow-inner" autofocus>
      </div>

      <!-- Suggested Users Section -->
      <div>
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Suggested Classmates</h3>
        <div id="suggested-users-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-4 text-xs text-slate-500">Loading classmates...</div>
        </div>
      </div>

      <!-- Search Results -->
      <div id="search-results-container" class="space-y-4"></div>
    </div>
  `;

  loadSuggestedUsers();
}

async function loadSuggestedUsers() {
  const grid = document.getElementById("suggested-users-grid");
  if (!grid) return;

  try {
    const data = await API.get("/api/users/suggested");
    const users = data.users || [];

    if (users.length === 0) {
      grid.innerHTML = `<div class="text-xs text-slate-500 p-2">No suggestions available.</div>`;
      return;
    }

    grid.innerHTML = users.map(u => `
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div class="flex items-center space-x-3 cursor-pointer overflow-hidden" onclick="navigate('profile', '${u.username}')">
          ${renderAvatar(u.profilePhoto, u.displayName, "w-10 h-10")}
          <div class="overflow-hidden">
            <div class="text-xs font-bold text-slate-200 truncate hover:underline">${escapeHtml(u.displayName)}</div>
            <div class="text-[11px] text-slate-400 truncate">@${escapeHtml(u.username)}</div>
          </div>
        </div>
        <button onclick="toggleFollow('${u.username}', this)" class="px-3 py-1 rounded-xl text-xs font-semibold ${u.isFollowing ? 'bg-slate-800 text-slate-300' : 'bg-pink-600 hover:bg-pink-500 text-white'} transition">
          ${u.isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    `).join("");
  } catch (err) {
    grid.innerHTML = `<div class="text-xs text-rose-400 p-2">Error: ${err.message}</div>`;
  }
}

let searchTimeout = null;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(executeSearch, 300);
}

async function executeSearch() {
  const input = document.getElementById("search-input");
  const container = document.getElementById("search-results-container");
  if (!input || !container) return;

  const q = input.value.trim();
  if (!q) {
    container.innerHTML = "";
    return;
  }

  try {
    const data = await API.get(`/api/search?q=${encodeURIComponent(q)}`);
    const users = data.users || [];
    const posts = data.posts || [];

    container.innerHTML = `
      <div class="pt-4 border-t border-slate-800 space-y-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Search Results for "${escapeHtml(q)}"</h3>
        
        <!-- Users Results -->
        ${users.length > 0 ? `
          <div class="space-y-2">
            ${users.map(u => `
              <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <div class="flex items-center space-x-3 cursor-pointer" onclick="navigate('profile', '${u.username}')">
                  ${renderAvatar(u.profilePhoto, u.displayName, "w-10 h-10")}
                  <div>
                    <div class="text-xs font-bold text-slate-100 hover:underline">${escapeHtml(u.displayName)}</div>
                    <div class="text-[11px] text-slate-400">@${escapeHtml(u.username)} &bull; ${u.followerCount} followers</div>
                  </div>
                </div>
                ${!u.isSelf ? `
                  <button onclick="toggleFollow('${u.username}', this)" class="px-3 py-1 rounded-xl text-xs font-semibold ${u.isFollowing ? 'bg-slate-800 text-slate-300' : 'bg-pink-600 text-white'}">
                    ${u.isFollowing ? 'Following' : 'Follow'}
                  </button>
                ` : ''}
              </div>
            `).join("")}
          </div>
        ` : '<p class="text-xs text-slate-500 italic">No users found.</p>'}

        <!-- Posts Results -->
        ${posts.length > 0 ? `
          <div class="grid grid-cols-3 gap-2 pt-2">
            ${posts.map(p => `
              <div class="aspect-square bg-slate-900 rounded-xl overflow-hidden cursor-pointer group relative" onclick="navigate('feed')">
                <img src="${escapeHtml(p.imageUrl)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="Post">
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-3 text-white text-xs font-bold transition">
                  <span><i class="fa-solid fa-heart"></i> ${p.likeCount}</span>
                  <span><i class="fa-solid fa-comment"></i> ${p.commentCount}</span>
                </div>
              </div>
            `).join("")}
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-400">Search error: ${err.message}</div>`;
  }
}

// ----------------------------------------------------
// 5. User Profile View
// ----------------------------------------------------

async function loadAndRenderProfile(container, username) {
  container.innerHTML = `<div class="text-center py-16 text-slate-500 text-sm">Loading @${escapeHtml(username)}'s profile...</div>`;

  try {
    const data = await API.get(`/api/users/${username}`);
    const u = data.user;
    const posts = data.posts || [];
    const savedPosts = data.savedPosts || [];

    container.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6">
        <!-- Profile Header Card -->
        <div class="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">
          ${renderAvatar(u.profilePhoto, u.displayName, "w-24 h-24 sm:w-28 sm:h-28")}
          <div class="flex-1 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 class="text-xl font-bold text-slate-100">${escapeHtml(u.displayName)}</h2>
                <div class="text-sm text-pink-400 font-mono">@${escapeHtml(u.username)}</div>
              </div>
              <div>
                ${u.isSelf ? `
                  <button onclick="openEditProfileModal('${escapeHtml(u.displayName)}', '${escapeHtml(u.bio || '')}', '${escapeHtml(u.profilePhoto || '')}')" class="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700">
                    <i class="fa-solid fa-pen text-xs mr-1"></i> Edit Profile
                  </button>
                ` : `
                  <div class="flex items-center gap-2">
                    <button onclick="toggleFollow('${u.username}', this)" class="px-4 py-1.5 rounded-xl text-xs font-semibold ${u.isFollowing ? 'bg-slate-800 text-slate-300' : 'bg-pink-600 hover:bg-pink-500 text-white'} transition">
                      ${u.isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button onclick="startChatWith('${u.username}')" class="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700">
                      Message
                    </button>
                  </div>
                `}
              </div>
            </div>

            <!-- Stats -->
            <div class="flex justify-center sm:justify-start space-x-6 text-xs text-slate-300 pt-1">
              <div><span class="font-bold text-slate-100">${u.postCount}</span> posts</div>
              <div><span class="font-bold text-slate-100" id="prof-followers-count">${u.followerCount}</span> followers</div>
              <div><span class="font-bold text-slate-100">${u.followingCount}</span> following</div>
            </div>

            <!-- Bio -->
            ${u.bio ? `<p class="text-xs text-slate-300 leading-relaxed max-w-md pt-1">${escapeHtml(u.bio)}</p>` : ''}
          </div>
        </div>

        <!-- Posts Grid Header -->
        <div class="border-t border-slate-800 pt-4">
          <div class="flex items-center justify-center space-x-8 text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            <span class="text-pink-500 border-b-2 border-pink-500 pb-1 cursor-pointer"><i class="fa-solid fa-table-cells mr-1.5"></i> Posts</span>
            ${u.isSelf ? `<span onclick="toggleSavedTab()" class="hover:text-slate-200 pb-1 cursor-pointer"><i class="fa-regular fa-bookmark mr-1.5"></i> Saved</span>` : ''}
          </div>

          <!-- Posts 3-column Grid -->
          <div class="grid grid-cols-3 gap-2 sm:gap-3" id="profile-posts-grid">
            ${posts.length === 0 ? `
              <div class="col-span-3 text-center py-12 text-slate-500 text-xs">No posts shared yet.</div>
            ` : posts.map(p => `
              <div class="aspect-square bg-slate-900 rounded-2xl overflow-hidden cursor-pointer group relative" onclick="navigate('feed')">
                <img src="${escapeHtml(p.imageUrl)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="Post">
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-4 text-white text-xs font-bold transition">
                  <span><i class="fa-solid fa-heart text-pink-400"></i> ${p.likeCount}</span>
                  <span><i class="fa-solid fa-comment"></i> ${p.commentCount}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-rose-400 text-sm">Failed to load profile: ${err.message}</div>`;
  }
}

async function toggleFollow(username, btnEl) {
  try {
    const res = await API.post(`/api/users/${username}/follow`);
    if (btnEl) {
      if (res.isFollowing) {
        btnEl.textContent = "Following";
        btnEl.className = "px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 transition";
      } else {
        btnEl.textContent = "Follow";
        btnEl.className = "px-3 py-1 rounded-xl text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white transition";
      }
    }
    const followerCountEl = document.getElementById("prof-followers-count");
    if (followerCountEl) {
      followerCountEl.textContent = res.followerCount;
    }
  } catch (err) {
    alert("Follow action failed: " + err.message);
  }
}

async function startChatWith(username) {
  try {
    const res = await API.post("/api/conversations", { recipientUsername: username });
    navigate("messages", res.conversation.id);
  } catch (err) {
    alert("Error opening chat: " + err.message);
  }
}

// ----------------------------------------------------
// 6. Modals (Create Post, Story, Edit Profile, New Chat)
// ----------------------------------------------------

function openCreatePostModal() {
  const container = document.getElementById("modal-container");
  container.innerHTML = `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-100">Create New Post</h3>
          <button onclick="closeModal()" class="text-slate-400 hover:text-slate-200"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
        <form onsubmit="handleCreatePost(event)" class="p-6 space-y-4">
          <!-- File Drop Zone -->
          <div class="border-2 border-dashed border-slate-700 hover:border-pink-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-950/40 relative" onclick="document.getElementById('post-file-input').click()">
            <input type="file" id="post-file-input" accept="image/*" class="hidden" onchange="previewPostFile(event)">
            <div id="file-preview-zone">
              <div class="w-12 h-12 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center mx-auto mb-2 text-xl">
                <i class="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <p class="text-xs font-semibold text-slate-200">Click to upload photo</p>
              <p class="text-[11px] text-slate-500 mt-0.5">JPEG, PNG, WEBP, GIF up to 10MB</p>
            </div>
          </div>

          <!-- Caption Input -->
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Caption</label>
            <textarea id="post-caption-input" rows="3" placeholder="Write a caption... (e.g. Science lab results #biology)" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500"></textarea>
          </div>

          <!-- Submit -->
          <div class="flex justify-end space-x-3 pt-2">
            <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition">Cancel</button>
            <button type="submit" id="create-post-submit-btn" class="px-5 py-2 rounded-xl text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/25 transition">
              Share Post
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

let selectedPostFile = null;
function previewPostFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedPostFile = file;

  const zone = document.getElementById("file-preview-zone");
  const reader = new FileReader();
  reader.onload = (e) => {
    zone.innerHTML = `
      <img src="${e.target.result}" class="max-h-56 mx-auto rounded-xl object-contain shadow-md" alt="Preview">
      <p class="text-[10px] text-pink-400 mt-2">Click to change photo</p>
    `;
  };
  reader.readAsDataURL(file);
}

async function handleCreatePost(event) {
  event.preventDefault();
  if (!selectedPostFile) {
    alert("Please select a photo to upload.");
    return;
  }

  const btn = document.getElementById("create-post-submit-btn");
  const caption = document.getElementById("post-caption-input").value.trim();

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Uploading...`;

    // 1. Upload file
    const uploadRes = await API.upload(selectedPostFile, "posts");

    // 2. Create post
    await API.post("/api/posts", {
      imageUrl: uploadRes.url,
      caption: caption || null,
    });

    closeModal();
    selectedPostFile = null;
    showToast("Success", "Your post has been published to the feed!");
    if (state.currentView === "feed") {
      loadPosts();
    } else {
      navigate("feed");
    }
  } catch (err) {
    alert("Failed to create post: " + err.message);
    btn.disabled = false;
    btn.textContent = "Share Post";
  }
}

function openCreateStoryModal() {
  const container = document.getElementById("modal-container");
  container.innerHTML = `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-100">Add Story</h3>
          <button onclick="closeModal()" class="text-slate-400 hover:text-slate-200"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
        <form onsubmit="handleCreateStory(event)" class="p-5 space-y-4">
          <div class="border-2 border-dashed border-slate-700 hover:border-pink-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-950/40 relative" onclick="document.getElementById('story-file-input').click()">
            <input type="file" id="story-file-input" accept="image/*" class="hidden" onchange="previewStoryFile(event)">
            <div id="story-preview-zone">
              <div class="w-10 h-10 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center mx-auto mb-2">
                <i class="fa-solid fa-camera"></i>
              </div>
              <p class="text-xs font-semibold text-slate-200">Select Story Photo</p>
            </div>
          </div>
          <input type="text" id="story-caption" placeholder="Optional story caption..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500">
          <button type="submit" id="create-story-btn" class="w-full py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 text-white shadow-lg transition">
            Add to Story
          </button>
        </form>
      </div>
    </div>
  `;
}

let selectedStoryFile = null;
function previewStoryFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedStoryFile = file;
  const zone = document.getElementById("story-preview-zone");
  const reader = new FileReader();
  reader.onload = (e) => {
    zone.innerHTML = `<img src="${e.target.result}" class="max-h-48 mx-auto rounded-xl object-contain shadow-md">`;
  };
  reader.readAsDataURL(file);
}

async function handleCreateStory(event) {
  event.preventDefault();
  if (!selectedStoryFile) {
    alert("Please select a story image.");
    return;
  }
  const btn = document.getElementById("create-story-btn");
  const caption = document.getElementById("story-caption").value.trim();

  try {
    btn.disabled = true;
    btn.textContent = "Uploading...";
    const up = await API.upload(selectedStoryFile, "stories");
    await API.post("/api/stories", {
      mediaUrl: up.url,
      caption: caption || null,
    });
    closeModal();
    selectedStoryFile = null;
    showToast("Story Added", "Your 24-hour story is now live!");
    loadStories();
  } catch (err) {
    alert("Story upload failed: " + err.message);
    btn.disabled = false;
    btn.textContent = "Add to Story";
  }
}

function viewStory(author, mediaUrl, caption) {
  const container = document.getElementById("modal-container");
  container.innerHTML = `
    <div class="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-50" onclick="closeModal()">
      <div class="relative max-w-sm w-full bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800" onclick="event.stopPropagation()">
        <div class="absolute top-3 left-3 right-3 flex items-center justify-between text-white z-10 drop-shadow-md">
          <span class="text-xs font-bold">@${escapeHtml(author)}'s Story</span>
          <button onclick="closeModal()" class="text-white hover:text-slate-300"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
        <img src="${escapeHtml(mediaUrl)}" class="w-full h-[450px] object-cover" alt="Story">
        ${caption ? `
          <div class="p-3 bg-black/70 backdrop-blur-sm text-xs text-white text-center">
            ${escapeHtml(caption)}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function openEditProfileModal(displayName, bio, photo) {
  const container = document.getElementById("modal-container");
  container.innerHTML = `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-100">Edit Profile</h3>
          <button onclick="closeModal()" class="text-slate-400 hover:text-slate-200"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
        <form onsubmit="handleUpdateProfile(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Display Name</label>
            <input type="text" id="edit-display-name" value="${escapeHtml(displayName)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-pink-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Bio</label>
            <textarea id="edit-bio" rows="3" placeholder="Tell your classroom about yourself..." class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-pink-500">${escapeHtml(bio)}</textarea>
          </div>
          <div class="flex justify-end space-x-3 pt-2">
            <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400">Cancel</button>
            <button type="submit" class="px-5 py-2 rounded-xl text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white transition">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleUpdateProfile(event) {
  event.preventDefault();
  const displayName = document.getElementById("edit-display-name").value.trim();
  const bio = document.getElementById("edit-bio").value.trim();

  try {
    const res = await API.put("/api/profile", { displayName, bio });
    state.currentUser = res.user;
    closeModal();
    showToast("Profile Updated", "Your profile details have been saved.");
    navigate("profile", state.currentUser.username);
  } catch (err) {
    alert("Update failed: " + err.message);
  }
}

async function openNewChatModal() {
  const container = document.getElementById("modal-container");
  container.innerHTML = `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-100">New Message</h3>
          <button onclick="closeModal()" class="text-slate-400 hover:text-slate-200"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
        <div class="p-4 space-y-3">
          <input type="text" id="new-chat-search" oninput="searchUsersForChat()" placeholder="Search classmate..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-pink-500">
          <div id="new-chat-user-list" class="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-800/40">
            <div class="p-4 text-center text-xs text-slate-500">Loading classmates...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  searchUsersForChat();
}

async function searchUsersForChat() {
  const input = document.getElementById("new-chat-search");
  const list = document.getElementById("new-chat-user-list");
  if (!list) return;

  const q = input ? input.value.trim() : "";
  try {
    let users = [];
    if (q) {
      const data = await API.get(`/api/search?q=${encodeURIComponent(q)}`);
      users = (data.users || []).filter(u => !u.isSelf);
    } else {
      const data = await API.get("/api/users/suggested");
      users = data.users || [];
    }

    if (users.length === 0) {
      list.innerHTML = `<div class="p-4 text-center text-xs text-slate-500">No classmates found.</div>`;
      return;
    }

    list.innerHTML = users.map(u => `
      <div onclick="startChatWith('${u.username}'); closeModal();" class="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-800/60 cursor-pointer transition">
        ${renderAvatar(u.profilePhoto, u.displayName, "w-9 h-9")}
        <div>
          <div class="text-xs font-bold text-slate-100">${escapeHtml(u.displayName)}</div>
          <div class="text-[11px] text-slate-400">@${escapeHtml(u.username)}</div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    list.innerHTML = `<div class="p-3 text-xs text-rose-400">${err.message}</div>`;
  }
}

function closeModal() {
  const container = document.getElementById("modal-container");
  if (container) container.innerHTML = "";
}

// ----------------------------------------------------
// 7. Authentication (Login & Register)
// ----------------------------------------------------

function renderLoginView() {
  return `
    <div class="flex-1 flex items-center justify-center p-4 min-h-screen bg-slate-950">
      <div class="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <!-- Logo -->
        <div class="text-center space-y-2">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 flex items-center justify-center text-white text-3xl mx-auto shadow-xl shadow-pink-500/20">
            <i class="fa-brands fa-instagram"></i>
          </div>
          <h1 class="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">INSTAGROM</h1>
          <p class="text-xs text-slate-400">Classroom LAN Social Network &bull; Python Host</p>
        </div>

        <!-- Login Form -->
        <form onsubmit="handleLogin(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Username</label>
            <input type="text" id="login-username" placeholder="e.g. student_alice" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-pink-500 transition">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">6-Digit Passcode</label>
            <input type="password" id="login-password" maxlength="6" pattern="[0-9]{6}" placeholder="e.g. 123456" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 tracking-widest text-center focus:outline-none focus:border-pink-500 transition font-mono">
            <span class="text-[10px] text-slate-500 mt-1 block text-center">Classroom 6-digit numeric passcode</span>
          </div>

          <div id="login-error" class="hidden text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center"></div>

          <button type="submit" id="login-btn" class="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-pink-500/25 transition">
            Log In
          </button>
        </form>

        <!-- Register Switch -->
        <div class="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
          Don't have a classroom account?
          <button onclick="navigate('register')" class="text-pink-400 font-bold hover:underline ml-1">Create Account</button>
        </div>
      </div>
    </div>
  `;
}

function renderRegisterView() {
  return `
    <div class="flex-1 flex items-center justify-center p-4 min-h-screen bg-slate-950">
      <div class="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <!-- Logo -->
        <div class="text-center space-y-2">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 to-amber-500 flex items-center justify-center text-white text-3xl mx-auto shadow-xl shadow-pink-500/20">
            <i class="fa-brands fa-instagram"></i>
          </div>
          <h1 class="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-pink-500 to-amber-400 bg-clip-text text-transparent">INSTAGROM</h1>
          <p class="text-xs text-slate-400">Join your classroom social network</p>
        </div>

        <!-- Register Form -->
        <form onsubmit="handleRegister(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Username</label>
            <input type="text" id="reg-username" placeholder="e.g. alice_cooper" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-pink-500">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Full Name / Display Name</label>
            <input type="text" id="reg-display-name" placeholder="e.g. Alice Cooper" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-pink-500">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">6-Digit Passcode</label>
              <input type="password" id="reg-password" maxlength="6" pattern="[0-9]{6}" placeholder="123456" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 tracking-widest text-center font-mono focus:outline-none focus:border-pink-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Confirm Passcode</label>
              <input type="password" id="reg-confirm-password" maxlength="6" pattern="[0-9]{6}" placeholder="123456" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 tracking-widest text-center font-mono focus:outline-none focus:border-pink-500">
            </div>
          </div>

          <div id="reg-error" class="hidden text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center"></div>

          <button type="submit" id="reg-btn" class="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-amber-500 hover:from-pink-500 hover:to-amber-400 text-white font-bold text-sm shadow-lg shadow-pink-500/25 transition">
            Create Account
          </button>
        </form>

        <div class="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
          Already have an account?
          <button onclick="navigate('login')" class="text-pink-400 font-bold hover:underline ml-1">Log In</button>
        </div>
      </div>
    </div>
  `;
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const errEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");

  try {
    errEl.classList.add("hidden");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Logging in...`;

    const res = await API.post("/api/auth/login", { username, password });
    state.currentUser = res.user;
    initRealtime();
    loadUnreadCounts();
    navigate("feed");
  } catch (err) {
    errEl.textContent = err.message || "Invalid username or passcode";
    errEl.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Log In";
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const displayName = document.getElementById("reg-display-name").value.trim();
  const password = document.getElementById("reg-password").value.trim();
  const confirmPassword = document.getElementById("reg-confirm-password").value.trim();
  const errEl = document.getElementById("reg-error");
  const btn = document.getElementById("reg-btn");

  if (password !== confirmPassword) {
    errEl.textContent = "Passcodes do not match.";
    errEl.classList.remove("hidden");
    return;
  }

  try {
    errEl.classList.add("hidden");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Creating account...`;

    const res = await API.post("/api/auth/register", {
      username,
      displayName,
      password,
      confirmPassword,
    });
    state.currentUser = res.user;
    initRealtime();
    loadUnreadCounts();
    navigate("feed");
  } catch (err) {
    errEl.textContent = err.message || "Failed to register";
    errEl.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

async function logout() {
  try {
    await API.post("/api/auth/logout");
  } catch (e) {}
  state.currentUser = null;
  if (state.sseSource) {
    state.sseSource.close();
  }
  navigate("login");
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", initApp);
