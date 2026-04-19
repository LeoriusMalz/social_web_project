const mockUsers = [
    { id: 1, firstName: "Лев", lastName: "Мальцев", relation: "friend" },
    { id: 2, firstName: "Дарья", lastName: "Новоселова", relation: "friend" },
    { id: 3, firstName: "Иван", lastName: "Петров", relation: "friend" },
    { id: 4, firstName: "Анна", lastName: "Соколова", relation: "incoming" },
    { id: 5, firstName: "Мария", lastName: "Орлова", relation: "incoming" },
    { id: 6, firstName: "Кирилл", lastName: "Волков", relation: "outgoing" },
    { id: 7, firstName: "Егор", lastName: "Смирнов", relation: "outgoing" },
    { id: 8, firstName: "Олег", lastName: "Иванов", relation: "none" },
    { id: 9, firstName: "Павел", lastName: "Козлов", relation: "none" },
    { id: 10, firstName: "Алексей", lastName: "Сидоров", relation: "none" },
    { id: 11, firstName: "Елена", lastName: "Морозова", relation: "none" }
];

const listEl = document.getElementById("friends-list");
const searchInputEl = document.getElementById("friends-search-input");
const tabButtons = document.querySelectorAll(".friends-tab");

const initialTab = new URLSearchParams(window.location.search).get("tab");
const allowedTabs = new Set(["friends", "outgoing", "incoming"]);
let activeTab = allowedTabs.has(initialTab) ? initialTab : "friends";
let searchValue = "";


// async function apiGetFriends() {
//     return fetch("/api/friends").then(r => r.json());
// }
//
// async function apiGetOutgoingRequests() {
//     return fetch("/api/friends/outgoing").then(r => r.json());
// }
//
// async function apiGetIncomingRequests() {
//     return fetch("/api/friends/incoming").then(r => r.json());
// }
//
// async function apiSearchUsers(query) {
//     return fetch(`/api/users/search?q=${encodeURIComponent(query)}`).then(r => r.json());
// }
//
// async function apiDeleteFriend(userId) {
//     return fetch(`/api/friends/${userId}`, { method: "DELETE" });
// }
//
// async function apiCancelRequest(userId) {
//     return fetch(`/api/friends/outgoing/${userId}`, { method: "DELETE" });
// }
//
// async function apiAcceptRequest(userId) {
//     return fetch(`/api/friends/incoming/${userId}/accept`, { method: "POST" });
// }
//
// async function apiRejectRequest(userId) {
//     return fetch(`/api/friends/incoming/${userId}/reject`, { method: "POST" });
// }


function getFullName(user) {
    return `${user.lastName} ${user.firstName}`;
}

function getInitials(user) {
    return `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`;
}

function matchesPattern(user, query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    return getFullName(user).toLowerCase().includes(normalized);
}

function createActionButtons(user) {
    const actions = document.createElement("div");
    actions.className = "friend-actions";

    if (user.relation === "friend") {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "icon-btn icon-btn--danger";
        deleteBtn.title = "Удалить из друзей";
        deleteBtn.textContent = "🗑";
        deleteBtn.addEventListener("click", () => {
            console.log("Удалить из друзей:", user.id);
        });
        actions.appendChild(deleteBtn);
    } else if (user.relation === "outgoing") {
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "text-btn";
        cancelBtn.title = "Удалить заявку";
        cancelBtn.textContent = "✖ Заявка";
        cancelBtn.addEventListener("click", () => {
            console.log("Отменить заявку:", user.id);
        });
        actions.appendChild(cancelBtn);
    } else if (user.relation === "incoming") {
        const acceptBtn = document.createElement("button");
        acceptBtn.className = "icon-btn icon-btn--success";
        acceptBtn.title = "Принять";
        acceptBtn.textContent = "✔";
        acceptBtn.addEventListener("click", () => {
            console.log("Принять заявку:", user.id);
        });

        const rejectBtn = document.createElement("button");
        rejectBtn.className = "icon-btn icon-btn--danger";
        rejectBtn.title = "Отклонить";
        rejectBtn.textContent = "✖";
        rejectBtn.addEventListener("click", () => {
            console.log("Отклонить заявку:", user.id);
        });

        actions.appendChild(acceptBtn);
        actions.appendChild(rejectBtn);
    } else {
        const addBtn = document.createElement("button");
        addBtn.className = "text-btn";
        addBtn.title = "Отправить заявку";
        addBtn.textContent = "+ В друзья";
        addBtn.addEventListener("click", () => {
            console.log("Отправить заявку:", user.id);
        });
        actions.appendChild(addBtn);
    }

    return actions;
}

function createUserCard(user) {
    const card = document.createElement("div");
    card.className = "friend-card";

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

function renderSearchList(query) {
    listEl.innerHTML = "";

    const matched = mockUsers.filter(user => matchesPattern(user, query));

    const friends = matched.filter(user => user.relation === "friend");
    const incoming = matched.filter(user => user.relation === "incoming");
    const outgoing = matched.filter(user => user.relation === "outgoing");
    const others = matched.filter(user => user.relation === "none");

    if (
        friends.length === 0 &&
        incoming.length === 0 &&
        outgoing.length === 0 &&
        others.length === 0
    ) {
        listEl.appendChild(createEmptyState("Ничего не найдено"));
        return;
    }

    if (friends.length) {
        friends.forEach(user => {
            listEl.appendChild(createUserCard(user));
        });
    }

    if (incoming.length || outgoing.length || others.length) {
        listEl.appendChild(createSectionLabel("Глобальный поиск"));

        incoming.forEach(user => {
            listEl.appendChild(createUserCard(user));
        });

        outgoing.forEach(user => {
            listEl.appendChild(createUserCard(user));
        });

        others.forEach(user => {
            listEl.appendChild(createUserCard(user));
        });
    }
}

function renderCurrentState() {
    const query = searchValue.trim();

    if (query.length > 0) {
        document.querySelector('.friends-tabs').style.display = 'none';
        renderSearchList(query);
        return;
    } else {
        document.querySelector('.friends-tabs').style.display = 'flex';
    }

    if (activeTab === "friends") {
        renderSimpleList(
            mockUsers.filter(user => user.relation === "friend"),
            "У вас пока нет друзей"
        );
        return;
    }

    if (activeTab === "outgoing") {
        renderSimpleList(
            mockUsers.filter(user => user.relation === "outgoing"),
            "Нет исходящих заявок"
        );
        return;
    }

    if (activeTab === "incoming") {
        renderSimpleList(
            mockUsers.filter(user => user.relation === "incoming"),
            "Нет входящих заявок"
        );
    }
}

tabButtons.forEach(button => {
    button.addEventListener("click", () => {
        activeTab = button.dataset.tab;

        tabButtons.forEach(btn => btn.classList.remove("friends-tab--active"));
        button.classList.add("friends-tab--active");

        renderCurrentState();
    });
});

searchInputEl.addEventListener("input", (event) => {
    searchValue = event.target.value;
    renderCurrentState();
});

const initialActiveButton = document.querySelector(`.friends-tab[data-tab="${activeTab}"]`);
if (initialActiveButton) {
    tabButtons.forEach(btn => btn.classList.remove("friends-tab--active"));
    initialActiveButton.classList.add("friends-tab--active");
}

renderCurrentState();

document.addEventListener("DOMContentLoaded", () => {
    initSidebarNav({ currentUserId });
});
