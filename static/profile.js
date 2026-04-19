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

function setupDetailsModal() {
    const overlay = document.getElementById('details-overlay');
    const moreButton = document.getElementById('more-btn');

    moreButton.addEventListener('click', () => {
        overlay.classList.add('details-overlay--open');
        overlay.setAttribute('aria-hidden', 'false');
    });

    overlay.addEventListener('click', (event) => {
        if (event.target !== overlay) {
            return;
        }
        overlay.classList.remove('details-overlay--open');
        overlay.setAttribute('aria-hidden', 'true');
    });
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

    document.getElementById('friends-stat-btn').addEventListener('click', async () => {
        const ok = await ensureAuthorized(currentUserId);
        if (ok) {
            window.location.href = '/friends';
        }
    });

    document.getElementById('followers-stat-btn').addEventListener('click', async () => {
        const ok = await ensureAuthorized(currentUserId);
        if (ok) {
            window.location.href = '/friends?tab=incoming';
        }
    });
}

async function logout() {
    const response = await fetch('/api/users/logout', {
        method: 'POST'
    });

    if (response.ok) {
        window.location.href = '/login';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initSidebarNav({ currentUserId });
    setupDetailsModal();
    await loadUser();

    if (isOwner) {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
    }
});
