function fullName(user) {
    return [user.surname, user.name, user.patronym].filter(Boolean).join(' ');
}

function initials(user) {
    return `${user.name?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase();
}

function renderAvatar(user) {
    const avatarEl = document.getElementById('avatar');
    avatarEl.innerHTML = '';

    if (user.avatar_url) {
        const image = document.createElement('img');
        image.src = user.avatar_url;
        image.alt = 'Аватар';
        avatarEl.appendChild(image);
        return;
    }

    avatarEl.textContent = initials(user);
}

function renderDetails(user) {
    const details = [
        { icon: '🏷️', label: 'Никнейм', value: user.nickname ? `@${user.nickname}` : null },
        { icon: '⚧', label: 'Пол', value: user.sex },
        { icon: '📞', label: 'Телефон', value: user.phone },
        { icon: '💍', label: 'Семейное положение', value: user.marital_status },
        { icon: '🏙️', label: 'Город', value: user.city }
    ].filter(item => item.value);

    const listEl = document.getElementById('details-list');
    listEl.innerHTML = '';

    details.forEach(item => {
        const row = document.createElement('div');
        row.className = 'details-item';
        row.innerHTML = `<span>${item.icon}</span><span><b>${item.label}:</b> ${item.value}</span>`;
        listEl.appendChild(row);
    });
}

function setupOverlay(overlayId, openerId) {
    const overlay = document.getElementById(overlayId);
    if (openerId) {
        const button = document.getElementById(openerId);
        button.addEventListener('click', () => {
            overlay.classList.add('details-overlay--open');
            overlay.setAttribute('aria-hidden', 'false');
        });
    }

    overlay.addEventListener('click', (event) => {
        if (event.target !== overlay) {
            return;
        }
        overlay.classList.remove('details-overlay--open');
        overlay.setAttribute('aria-hidden', 'true');
    });

    return overlay;
}

function createPersonCard(user) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'people-card';

    const avatar = document.createElement('div');
    avatar.className = 'friend-avatar';
    avatar.textContent = initials(user);

    const content = document.createElement('div');
    content.className = 'friend-info';

    const name = document.createElement('div');
    name.className = 'friend-name';
    name.textContent = fullName(user);

    const nick = document.createElement('div');
    nick.className = 'friend-subtitle';
    nick.textContent = `@${user.nickname}`;

    content.appendChild(name);
    content.appendChild(nick);

    button.appendChild(avatar);
    button.appendChild(content);

    button.addEventListener('click', () => {
        window.location.href = `/id${user.id}`;
    });

    return button;
}

async function openPeopleOverlay(type) {
    const titleEl = document.getElementById('people-title');
    const listEl = document.getElementById('people-list');
    const overlay = document.getElementById('people-overlay');

    titleEl.textContent = type === 'friends' ? 'Друзья' : 'Подписчики';
    listEl.innerHTML = '';

    const response = await fetch(`/api/friends/user/${userId}/${type}`);
    if (!response.ok) {
        return;
    }

    const users = await response.json();

    if (!users.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = type === 'friends' ? 'Список друзей пуст' : 'Список подписчиков пуст';
        listEl.appendChild(empty);
    } else {
        users.forEach(user => listEl.appendChild(createPersonCard(user)));
    }

    overlay.classList.add('details-overlay--open');
    overlay.setAttribute('aria-hidden', 'false');
}

function relationButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

async function updateRelationControls() {
    if (isOwner) {
        return;
    }

    const relationWrap = document.getElementById('relation-controls');
    relationWrap.innerHTML = '';

    const relationResp = await fetch(`/api/friends/relationship/${userId}`);
    if (!relationResp.ok) {
        return;
    }

    const relationData = await relationResp.json();

    if (relationData.relation === 'none') {
        relationWrap.appendChild(relationButton('Добавить в друзья', 'relation-btn relation-btn--primary', async () => {
            await fetch(`/api/friends/requests/${userId}`, { method: 'POST' });
            await updateRelationControls();
            await loadUser();
        }));
        return;
    }

    if (relationData.relation === 'incoming') {
        const row = document.createElement('div');
        row.className = 'relation-row';
        row.appendChild(relationButton('Принять', 'relation-btn relation-btn--primary', async () => {
            await fetch(`/api/friends/incoming/${userId}/accept`, { method: 'POST' });
            await updateRelationControls();
            await loadUser();
        }));
        row.appendChild(relationButton('Отклонить', 'relation-btn relation-btn--danger', async () => {
            await fetch(`/api/friends/incoming/${userId}/reject`, { method: 'POST' });
            await updateRelationControls();
            await loadUser();
        }));
        relationWrap.appendChild(row);
        return;
    }

    if (relationData.relation === 'outgoing') {
        relationWrap.appendChild(relationButton('Отменить заявку', 'relation-btn relation-btn--secondary', async () => {
            await fetch(`/api/friends/outgoing/${userId}/cancel`, { method: 'POST' });
            await updateRelationControls();
            await loadUser();
        }));
        return;
    }

    relationWrap.appendChild(relationButton('В друзьях', 'relation-btn relation-btn--friend', async () => {
        const ok = window.confirm('Удалить пользователя из друзей?');
        if (!ok) {
            return;
        }
        await fetch(`/api/friends/${userId}`, { method: 'DELETE' });
        await updateRelationControls();
        await loadUser();
    }));
}

async function loadUser() {
    const response = await fetch(`/api/users/${userId}`);

    if (response.status === 401) {
        window.location.href = '/login';
        return;
    }

    const data = await response.json();

    if (!response.ok) {
        document.body.innerHTML = '<h2>Пользователь не найден</h2>';
        return;
    }

    renderAvatar(data);
    document.getElementById('full-name').innerText = fullName(data);

    const nicknameButton = document.getElementById('nickname-btn');
    nicknameButton.innerText = `@${data.nickname}`;
    nicknameButton.addEventListener('click', async () => {
        const link = `${window.location.origin}/id${data.id}`;
        await navigator.clipboard.writeText(link);
    });

    renderDetails(data);
    document.getElementById('friends-count').textContent = `${data.friends_count} друзей`;
    document.getElementById('followers-count').textContent = `${data.followers_count} подписчиков`;
}

document.addEventListener('DOMContentLoaded', async () => {
    initSidebarNav({ currentUserId });
    setupOverlay('details-overlay', 'more-btn');
    setupOverlay('people-overlay');

    document.getElementById('friends-stat-btn').addEventListener('click', async () => {
        const ok = await ensureAuthorized(currentUserId);
        if (!ok) {
            return;
        }
        if (isOwner) {
            window.location.href = '/friends';
            return;
        }
        await openPeopleOverlay('friends');
    });

    document.getElementById('followers-stat-btn').addEventListener('click', async () => {
        const ok = await ensureAuthorized(currentUserId);
        if (!ok) {
            return;
        }
        if (isOwner) {
            window.location.href = '/friends?tab=incoming';
            return;
        }
        await openPeopleOverlay('followers');
    });

    await loadUser();
    await updateRelationControls();
});
