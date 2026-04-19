const listEl = document.getElementById("friends-list");
const searchInputEl = document.getElementById("friends-search-input");
const tabButtons = document.querySelectorAll(".friends-tab");
const tabsEl = document.querySelector('.friends-tabs');

const initialTab = new URLSearchParams(window.location.search).get("tab");
const allowedTabs = new Set(["friends", "outgoing", "incoming"]);
let activeTab = allowedTabs.has(initialTab) ? initialTab : "friends";
let searchValue = "";

function getFullName(user) {
    return `${user.surname} ${user.name}`;
}

function getInitials(user) {
    return `${user.name?.[0] ?? ""}${user.surname?.[0] ?? ""}`.toUpperCase();
}

function matchesPattern(user, query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    return getFullName(user).toLowerCase().includes(normalized);
}

async function apiGetFriends() {
    const r = await fetch('/api/friends');
    return r.json();
}

async function apiGetOutgoingRequests() {
    const r = await fetch('/api/friends/outgoing');
    return r.json();
}

async function apiGetIncomingRequests() {
    const r = await fetch('/api/friends/incoming');
    return r.json();
}

async function apiSearchUsers(query) {
    const r = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`);
    return r.json();
}

async function apiDeleteFriend(userId) {
    return fetch(`/api/friends/${userId}`, { method: 'DELETE' });
}

async function apiCancelRequest(userId) {
    return fetch(`/api/friends/outgoing/${userId}/cancel`, { method: 'POST' });
}

async function apiAcceptRequest(userId) {
    return fetch(`/api/friends/incoming/${userId}/accept`, { method: 'POST' });
}

async function apiRejectRequest(userId) {
    return fetch(`/api/friends/incoming/${userId}/reject`, { method: 'POST' });
}

async function apiAddFriend(userId) {
    return fetch(`/api/friends/requests/${userId}`, { method: 'POST' });
}

function createActionButtons(user) {
    const actions = document.createElement("div");
    actions.className = "friend-actions";

    if (user.relation === "friend") {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "icon-btn icon-btn--danger";
        deleteBtn.title = "Удалить из друзей";
        deleteBtn.textContent = "🗑";
        deleteBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            const ok = window.confirm('Удалить пользователя из друзей?');
            if (!ok) {
                return;
            }
            await apiDeleteFriend(user.id);
            await renderCurrentState();
        });
        actions.appendChild(deleteBtn);
    } else if (user.relation === "outgoing") {
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "text-btn";
        cancelBtn.title = "Удалить заявку";
        cancelBtn.textContent = "✖ Заявка";
        cancelBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            await apiCancelRequest(user.id);
            await renderCurrentState();
        });
        actions.appendChild(cancelBtn);
    } else if (user.relation === "incoming") {
        const acceptBtn = document.createElement("button");
        acceptBtn.className = "icon-btn icon-btn--success";
        acceptBtn.title = "Принять";
        acceptBtn.textContent = "✔";
        acceptBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            await apiAcceptRequest(user.id);
            await renderCurrentState();
        });

        const rejectBtn = document.createElement("button");
        rejectBtn.className = "icon-btn icon-btn--danger";
        rejectBtn.title = "Отклонить";
        rejectBtn.textContent = "✖";
        rejectBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            await apiRejectRequest(user.id);
            await renderCurrentState();
        });

        actions.appendChild(acceptBtn);
        actions.appendChild(rejectBtn);
    } else {
        const addBtn = document.createElement("button");
        addBtn.className = "text-btn";
        addBtn.title = "Отправить заявку";
        addBtn.textContent = "+ В друзья";
        addBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            await apiAddFriend(user.id);
            await renderCurrentState();
        });
        actions.appendChild(addBtn);
    }

    return actions;
}

function createUserCard(user) {
    const card = document.createElement("div");
    card.className = "friend-card";
    card.addEventListener('click', () => {
        window.location.href = `/id${user.id}`;
    });

    const avatar = document.createElement("div");
    avatar.className = "friend-avatar";
    avatar.textContent = getInitials(user);

    const info = document.createElement("div");
    info.className = "friend-info";

    const name = document.createElement("div");
    name.className = "friend-name";
    name.textContent = getFullName(user);

    const subtitle = document.createElement("div");
    subtitle.className = "friend-subtitle";

    if (user.relation === "friend") {
        subtitle.textContent = "У вас в друзьях";
    } else if (user.relation === "incoming") {
        subtitle.textContent = "Входящая заявка";
    } else if (user.relation === "outgoing") {
        subtitle.textContent = "Исходящая заявка";
    } else {
        subtitle.textContent = "";
    }

    info.appendChild(name);
    info.appendChild(subtitle);

    card.appendChild(avatar);
    card.appendChild(info);
    card.appendChild(createActionButtons(user));

    return card;
}

function createSectionLabel(text) {
    const label = document.createElement("div");
    label.className = "friends-section-label";
    label.textContent = text;
    return label;
}

function createEmptyState(text) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = text;
    return empty;
}

function renderSimpleList(users, emptyText) {
    listEl.innerHTML = "";

    if (!users.length) {
        listEl.appendChild(createEmptyState(emptyText));
        return;
    }

    users.forEach(user => {
        listEl.appendChild(createUserCard(user));
    });
}

function renderSearchList(users, query) {
    listEl.innerHTML = "";

    const matched = users.filter(user => matchesPattern(user, query));

    const friends = matched.filter(user => user.relation === "friend");
    const incoming = matched.filter(user => user.relation === "incoming");
    const outgoing = matched.filter(user => user.relation === "outgoing");
    const others = matched.filter(user => user.relation === "none");

    if (!matched.length) {
        listEl.appendChild(createEmptyState("Ничего не найдено"));
        return;
    }

    friends.forEach(user => listEl.appendChild(createUserCard(user)));

    if (incoming.length || outgoing.length || others.length) {
        listEl.appendChild(createSectionLabel("Глобальный поиск"));
        incoming.forEach(user => listEl.appendChild(createUserCard(user)));
        outgoing.forEach(user => listEl.appendChild(createUserCard(user)));
        others.forEach(user => listEl.appendChild(createUserCard(user)));
    }
}

async function renderCurrentState() {
    const query = searchValue.trim();

    if (query.length > 0) {
        tabsEl.style.display = 'none';
        const users = await apiSearchUsers(query);
        renderSearchList(users, query);
        return;
    }

    tabsEl.style.display = 'flex';

    if (activeTab === "friends") {
        const users = await apiGetFriends();
        renderSimpleList(users, "У вас пока нет друзей");
        return;
    }

    if (activeTab === "outgoing") {
        const users = await apiGetOutgoingRequests();
        renderSimpleList(users, "Нет исходящих заявок");
        return;
    }

    const users = await apiGetIncomingRequests();
    renderSimpleList(users, "Нет входящих заявок");
}

tabButtons.forEach(button => {
    button.addEventListener("click", async () => {
        activeTab = button.dataset.tab;

        tabButtons.forEach(btn => btn.classList.remove("friends-tab--active"));
        button.classList.add("friends-tab--active");

        await renderCurrentState();
    });
});

searchInputEl.addEventListener("input", async (event) => {
    searchValue = event.target.value;
    await renderCurrentState();
});

const initialActiveButton = document.querySelector(`.friends-tab[data-tab="${activeTab}"]`);
if (initialActiveButton) {
    tabButtons.forEach(btn => btn.classList.remove("friends-tab--active"));
    initialActiveButton.classList.add("friends-tab--active");
}

document.addEventListener("DOMContentLoaded", async () => {
    initSidebarNav({ currentUserId });
    await renderCurrentState();
});
