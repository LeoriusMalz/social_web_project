const dialogsViewEl = document.getElementById('dialogs-view');
const chatViewEl = document.getElementById('chat-view');
const dialogsListEl = document.getElementById('dialogs-list');
const searchInputEl = document.getElementById('messages-search-input');
const searchResultsEl = document.getElementById('search-results');
const chatHeaderEl = document.getElementById('chat-header');
const chatListEl = document.getElementById('chat-list');
const composeInputEl = document.getElementById('compose-input');
const sendBtnEl = document.getElementById('send-btn');
const composeContextEl = document.getElementById('compose-context');

let dialogsOffset = 0;
let dialogsDone = false;
let dialogsLoading = false;
let dialogs = [];
let searchTimer = null;
let ws = null;
let currentChat = null;
let messageBeforeId = null;
let messageAfterId = null;
let loadingOlder = false;
let loadingNewer = false;
let composeMode = null; // {type:'edit'|'reply', message}
let lastReadUptoByChat = new Map();
let wsRefreshTimer = null;

function fullName(u) { return `${u.surname} ${u.name}`.trim(); }
function initials(u) { return `${u.name?.[0] || ''}${u.surname?.[0] || ''}`.toUpperCase(); }
function avatarUrl(u) { return u.has_avatar || u.peer_has_avatar || u.sender_has_avatar ? `/api/users/${u.id || u.peer_id || u.sender_id}/avatar` : null; }
function escapeHtml(str) { return (str || '').replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

function formatDialogTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
  return d.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit', year: '2-digit'});
}

function formatMessageTime(iso) {
  return new Date(iso).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
}

function api(url, options = {}) {
  return fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
}

async function loadDialogs(reset = false) {
  if (dialogsLoading) return;
  if (!reset && dialogsDone) return;
  dialogsLoading = true;
  const offset = reset ? 0 : dialogsOffset;
  try {
    const r = await api(`/api/messages/dialogs?limit=20&offset=${offset}`);
    if (!r.ok) return;
    const items = await r.json();
    if (reset) dialogs = [];
    dialogs.push(...items);
    dialogsOffset = dialogs.length;
    dialogsDone = items.length < 20;
    renderDialogs();
  } finally {
    dialogsLoading = false;
  }
}

function upsertDialogLocal(dialog) {
  const idx = dialogs.findIndex((d) => d.chat_id === dialog.chat_id);
  if (idx >= 0) dialogs.splice(idx, 1);
  dialogs.unshift(dialog);
  renderDialogs();
}

function dialogIndicator(dialog) {
  if (dialog.last_sender_id !== currentUserId && dialog.unread_count > 0) return '<span class="unread-dot"></span>';
  if (dialog.last_sender_id === currentUserId) {
    if (dialog.send_failed) return '<span class="unread-danger">!</span>';
    return dialog.last_my_message_seen_by_anyone ? '✓✓' : '✓';
  }
  return '';
}

function renderDialogs() {
  dialogsListEl.innerHTML = '';
  if (!dialogs.length) {
    dialogsListEl.innerHTML = '<div class="empty-state">Диалогов нет</div>';
    return;
  }

  dialogs.forEach((d) => {
    const el = document.createElement('div');
    el.className = 'dialog-item';
    el.dataset.chatId = d.chat_id;
    const name = `${d.peer_surname} ${d.peer_name}`;
    const avatar = d.peer_has_avatar ? `<img src="/api/users/${d.peer_id}/avatar" alt="${escapeHtml(name)}">` : escapeHtml(initials({name:d.peer_name, surname:d.peer_surname}));
    const snippet = d.last_sender_id === currentUserId ? `Вы: ${d.last_message}` : d.last_message;

    el.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="dialog-main">
        <div class="dialog-top"><div class="dialog-name">${escapeHtml(name)}</div><div class="dialog-time">${formatDialogTime(d.last_message_sent_at)}</div></div>
        <div class="dialog-snippet">${escapeHtml(snippet)}</div>
      </div>
      <div class="dialog-indicator">${dialogIndicator(d)}</div>
    `;

    el.addEventListener('click', () => openChat(d.chat_id));
    dialogsListEl.appendChild(el);
  });
}

async function renderSearch(query) {
  const q = query.trim();
  if (!q) {
    searchResultsEl.classList.add('hidden');
    searchResultsEl.innerHTML = '';
    return;
  }
  const r = await api(`/api/messages/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) return;
  const users = await r.json();
  searchResultsEl.classList.remove('hidden');
  searchResultsEl.innerHTML = '';

  const withDialogs = users.filter((u) => u.has_dialog);
  const onlyFriends = users.filter((u) => !u.has_dialog);

  if (!withDialogs.length && !onlyFriends.length) {
    searchResultsEl.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
    return;
  }

  searchResultsEl.appendChild(createLabel('Диалоги'));
  withDialogs.forEach((u) => searchResultsEl.appendChild(createSearchUser(u)));
  if (onlyFriends.length) {
    searchResultsEl.appendChild(createLabel('Друзья'));
    onlyFriends.forEach((u) => searchResultsEl.appendChild(createSearchUser(u)));
  }
  searchResultsEl.appendChild(document.createElement('hr'));
}

function createLabel(text) {
  const el = document.createElement('div');
  el.className = 'section-label';
  el.textContent = text;
  return el;
}

function createSearchUser(u) {
  const el = document.createElement('div');
  el.className = 'search-item';
  const name = fullName(u);
  const av = u.has_avatar ? `<img src="/api/users/${u.id}/avatar" alt="${escapeHtml(name)}">` : escapeHtml(initials(u));
  el.innerHTML = `<div class="avatar">${av}</div><div>${escapeHtml(name)}</div>`;
  el.addEventListener('click', async () => {
    if (u.has_dialog) {
      const existing = dialogs.find((d) => d.peer_id === u.id);
      if (existing) {
        await openChat(existing.chat_id);
        return;
      }
    }

    await openOrCreateDialogWithUser(u.id);
  });
  return el;
}

async function openChat(chatId) {
  const infoRes = await api(`/api/messages/dialogs/${chatId}`);
  if (!infoRes.ok) return;
  const info = await infoRes.json();
  currentChat = info;
  messageBeforeId = null;
  messageAfterId = null;

  dialogsViewEl.classList.add('hidden');
  chatViewEl.classList.remove('hidden');

  const peerName = `${info.peer.surname} ${info.peer.name}`;
  chatHeaderEl.innerHTML = `
    <button class="back-btn" id="back-btn">✕</button>
    <a class="peer-link" href="/id${info.peer.id}">
      <div class="avatar">${info.peer.has_avatar ? `<img src="/api/users/${info.peer.id}/avatar" alt="${escapeHtml(peerName)}">` : escapeHtml(initials(info.peer))}</div>
      <div>${escapeHtml(peerName)}</div>
    </a>`;

  document.getElementById('back-btn').addEventListener('click', closeChat);

  chatListEl.innerHTML = '';
  const batch = await loadInitialMessages(info.chat_id, info.first_unread_msg_id);
  renderMessages(batch.items, true, info.first_unread_msg_id);
  await fillChatViewport(info.chat_id);
}

function closeChat() {
  currentChat = null;
  chatViewEl.classList.add('hidden');
  dialogsViewEl.classList.remove('hidden');
  loadDialogs(true);
}

async function loadInitialMessages(chatId, firstUnreadId) {
  if (firstUnreadId && firstUnreadId > 1) {
    const r = await api(`/api/messages/dialogs/${chatId}/messages?after_id=${firstUnreadId - 1}&limit=20`);
    return r.json();
  }
  const r = await api(`/api/messages/dialogs/${chatId}/messages?limit=20`);
  return r.json();
}

async function fillChatViewport(chatId) {
  // Если новых сообщений мало, добираем историю сверху, чтобы экран был заполнен.
  while (chatListEl.scrollHeight <= chatListEl.clientHeight + 8 && messageBeforeId) {
    const r = await api(`/api/messages/dialogs/${chatId}/messages?before_id=${messageBeforeId}&limit=20`);
    if (!r.ok) {
      return;
    }
    const data = await r.json();
    if (!data.items.length) {
      return;
    }

    const previousHeight = chatListEl.scrollHeight;
    const frag = document.createDocumentFragment();
    let prevDate = null;
    const firstUnread = currentChat?.first_unread_msg_id || null;
    data.items.forEach((m) => {
      const currentDate = new Date(m.sent_at).toDateString();
      if (currentDate !== prevDate) {
        const dateEl = document.createElement('div');
        dateEl.className = 'date-separator';
        dateEl.textContent = dateSeparatorText(m.sent_at);
        frag.appendChild(dateEl);
        prevDate = currentDate;
      }
      if (firstUnread && m.msg_id === firstUnread) {
        const unreadEl = document.createElement('div');
        unreadEl.className = 'new-separator';
        unreadEl.textContent = 'Новые сообщения';
        frag.appendChild(unreadEl);
      }
      frag.appendChild(createMessageEl(m));
    });
    chatListEl.prepend(frag);
    messageBeforeId = data.items[0].msg_id;
    chatListEl.scrollTop = chatListEl.scrollHeight - previousHeight + chatListEl.scrollTop;
  }
}

function dateSeparatorText(date) {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderMessages(items, replace = false, firstUnreadId = null) {
  if (replace) chatListEl.innerHTML = '';
  if (!items.length && replace) {
    chatListEl.innerHTML = '<div class="empty-state">Сообщений пока нет</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  let prevDate = null;
  items.forEach((m) => {
    const currentDate = new Date(m.sent_at).toDateString();
    if (currentDate !== prevDate) {
      const dateEl = document.createElement('div');
      dateEl.className = 'date-separator';
      dateEl.textContent = dateSeparatorText(m.sent_at);
      frag.appendChild(dateEl);
      prevDate = currentDate;
    }

    if (firstUnreadId && m.msg_id === firstUnreadId) {
      const unreadEl = document.createElement('div');
      unreadEl.className = 'new-separator';
      unreadEl.textContent = 'Новые сообщения';
      frag.appendChild(unreadEl);
    }

    frag.appendChild(createMessageEl(m));
  });

  chatListEl.appendChild(frag);
  messageBeforeId = Number(chatListEl.querySelector('.message-item')?.dataset.msgId || messageBeforeId);
  messageAfterId = items[items.length - 1]?.msg_id || messageAfterId;
  setTimeout(() => {
    chatListEl.scrollTop = chatListEl.scrollHeight;
    markVisibleAsRead();
  }, 0);
}

function createMessageEl(m) {
  const own = m.sender_id === currentUserId;
  const el = document.createElement('div');
  el.className = `message-item ${own ? 'own-message' : 'foreign-message'}`;
  el.dataset.msgId = m.msg_id;

  const av = m.sender_has_avatar ? `<img src="/api/users/${m.sender_id}/avatar" alt="">` : escapeHtml(initials({name:m.sender_name, surname:m.sender_surname}));
  const readIndicator = own ? (m.read_by_anyone ? '✓✓' : '✓') : '';
  const readIndicatorValue = m.read_by_anyone ? 'Прочитано' : 'Не прочитано';

  const editedBlock = m.updated_at ? `<div class="message-edited" title="${new Date(m.updated_at).toLocaleString('ru-RU')}">Отредактировано</div>` : '';
  const replyBlock = m.reply_msg_id ? `
    <div class="message-reply" data-jump-id="${m.reply_msg_id}">
      <div><b>${escapeHtml(`${m.reply_sender_surname || ''} ${m.reply_sender_name || ''}`.trim())}</b></div>
      <div>${escapeHtml(m.reply_content || 'Сообщение удалено')}</div>
    </div>` : '';

  const actions = own
    ? `<div class="message-actions">
        <button data-action="edit" title="Редактировать">✎</button>
        <button data-action="delete" title="Удалить">🗑</button>
       </div>`
    : `<div class="message-actions"><button data-action="reply" title="Ответить">↩</button></div>`;

  el.innerHTML = `
    <a class="avatar" href="/id${m.sender_id}">${av}</a>
    <div class="message-content">
      <div class="message-top">
        <div class="message-name">${escapeHtml(`${m.sender_surname} ${m.sender_name}`)}</div>
        <div class="message-time">
          <span title="${readIndicatorValue}">${readIndicator}</span>
          <span>${formatMessageTime(m.sent_at)}</span>
        </div>
      </div>
      ${replyBlock}
      <div class="message-body">${escapeHtml(m.content)}</div>
      ${editedBlock}
      ${actions}
    </div>
  `;

  el.querySelectorAll('[data-jump-id]').forEach((node) => node.addEventListener('click', () => jumpToMessage(Number(node.dataset.jumpId))));

  el.querySelectorAll('.message-actions button').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'delete') await handleDeleteMessage(m);
      if (action === 'edit') enterComposeMode('edit', m);
      if (action === 'reply') enterComposeMode('reply', m);
    });
  });

  return el;
}

async function handleDeleteMessage(message) {
  if (!window.confirm('Удалить сообщение?')) return;
  const r = await api(`/api/messages/messages/${message.msg_id}`, { method: 'DELETE' });
  if (r.ok) reloadCurrentChat();
}

function enterComposeMode(type, message) {
  composeMode = { type, message };
  const title = type === 'edit' ? 'Редактирование сообщения' : 'Ответ на сообщение';
  composeContextEl.classList.remove('hidden');
  composeContextEl.innerHTML = `
    <div class="compose-context-text" id="compose-context-jump">
      <div class="context-title">${title}</div>
      <div>${escapeHtml(message.content)}</div>
    </div>
    <button class="back-btn" id="compose-context-close">✕</button>`;

  document.getElementById('compose-context-close').addEventListener('click', clearComposeMode);
  document.getElementById('compose-context-jump').addEventListener('click', () => jumpToMessage(message.msg_id));

  composeInputEl.value = type === 'edit' ? message.content : composeInputEl.value;
  autoGrow();
  toggleSendButton();
}

function clearComposeMode() {
  composeMode = null;
  composeContextEl.classList.add('hidden');
  composeContextEl.innerHTML = '';
  composeInputEl.value = '';
  toggleSendButton();
  autoGrow();
}

async function sendMessage() {
  const text = composeInputEl.value.trim();
  if (!text || !currentChat) return;

  if (composeMode?.type === 'edit') {
    const r = await api(`/api/messages/messages/${composeMode.message.msg_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: text }),
    });
    if (r.ok) {
      clearComposeMode();
      await reloadCurrentChat();
    }
    return;
  }

  const payload = { content: text };
  if (composeMode?.type === 'reply') payload.reply_msg_id = composeMode.message.msg_id;

  const peerId = currentChat.peer.id;
  const ok = await sendMessageToUser(peerId, payload.content, payload.reply_msg_id);
  if (ok) {
    clearComposeMode();
    await reloadCurrentChat();
  }
}

async function sendMessageToUser(userId, content, replyMsgId = null) {
  const r = await api(`/api/messages/dialogs/by-user/${userId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, reply_msg_id: replyMsgId }),
  });
  if (!r.ok) return false;
  const data = await r.json();
  if (!currentChat || currentChat.chat_id !== data.chat_id) {
    await openChat(data.chat_id);
  }
  return true;
}

async function reloadCurrentChat() {
  if (!currentChat) return;
  const infoRes = await api(`/api/messages/dialogs/${currentChat.chat_id}`);
  if (!infoRes.ok) return;
  const info = await infoRes.json();
  currentChat = info;
  const r = await api(`/api/messages/dialogs/${currentChat.chat_id}/messages?limit=50`);
  if (!r.ok) return;
  const batch = await r.json();
  renderMessages(batch.items, true, info.first_unread_msg_id);
  await loadDialogs(true);
}

async function loadOlderMessages() {
  if (loadingOlder || !currentChat || !messageBeforeId) return;
  loadingOlder = true;
  const previousHeight = chatListEl.scrollHeight;
  const r = await api(`/api/messages/dialogs/${currentChat.chat_id}/messages?before_id=${messageBeforeId}&limit=20`);
  if (r.ok) {
    const data = await r.json();
    if (data.items.length) {
      const oldScroll = chatListEl.scrollTop;
      const firstUnread = currentChat?.first_unread_msg_id || null;
      const frag = document.createDocumentFragment();
      let prevDate = null;
      data.items.forEach((m) => {
        const currentDate = new Date(m.sent_at).toDateString();
        if (currentDate !== prevDate) {
          const dateEl = document.createElement('div');
          dateEl.className = 'date-separator';
          dateEl.textContent = dateSeparatorText(m.sent_at);
          frag.appendChild(dateEl);
          prevDate = currentDate;
        }
        if (firstUnread && m.msg_id === firstUnread) {
          const unreadEl = document.createElement('div');
          unreadEl.className = 'new-separator';
          unreadEl.textContent = 'Новые сообщения';
          frag.appendChild(unreadEl);
        }
        frag.appendChild(createMessageEl(m));
      });
      chatListEl.prepend(frag);
      messageBeforeId = data.items[0].msg_id;
      chatListEl.scrollTop = chatListEl.scrollHeight - previousHeight + oldScroll;
    }
  }
  loadingOlder = false;
}

async function markVisibleAsRead() {
  if (!currentChat) return;
  const messages = [...chatListEl.querySelectorAll('.foreign-message')];
  let maxVisible = 0;
  const containerRect = chatListEl.getBoundingClientRect();
  for (const el of messages) {
    const rect = el.getBoundingClientRect();
    if (rect.top >= containerRect.top && rect.bottom <= containerRect.bottom) {
      maxVisible = Math.max(maxVisible, Number(el.dataset.msgId));
    }
  }
  if (maxVisible > 0) {
    const previous = lastReadUptoByChat.get(currentChat.chat_id) || 0;
    if (maxVisible <= previous) return;
    await api(`/api/messages/dialogs/${currentChat.chat_id}/read`, {
      method: 'POST',
      body: JSON.stringify({ upto_msg_id: maxVisible }),
    });
    lastReadUptoByChat.set(currentChat.chat_id, maxVisible);
  }
}

function jumpToMessage(msgId) {
  const el = chatListEl.querySelector(`.message-item[data-msg-id="${msgId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function autoGrow() {
  composeInputEl.style.height = 'auto';
  composeInputEl.style.height = `${Math.min(composeInputEl.scrollHeight, 140)}px`;
}

function toggleSendButton() {
  if (composeInputEl.value.trim()) sendBtnEl.classList.remove('hidden');
  else sendBtnEl.classList.add('hidden');
}


async function openOrCreateDialogWithUser(userId) {
  const r = await api(`/api/messages/dialogs/by-user/${userId}`, { method: 'POST' });
  if (!r.ok) return;
  const data = await r.json();
  if (data.chat_id) {
    await openChat(data.chat_id);
  }
}

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${window.location.host}/api/messages/ws`);
  ws.onmessage = async (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === 'pong') return;

    if (payload.type === 'message:read' && payload.reader_id === currentUserId) {
      return;
    }

    if (wsRefreshTimer) {
      clearTimeout(wsRefreshTimer);
    }

    wsRefreshTimer = setTimeout(async () => {
      await loadDialogs(true);
      if (currentChat && payload.chat_id === currentChat.chat_id) {
        await reloadCurrentChat();
      }
    }, 80);
  };
  ws.onclose = () => setTimeout(initWebSocket, 1500);
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
  }, 15000);
}

searchInputEl.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const value = e.target.value;
  searchTimer = setTimeout(() => renderSearch(value), 160);
});

dialogsListEl.addEventListener('scroll', async () => {
  if (dialogsListEl.scrollTop + dialogsListEl.clientHeight >= dialogsListEl.scrollHeight - 30) {
    await loadDialogs(false);
  }
});

chatListEl.addEventListener('scroll', async () => {
  if (chatListEl.scrollTop <= 30) await loadOlderMessages();
  await markVisibleAsRead();
});

composeInputEl.addEventListener('input', () => {
  autoGrow();
  toggleSendButton();
});

composeInputEl.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    await sendMessage();
  }
});

sendBtnEl.addEventListener('click', async () => sendMessage());

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarNav({ currentUserId });
  await loadDialogs(true);

  const params = new URLSearchParams(window.location.search);
  const chatWithUser = Number(params.get('chat_with'));
  if (chatWithUser > 0) {
    await openOrCreateDialogWithUser(chatWithUser);
  }

  initWebSocket();
});
