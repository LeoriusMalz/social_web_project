const dialogsViewEl = document.getElementById('dialogs-view');
const chatViewEl = document.getElementById('chat-view');
const dialogsListEl = document.getElementById('dialogs-list');
const searchInputEl = document.getElementById('messages-search-input');
const searchResultsEl = document.getElementById('search-results');
const chatHeaderEl = document.getElementById('chat-header');
const chatListEl = document.getElementById('chat-list');
const jumpToBottomBtnEl = document.getElementById('jump-to-bottom-btn');
const composeInputEl = document.getElementById('compose-input');
const sendBtnEl = document.getElementById('send-btn');
const composeContextEl = document.getElementById('compose-context');
const createChatBtnEl = document.getElementById('create-chat-btn');
const createGroupViewEl = document.getElementById('create-group-view');
const groupCreateBackBtnEl = document.getElementById('group-create-back-btn');
const groupAvatarBtnEl = document.getElementById('group-avatar-btn');
const groupAvatarFileEl = document.getElementById('group-avatar-file');
const groupAvatarDeleteBtnEl = document.getElementById('group-avatar-delete-btn');
const groupTitleInputEl = document.getElementById('group-title-input');
const groupFriendsSearchInputEl = document.getElementById('group-friends-search-input');
const groupFriendsListEl = document.getElementById('group-friends-list');
const createGroupSubmitBtnEl = document.getElementById('create-group-submit-btn');
const chatInfoModalEl = document.getElementById('chat-info-modal');
const chatInfoBackBtnEl = document.getElementById('chat-info-back-btn');
const chatInfoAvatarEl = document.getElementById('chat-info-avatar');
const chatInfoAvatarFileEl = document.getElementById('chat-info-avatar-file');
const chatInfoAvatarDeleteBtnEl = document.getElementById('chat-info-avatar-delete-btn');
const chatInfoAvatarWrapEl = document.querySelector('.chat-info-avatar-wrap');
const chatInfoTitleEl = document.getElementById('chat-info-title');
const chatInfoTitleInputEl = document.getElementById('chat-info-title-input');
const chatInfoTitleSaveBtnEl = document.getElementById('chat-info-title-save-btn');
const chatInfoCountEl = document.getElementById('chat-info-count');
const leaveChatBtnEl = document.getElementById('leave-chat-btn');
const addMembersBtnEl = document.getElementById('add-members-btn');
const chatParticipantsListEl = document.getElementById('chat-participants-list');

let dialogsOffset = 0;
let dialogsDone = false;
let dialogsLoading = false;
let dialogs = [];
let searchTimer = null;
let groupFriendsSearchTimer = null;

const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 500;
let ws = null;
let currentChat = null;
let messageBeforeId = null;
let messageAfterId = null;
let loadingOlder = false;
let loadingNewer = false;
let reachedHistoryStart = false;
let newMessagesBelow = 0;
let composeMode = null; // {type:'edit'|'reply', message}
let lastReadUptoByChat = new Map();
let wsRefreshTimer = null;
let allFriendsCache = [];
let selectedGroupMemberIds = new Set();
let groupAvatarFile = null;
let participantsCache = [];
let groupBuilderMode = 'create';

const MESSAGE_DRAFT_KEY_PREFIX = `messages:draft:${currentUserId}:`;

const groupAvatarWrapEl = document.querySelector('.group-avatar-wrap');
const groupTitleWrapEl = document.querySelector('.group-title-wrap');

function fullName(u) { return `${u.surname} ${u.name}`.trim(); }
function initials(u) { return `${u.name?.[0] || ''}${u.surname?.[0] || ''}`.toUpperCase(); }
function avatarUrl(u) { return u.has_avatar || u.peer_has_avatar || u.sender_has_avatar ? `/api/users/${u.id || u.peer_id || u.sender_id}/avatar` : null; }
function escapeHtml(str) { return (str || '').replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

function draftKey(chatId) {
  return `${MESSAGE_DRAFT_KEY_PREFIX}${chatId}`;
}

function getDraft(chatId) {
  return localStorage.getItem(draftKey(chatId)) || '';
}

function saveDraft(chatId, value) {
  if (!chatId) return;
  if (value) localStorage.setItem(draftKey(chatId), value);
  else localStorage.removeItem(draftKey(chatId));
}

function saveCurrentDraft() {
  if (!currentChat || composeMode?.type === 'edit') return;
  saveDraft(currentChat.chat_id, composeInputEl.value);
}

function discardDraft(chatId) {
  localStorage.removeItem(draftKey(chatId));
}

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
    const isGroup = Number(d.type_id) === 1;
    const name = isGroup ? (d.title || 'Без названия') : `${d.peer_surname} ${d.peer_name}`;
    const avatar = isGroup
      ? (d.chat_has_avatar ? `<img src="/api/messages/dialogs/${d.chat_id}/avatar" alt="${escapeHtml(name)}">` : escapeHtml((d.title || '?')[0].toUpperCase()))
      : (d.peer_has_avatar ? `<img src="/api/users/${d.peer_id}/avatar" alt="${escapeHtml(name)}">` : escapeHtml(initials({name:d.peer_name, surname:d.peer_surname})));
    const senderPrefix = isGroup && d.last_sender_id !== currentUserId ? `${(d.sender_name || '').trim()} ${(d.sender_surname || '').trim().slice(0,1)}.: ` : '';
    const snippet = d.last_sender_id === currentUserId ? `Вы: ${d.last_message}` : `${senderPrefix}${d.last_message}`;

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
  searchResultsEl.classList.remove('hidden');
  searchResultsEl.innerHTML = '';
  if (q.length < MIN_SEARCH_LENGTH) {
    searchResultsEl.innerHTML = `<div class="empty-state">Введите минимум ${MIN_SEARCH_LENGTH} символа для поиска</div>`;
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
  saveCurrentDraft();
  const infoRes = await api(`/api/messages/dialogs/${chatId}`);
  if (!infoRes.ok) return;
  const info = await infoRes.json();
  currentChat = info;
  composeMode = null;
  composeContextEl.classList.add('hidden');
  composeContextEl.innerHTML = '';
  messageBeforeId = null;
  messageAfterId = null;
  reachedHistoryStart = false;
  newMessagesBelow = 0;

  dialogsViewEl.classList.add('hidden');
  chatViewEl.classList.remove('hidden');

  if (Number(info.type_id) === 1) {
    const groupTitle = info.title || 'Без названия';
    const groupAvatar = info.has_avatar ? `<img src="/api/messages/dialogs/${info.chat_id}/avatar" alt="${escapeHtml(groupTitle)}">` : escapeHtml(groupTitle[0]?.toUpperCase() || '?');
    chatHeaderEl.innerHTML = `
      <button class="back-btn" id="back-btn">✕</button>
      <div class="peer-link">
        <div class="avatar">${groupAvatar}</div>
        <div class="peer-link__meta">
          <div class="peer-link__title">${escapeHtml(groupTitle)}</div>
          <div class="dialog-snippet">${Number(info.participant_count || 0)} участник(ов)</div>
        </div>
      </div>`;
    chatHeaderEl.querySelector('.peer-link').addEventListener('click', openChatInfoModal);
  } else {
    const peerName = `${info.peer.surname} ${info.peer.name}`;
    chatHeaderEl.innerHTML = `
      <button class="back-btn" id="back-btn">✕</button>
      <a class="peer-link" href="/id${info.peer.id}">
        <div class="avatar">${info.peer.has_avatar ? `<img src="/api/users/${info.peer.id}/avatar" alt="${escapeHtml(peerName)}">` : escapeHtml(initials(info.peer))}</div>
        <div class="peer-link__meta">
          <div class="peer-link__title">${escapeHtml(peerName)}</div>
        </div>
      </a>`;
  }

  document.getElementById('back-btn').addEventListener('click', closeChat);
  updateComposeAvailability();
  composeInputEl.value = getDraft(info.chat_id);
  autoGrow();
  toggleSendButton();

  chatListEl.innerHTML = '';
  const batch = await loadInitialMessages(info.chat_id, info.first_unread_msg_id);
  renderMessages(batch.items, true, info.first_unread_msg_id);
  await fillChatViewport(info.chat_id);
}

function closeChat() {
  saveCurrentDraft();
  currentChat = null;
  newMessagesBelow = 0;
  chatViewEl.classList.add('hidden');
  dialogsViewEl.classList.remove('hidden');
  updateJumpToBottomButton();
  loadDialogs(true);
}

async function loadInitialMessages(chatId, firstUnreadId) {
  if (firstUnreadId && firstUnreadId > 1) {
    const [beforeRes, afterRes] = await Promise.all([
      api(`/api/messages/dialogs/${chatId}/messages?before_id=${firstUnreadId}&limit=20`),
      api(`/api/messages/dialogs/${chatId}/messages?after_id=${firstUnreadId - 1}&limit=20`),
    ]);
    const beforeData = beforeRes.ok ? await beforeRes.json() : { items: [] };
    const afterData = afterRes.ok ? await afterRes.json() : { items: [] };
    const merged = [...beforeData.items, ...afterData.items].reduce((acc, m) => {
      if (!acc.some((x) => x.msg_id === m.msg_id)) acc.push(m);
      return acc;
    }, []);
    return { items: merged.slice(-40) };
  }
  const r = await api(`/api/messages/dialogs/${chatId}/messages?limit=20`);
  const data = await r.json();
  return { ...data, items: toDatePack(data.items, 'latest') };
}

async function fillChatViewport(chatId) {
  // Если новых сообщений мало, добираем историю сверху, чтобы экран был заполнен.
  let fillAttempts = 0;
  while (chatListEl.scrollHeight <= chatListEl.clientHeight + 8 && messageBeforeId && !reachedHistoryStart && fillAttempts < 4) {
    fillAttempts += 1;
    const r = await api(`/api/messages/dialogs/${chatId}/messages?before_id=${messageBeforeId}&limit=20`);
    if (!r.ok) {
      return;
    }
    const data = await r.json();
    const pack = toDatePack(data.items, 'latest');
    if (!pack.length) {
      reachedHistoryStart = true;
      messageBeforeId = null;
      return;
    }

    const previousHeight = chatListEl.scrollHeight;
    const frag = document.createDocumentFragment();
    let prevDate = null;
    const firstUnread = currentChat?.first_unread_msg_id || null;
    pack.forEach((m) => {
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
    messageBeforeId = pack[0].msg_id;
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

function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function toDatePack(items, mode = 'latest') {
  if (!items.length) return [];
  const anchor = mode === 'oldest' ? items[0].sent_at : items[items.length - 1].sent_at;
  const sameDateItems = items.filter((m) => sameDay(m.sent_at, anchor));
  if (mode === 'oldest') return sameDateItems.slice(0, 20);
  return sameDateItems.slice(-20);
}

function isNearBottom() {
  const threshold = 36;
  return chatListEl.scrollHeight - chatListEl.scrollTop - chatListEl.clientHeight <= threshold;
}

function resetNewMessagesBelow() {
  newMessagesBelow = 0;
  updateJumpToBottomButton();
}

function updateJumpToBottomButton() {
  if (!currentChat) {
    jumpToBottomBtnEl.classList.add('hidden');
    return;
  }
  const show = !isNearBottom() || newMessagesBelow > 0;
  if (!show) {
    jumpToBottomBtnEl.classList.add('hidden');
    jumpToBottomBtnEl.textContent = '↓';
    return;
  }
  jumpToBottomBtnEl.classList.remove('hidden');
  jumpToBottomBtnEl.textContent = newMessagesBelow > 0 ? String(newMessagesBelow) : '↓';
}

function normalizeDateSeparators() {
  const children = [...chatListEl.children];
  children.forEach((node, idx) => {
    if (!node.classList || !node.classList.contains('date-separator')) return;

    let prevMsgDate = null;
    let nextMsgDate = null;

    for (let i = idx - 1; i >= 0; i -= 1) {
      if (children[i].classList?.contains('message-item')) {
        prevMsgDate = new Date(children[i].dataset.sentAt).toDateString();
        break;
      }
    }
    for (let i = idx + 1; i < children.length; i += 1) {
      if (children[i].classList?.contains('message-item')) {
        nextMsgDate = new Date(children[i].dataset.sentAt).toDateString();
        break;
      }
    }

    if (!nextMsgDate || prevMsgDate === nextMsgDate) {
      node.remove();
    }
  });
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
  normalizeDateSeparators();
  messageBeforeId = Number(chatListEl.querySelector('.message-item')?.dataset.msgId || messageBeforeId);
  messageAfterId = items[items.length - 1]?.msg_id || messageAfterId;
  setTimeout(() => {
    chatListEl.scrollTop = chatListEl.scrollHeight;
    resetNewMessagesBelow();
    markVisibleAsRead();
  }, 0);
}

function createMessageEl(m) {
  if (m.is_system) {
    const sys = document.createElement('div');
    const ownSystem = Number(m.sender_id) === Number(currentUserId);
    sys.className = `system-message message-item ${ownSystem ? 'own-message' : 'foreign-message'}`;
    sys.dataset.msgId = m.msg_id;
    sys.dataset.sentAt = m.sent_at;
    sys.title = new Date(m.sent_at).toLocaleString('ru-RU');
    sys.textContent = m.content;
    return sys;
  }

  const own = m.sender_id === currentUserId;
  const el = document.createElement('div');
  el.className = `message-item ${own ? 'own-message' : 'foreign-message'}`;
  el.dataset.msgId = m.msg_id;
  el.dataset.sentAt = m.sent_at;

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

function appendMessages(items, firstUnreadId = null) {
  if (!items.length) return;

  const frag = document.createDocumentFragment();
  const lastRendered = chatListEl.querySelector('.message-item:last-of-type');
  let prevDate = lastRendered ? new Date(lastRendered.dataset.sentAt).toDateString() : null;

  items.forEach((m) => {
    if (chatListEl.querySelector(`.message-item[data-msg-id="${m.msg_id}"]`)) {
      return;
    }
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

  if (!frag.childNodes.length) return;
  chatListEl.appendChild(frag);
  normalizeDateSeparators();
  messageAfterId = items[items.length - 1]?.msg_id || messageAfterId;
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

  const ok = Number(currentChat.type_id) === 1
    ? await sendMessageToChat(currentChat.chat_id, payload.content, payload.reply_msg_id)
    : await sendMessageToUser(currentChat.peer.id, payload.content, payload.reply_msg_id);
  if (ok) {
    discardDraft(currentChat.chat_id);
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



async function sendMessageToChat(chatId, content, replyMsgId = null) {
  const r = await api(`/api/messages/dialogs/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, reply_msg_id: replyMsgId }),
  });
  return r.ok;
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
  reachedHistoryStart = false;
  renderMessages(toDatePack(batch.items, 'latest'), true, info.first_unread_msg_id);
  await fillChatViewport(currentChat.chat_id);
  await loadDialogs(true);
}

async function loadNewMessages() {
  if (!currentChat || !messageAfterId) return;
  const wasNearBottom = isNearBottom();
  const r = await api(`/api/messages/dialogs/${currentChat.chat_id}/messages?after_id=${messageAfterId}&limit=50`);
  if (!r.ok) return;
  const data = await r.json();
  if (!data.items.length) return;
  appendMessages(data.items, currentChat.first_unread_msg_id);
  if (wasNearBottom) {
    chatListEl.scrollTop = chatListEl.scrollHeight;
    resetNewMessagesBelow();
    await markVisibleAsRead();
    return;
  }
  newMessagesBelow += data.items.filter((m) => m.sender_id !== currentUserId).length;
  updateJumpToBottomButton();
}

async function loadOlderMessages() {
  if (loadingOlder || !currentChat || !messageBeforeId || reachedHistoryStart) return;
  loadingOlder = true;
  const previousHeight = chatListEl.scrollHeight;
  const r = await api(`/api/messages/dialogs/${currentChat.chat_id}/messages?before_id=${messageBeforeId}&limit=20`);
  if (r.ok) {
    const data = await r.json();
    const pack = toDatePack(data.items, 'latest');
    if (pack.length) {
      const oldScroll = chatListEl.scrollTop;
      const firstUnread = currentChat?.first_unread_msg_id || null;
      const frag = document.createDocumentFragment();
      let prevDate = null;
      pack.forEach((m) => {
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
      normalizeDateSeparators();
      messageBeforeId = pack[0].msg_id;
      chatListEl.scrollTop = chatListEl.scrollHeight - previousHeight + oldScroll;
    } else {
      reachedHistoryStart = true;
      messageBeforeId = null;
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



async function loadFriendsForGroupBuilder(query = '') {
  const q = query.trim();
  let items = allFriendsCache;
  if (q.length > 0 && q.length < MIN_SEARCH_LENGTH) {
    groupFriendsListEl.innerHTML = `<div class="empty-state">Введите минимум ${MIN_SEARCH_LENGTH} символа для поиска</div>`;
    updateCreateGroupSubmitState();
    return;
  }
  if (groupBuilderMode === 'add' && currentChat) {
    const r = await api(`/api/messages/dialogs/${currentChat.chat_id}/addable-friends?q=${encodeURIComponent(q)}`);
    if (!r.ok) return;
    items = await r.json();
    groupFriendsListEl.innerHTML = '';
    if (!items.length) {
      groupFriendsListEl.innerHTML = '<div class="empty-state">Друзей не найдено</div>';
      updateCreateGroupSubmitState();
      return;
    }
    items.forEach((u) => {
      const row = document.createElement('div');
      row.className = 'group-friend-item';
      const name = `${u.surname} ${u.name}`.trim();
      const av = u.has_avatar ? `<img src="/api/users/${u.id}/avatar" alt="${escapeHtml(name)}">` : escapeHtml(initials(u));
      const selected = selectedGroupMemberIds.has(u.id);
      row.innerHTML = `<div class="avatar">${av}</div><div>${escapeHtml(name)}</div><button type="button" class="radio-dot ${selected ? 'radio-dot--active' : ''}"></button>`;
      row.querySelector('.radio-dot').addEventListener('click', () => {
        if (selectedGroupMemberIds.has(u.id)) selectedGroupMemberIds.delete(u.id);
        else selectedGroupMemberIds.add(u.id);
        loadFriendsForGroupBuilder(groupFriendsSearchInputEl.value);
      });
      groupFriendsListEl.appendChild(row);
    });
    updateCreateGroupSubmitState();
    return;
  }

  if (!items.length || q) {
    const url = q ? `/api/friends/search?q=${encodeURIComponent(q)}` : '/api/friends';
    const r = await fetch(url);
    if (!r.ok) return;
    const data = await r.json();
    items = q ? data.filter((u) => u.relation === 'friend') : data;
    if (!q) allFriendsCache = items;
  }

  groupFriendsListEl.innerHTML = '';
  if (!items.length) {
    groupFriendsListEl.innerHTML = '<div class="empty-state">Друзей не найдено</div>';
    updateCreateGroupSubmitState();
    return;
  }

  items.forEach((u) => {
    const row = document.createElement('div');
    row.className = 'group-friend-item';
    const name = `${u.surname} ${u.name}`.trim();
    const av = u.has_avatar ? `<img src="/api/users/${u.id}/avatar" alt="${escapeHtml(name)}">` : escapeHtml(initials(u));
    const selected = selectedGroupMemberIds.has(u.id);
    row.innerHTML = `<div class="avatar">${av}</div><div>${escapeHtml(name)}</div><button type="button" class="radio-dot ${selected ? 'radio-dot--active' : ''}"></button>`;
    row.querySelector('.radio-dot').addEventListener('click', () => {
      if (selectedGroupMemberIds.has(u.id)) selectedGroupMemberIds.delete(u.id);
      else selectedGroupMemberIds.add(u.id);
      loadFriendsForGroupBuilder(groupFriendsSearchInputEl.value);
    });
    groupFriendsListEl.appendChild(row);
  });
  updateCreateGroupSubmitState();
}

function renderGroupDraftAvatar() {
  const title = groupTitleInputEl.value.trim();
  groupAvatarBtnEl.innerHTML = '';
  if (groupAvatarFile) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(groupAvatarFile);
    groupAvatarBtnEl.appendChild(img);
    groupAvatarDeleteBtnEl.hidden = false;
    return;
  }
  groupAvatarBtnEl.textContent = (title[0] || '?').toUpperCase();
  groupAvatarDeleteBtnEl.hidden = true;
}

function updateCreateGroupSubmitState() {
  const hasTitle = groupBuilderMode === 'add' ? true : Boolean(groupTitleInputEl.value.trim());
  const hasMembers = selectedGroupMemberIds.size > 0;
  createGroupSubmitBtnEl.disabled = !(hasTitle && hasMembers);
}

function openCreateGroupView() {
  groupBuilderMode = 'create';
  dialogsViewEl.classList.add('hidden');
  chatViewEl.classList.add('hidden');
  createGroupViewEl.classList.remove('hidden');
  groupTitleInputEl.value = '';
  groupTitleInputEl.disabled = false;
  groupAvatarBtnEl.disabled = false;
  groupAvatarWrapEl.classList.remove('hidden');
  groupTitleWrapEl.classList.remove('hidden');
  groupFriendsSearchInputEl.value = '';
  selectedGroupMemberIds = new Set();
  groupAvatarFile = null;
  renderGroupDraftAvatar();
  loadFriendsForGroupBuilder();
  createGroupSubmitBtnEl.textContent = 'Создать беседу';
  updateCreateGroupSubmitState();
}

function closeCreateGroupView() {
  createGroupViewEl.classList.add('hidden');
  groupTitleInputEl.disabled = false;
  groupAvatarBtnEl.disabled = false;
  groupAvatarWrapEl.classList.remove('hidden');
  groupTitleWrapEl.classList.remove('hidden');
  if (currentChat) chatViewEl.classList.remove('hidden');
  else dialogsViewEl.classList.remove('hidden');
}

function openAddMembersView() {
  if (!currentChat) return;
  closeChatInfoModal();
  groupBuilderMode = 'add';
  createGroupViewEl.classList.remove('hidden');
  dialogsViewEl.classList.add('hidden');
  chatViewEl.classList.add('hidden');
  groupTitleInputEl.value = currentChat.title || '';
  groupTitleInputEl.disabled = true;
  groupTitleWrapEl.classList.add('hidden');
  groupAvatarWrapEl.classList.add('hidden');
  groupAvatarBtnEl.innerHTML = '';
  groupAvatarBtnEl.disabled = true;
  groupAvatarDeleteBtnEl.hidden = true;
  groupFriendsSearchInputEl.value = '';
  selectedGroupMemberIds = new Set();
  createGroupSubmitBtnEl.textContent = 'Добавить в беседу';
  loadFriendsForGroupBuilder();
  updateCreateGroupSubmitState();
}

async function submitCreateGroup() {
  const title = groupTitleInputEl.value.trim();
  if (groupBuilderMode === 'add' && currentChat) {
    if (!selectedGroupMemberIds.size) return;
    await api(`/api/messages/dialogs/${currentChat.chat_id}/participants/add`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: [...selectedGroupMemberIds] }),
    });
    closeCreateGroupView();
    await openChatInfoModal();
    return;
  }

  if (!title || !selectedGroupMemberIds.size) return;
  const r = await api('/api/messages/dialogs/group', {
    method: 'POST',
    body: JSON.stringify({ title, member_ids: [...selectedGroupMemberIds] }),
  });
  if (!r.ok) return;
  const data = await r.json();

  if (groupAvatarFile && data.chat_id) {
    const fd = new FormData();
    fd.append('file', groupAvatarFile);
    await fetch(`/api/messages/dialogs/${data.chat_id}/avatar`, { method: 'POST', body: fd });
  }

  closeCreateGroupView();
  await loadDialogs(true);
  await openChat(data.chat_id);
}

function roleLabel(roleId) {
  if (roleId === 2) return '<span class="participant-role participant-role--owner">Владелец</span>';
  if (roleId === 1) return '<span class="participant-role participant-role--admin">Админ</span>';
  return '';
}

function updateComposeAvailability() {
  if (!currentChat) return;
  const blocked = Boolean(currentChat.left_at && currentChat.kicked_by !== currentUserId);
  composeInputEl.disabled = blocked;
  composeInputEl.placeholder = blocked ? 'Вы исключены из беседы' : 'Напишите сообщение';
}

async function fetchParticipants() {
  if (!currentChat) return [];
  const r = await api(`/api/messages/dialogs/${currentChat.chat_id}/participants`);
  if (!r.ok) return [];
  participantsCache = await r.json();
  return participantsCache;
}

function canManageMembers() {
  return currentChat && [1, 2].includes(Number(currentChat.role_id)) && !currentChat.left_at;
}

async function openChatInfoModal() {
  if (!currentChat || Number(currentChat.type_id) !== 1 || currentChat.left_at) return;
  chatInfoModalEl.classList.remove('hidden');
  chatInfoTitleEl.textContent = currentChat.title || 'Без названия';
  chatInfoTitleInputEl.classList.toggle('hidden', Number(currentChat.role_id) !== 2);
  chatInfoTitleEl.classList.toggle('hidden', Number(currentChat.role_id) === 2);
  chatInfoTitleSaveBtnEl.classList.add('hidden');
  if (Number(currentChat.role_id) === 2) {
    chatInfoTitleInputEl.value = currentChat.title || '';
  }
  const avatar = currentChat.has_avatar
    ? `<img src="/api/messages/dialogs/${currentChat.chat_id}/avatar" alt="">`
    : escapeHtml((currentChat.title || '?')[0].toUpperCase());
  const isOwner = Number(currentChat.role_id) === 2;
  chatInfoAvatarEl.innerHTML = avatar;
  chatInfoAvatarEl.classList.toggle('avatar-picker--editable', isOwner);
  chatInfoAvatarEl.classList.toggle('chat-info-avatar--owner', isOwner);
  chatInfoAvatarWrapEl.classList.toggle('chat-info-avatar-wrap--owner', isOwner);
  chatInfoAvatarDeleteBtnEl.hidden = !(Number(currentChat.role_id) === 2 && currentChat.has_avatar);
  chatInfoCountEl.textContent = `${Number(currentChat.participant_count || 0)} участник(ов)`;
  leaveChatBtnEl.classList.toggle('hidden', Boolean(currentChat.left_at));
  addMembersBtnEl.classList.toggle('hidden', !canManageMembers());
  await renderParticipantsInModal();
}

function closeChatInfoModal() {
  chatInfoModalEl.classList.add('hidden');
}

async function renderParticipantsInModal() {
  const items = await fetchParticipants();
  currentChat.participant_count = items.filter((u) => !u.left_at).length;
  chatInfoCountEl.textContent = `${Number(currentChat.participant_count || 0)} участник(ов)`;
  const meRole = Number(currentChat.role_id || 0);
  chatParticipantsListEl.innerHTML = '';
  items.forEach((u) => {
    const row = document.createElement('div');
    row.className = 'group-friend-item';
    const name = `${u.surname} ${u.name}`.trim();
    const av = u.has_avatar ? `<img src="/api/users/${u.id}/avatar" alt="${escapeHtml(name)}">` : escapeHtml(initials(u));
    const role = roleLabel(Number(u.role_id));
    const inactive = u.left_at ? '<div class="dialog-snippet">Вышел(а) из беседы</div>' : '';
    row.innerHTML = `
      <a class="avatar" href="/id${u.id}">${av}</a>
      <div><div>${escapeHtml(name)}</div>${role}${inactive}</div>
      <div class="participant-actions"></div>
    `;
    const actions = row.querySelector('.participant-actions');
    const canAct = canManageMembers() && !u.left_at && u.id !== currentUserId;
    if (canAct && (meRole === 2 || Number(u.role_id) === 0)) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'tiny-btn tiny-btn--remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('Удалить участника из беседы?')) return;
        await api(`/api/messages/dialogs/${currentChat.chat_id}/participants/${u.id}/remove`, { method: 'POST' });
        await renderParticipantsInModal();
      });
      actions.appendChild(removeBtn);
    }
    if (meRole === 2 && !u.left_at && Number(u.role_id) !== 2) {
      const roleBtn = document.createElement('button');
      const isAdmin = Number(u.role_id) === 1;
      roleBtn.className = `tiny-btn ${isAdmin ? 'tiny-btn--down' : 'tiny-btn--up'}`;
      roleBtn.textContent = isAdmin ? '↓' : '↑';
      roleBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const nextRole = isAdmin ? 0 : 1;
        if (!confirm(isAdmin ? 'Разжаловать админа?' : 'Сделать участника админом?')) return;
        await api(`/api/messages/dialogs/${currentChat.chat_id}/participants/${u.id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role_id: nextRole }),
        });
        await renderParticipantsInModal();
      });
      actions.appendChild(roleBtn);
    }
    chatParticipantsListEl.appendChild(row);
  });
}

async function saveChatTitleIfNeeded() {
  if (!currentChat || Number(currentChat.role_id) !== 2) return;
  const value = chatInfoTitleInputEl.value.trim();
  if (!value) {
    chatInfoTitleInputEl.classList.add('field-input--error');
    return;
  }
  chatInfoTitleInputEl.classList.remove('field-input--error');
  if (value === (currentChat.title || '')) return;
  await api(`/api/messages/dialogs/${currentChat.chat_id}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title: value }),
  });
  currentChat.title = value;
  await loadDialogs(true);
}

async function updateChatAvatarFromModal(file) {
  if (!currentChat || Number(currentChat.role_id) !== 2 || !file) return;
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(`/api/messages/dialogs/${currentChat.chat_id}/avatar`, { method: 'POST', body: fd });
  if (!r.ok) return;
  currentChat.has_avatar = true;
  await loadDialogs(true);
  await openChat(currentChat.chat_id);
  await openChatInfoModal();
}

async function deleteChatAvatarFromModal() {
  if (!currentChat || Number(currentChat.role_id) !== 2 || !currentChat.has_avatar) return;
  const r = await api(`/api/messages/dialogs/${currentChat.chat_id}/avatar`, { method: 'DELETE' });
  if (!r.ok) return;
  currentChat.has_avatar = false;
  await loadDialogs(true);
  await openChat(currentChat.chat_id);
  await openChatInfoModal();
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
        if (payload.type === 'message:new' && messageAfterId) {
          await loadNewMessages();
        } else {
          await reloadCurrentChat();
        }
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
  if (value.trim().length < MIN_SEARCH_LENGTH) {
    renderSearch(value);
    return;
  }
  searchTimer = setTimeout(() => renderSearch(value), SEARCH_DEBOUNCE_MS);
});

dialogsListEl.addEventListener('scroll', async () => {
  if (dialogsListEl.scrollTop + dialogsListEl.clientHeight >= dialogsListEl.scrollHeight - 30) {
    await loadDialogs(false);
  }
});

chatListEl.addEventListener('scroll', async () => {
  if (chatListEl.scrollTop <= 30) await loadOlderMessages();
  if (isNearBottom()) {
    resetNewMessagesBelow();
  } else {
    updateJumpToBottomButton();
  }
  await markVisibleAsRead();
});

jumpToBottomBtnEl.addEventListener('click', async () => {
  chatListEl.scrollTo({ top: chatListEl.scrollHeight, behavior: 'smooth' });
  resetNewMessagesBelow();
  await markVisibleAsRead();
});

composeInputEl.addEventListener('input', () => {
  saveCurrentDraft();
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


createChatBtnEl.addEventListener('click', openCreateGroupView);
groupCreateBackBtnEl.addEventListener('click', closeCreateGroupView);
groupAvatarBtnEl.addEventListener('click', () => groupAvatarFileEl.click());
groupAvatarFileEl.addEventListener('change', () => {
  const file = groupAvatarFileEl.files?.[0];
  if (!file) return;
  groupAvatarFile = file;
  renderGroupDraftAvatar();
});
groupAvatarDeleteBtnEl.addEventListener('click', () => {
  groupAvatarFile = null;
  groupAvatarFileEl.value = '';
  renderGroupDraftAvatar();
});
groupTitleInputEl.addEventListener('input', () => {
  renderGroupDraftAvatar();
  updateCreateGroupSubmitState();
});
groupFriendsSearchInputEl.addEventListener('input', () => {
  clearTimeout(groupFriendsSearchTimer);
  const value = groupFriendsSearchInputEl.value;
  if (value.trim().length < MIN_SEARCH_LENGTH) {
    loadFriendsForGroupBuilder(value);
    return;
  }
  groupFriendsSearchTimer = setTimeout(() => loadFriendsForGroupBuilder(value), SEARCH_DEBOUNCE_MS);
});
createGroupSubmitBtnEl.addEventListener('click', submitCreateGroup);
chatInfoBackBtnEl.addEventListener('click', async () => {
  closeChatInfoModal();
});
chatInfoTitleInputEl.addEventListener('input', () => {
  if (Number(currentChat?.role_id) !== 2) return;
  const changed = chatInfoTitleInputEl.value.trim() !== (currentChat?.title || '');
  chatInfoTitleSaveBtnEl.classList.toggle('hidden', !changed);
});
chatInfoTitleSaveBtnEl.addEventListener('click', async () => {
  await saveChatTitleIfNeeded();
  chatInfoTitleSaveBtnEl.classList.add('hidden');
  await openChat(currentChat.chat_id);
  await openChatInfoModal();
});
chatInfoAvatarEl.addEventListener('click', () => {
  if (Number(currentChat?.role_id) !== 2) return;
  chatInfoAvatarFileEl.click();
});
chatInfoAvatarFileEl.addEventListener('change', async () => {
  const file = chatInfoAvatarFileEl.files?.[0];
  chatInfoAvatarFileEl.value = '';
  await updateChatAvatarFromModal(file);
});
chatInfoAvatarDeleteBtnEl.addEventListener('click', async () => {
  await deleteChatAvatarFromModal();
});
leaveChatBtnEl.addEventListener('click', async () => {
  if (!currentChat || !confirm('Покинуть беседу?')) return;
  const r = await api(`/api/messages/dialogs/${currentChat.chat_id}/leave`, { method: 'POST' });
  if (!r.ok) return;
  closeChatInfoModal();
  await reloadCurrentChat();
  await loadDialogs(true);
});
addMembersBtnEl.addEventListener('click', openAddMembersView);

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarNav({ currentUserId });
  await loadDialogs(true);

  const params = new URLSearchParams(window.location.search);
  const queryChatWithUser = Number(params.get('chat_with'));
  if (params.has('chat_with')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  const storedChatWithUser = Number(sessionStorage.getItem('messages:openUserId'));
  sessionStorage.removeItem('messages:openUserId');
  const chatWithUser = storedChatWithUser > 0 ? storedChatWithUser : queryChatWithUser;
  if (chatWithUser > 0) {
    await openOrCreateDialogWithUser(chatWithUser);
  }

  initWebSocket();
});
