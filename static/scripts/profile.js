function fullName(user) {
    return [user.surname, user.name, user.patronym].filter(Boolean).join(' ');
}

function initials(user) {
    return `${user.name?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase();
}

function renderAvatar(user, avatar) {
    const userAvatar = user.avatar_url ? user.avatar_url :
        user.has_avatar ? `/api/users/${user.id}/avatar` : null;
    if (userAvatar) {
        const image = document.createElement('img');
        image.src = userAvatar;
        image.alt = 'Аватар';
        avatar.appendChild(image);
        return avatar;
    }

    avatar.textContent = initials(user);
    return avatar;
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

    let avatar = document.createElement('div');
    avatar.className = 'friend-avatar';

    avatar = renderAvatar(user, avatar);

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

function openDialogWithUser(targetUserId) {
    sessionStorage.setItem('messages:openUserId', String(targetUserId));
    window.location.href = '/messages';
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

    const row = document.createElement('div');
    row.className = 'relation-row';

    row.appendChild(relationButton('Написать сообщение', 'relation-btn relation-btn--message', () => {
        openDialogWithUser(userId);
    }));

    row.appendChild(relationButton('В друзьях', 'relation-btn relation-btn--friend', async () => {
        const ok = window.confirm('Удалить пользователя из друзей?');
        if (!ok) {
            return;
        }
        await fetch(`/api/friends/${userId}`, { method: 'DELETE' });
        await updateRelationControls();
        await loadUser();
    }));

    relationWrap.appendChild(row);
}

function formatPostCreatedAt(createdAtIso) {
    const createdAt = new Date(createdAtIso);
    const diffMs = Date.now() - createdAt.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
        return 'Меньше минуты назад';
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return `${diffMin} минут назад`;
    }

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
        return `${diffHours} часов назад`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
        return `${diffDays} дней назад`;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const hhmm = `${pad(createdAt.getHours())}:${pad(createdAt.getMinutes())}`;
    const dmy = `${pad(createdAt.getDate())}.${pad(createdAt.getMonth() + 1)}.${String(createdAt.getFullYear()).slice(-2)}`;
    return `${hhmm} ${dmy}`;
}

function createReactionButton(label, count, active, onClick, onContextMenu = null) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `react-btn${active ? ' react-btn--active' : ''}`;
    btn.textContent = `${label} ${count ? count : ''}`;
    btn.addEventListener('click', onClick);
    if (onContextMenu) {
        btn.addEventListener('contextmenu', onContextMenu);
    }
    return btn;
}

function createDeletePostButton(postId, onDeleted) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'post-delete-btn';
    btn.textContent = 'Удалить';
    btn.addEventListener('click', async () => {
        const ok = window.confirm('Удалить этот пост?');
        if (!ok) {
            return;
        }

        const response = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
        if (!response.ok) {
            window.alert('Не удалось удалить пост');
            return;
        }

        onDeleted();
    });
    return btn;
}

async function reactPost(postId, isLiked) {
    const response = await fetch(`/api/posts/${postId}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_liked: isLiked })
    });

    if (!response.ok) {
        return null;
    }

    return response.json();
}

async function unreactPost(postId) {
    const response = await fetch(`/api/posts/${postId}/reaction/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        return null;
    }

    return response.json();
}

async function openPostReactionsOverlay(postId) {
    const titleEl = document.getElementById('people-title');
    const listEl = document.getElementById('people-list');
    const overlay = document.getElementById('people-overlay');

    const response = await fetch(`/api/posts/${postId}/reactions/users`);
    if (!response.ok) {
        return;
    }

    const data = await response.json();
    const liked = data.liked || [];
    const disliked = data.disliked || [];

    titleEl.textContent = 'Реакции';
    listEl.innerHTML = '';

    const appendSection = (label, users) => {
        const section = document.createElement('div');
        section.className = 'friends-section-label';
        section.textContent = label;
        listEl.appendChild(section);

        if (!users.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Пока пусто';
            listEl.appendChild(empty);
            return;
        }

        users.forEach((user) => listEl.appendChild(createPersonCard(user)));
    };

    appendSection('Понравилось', liked);
    appendSection('Не понравилось', disliked);

    overlay.classList.add('details-overlay--open');
    overlay.setAttribute('aria-hidden', 'false');
}

function renderPost(post, prepend = false) {
    const list = document.getElementById('posts-list');
    const card = document.createElement('article');
    card.className = 'post-card';
    card.dataset.postId = String(post.post_id);

    if (post.text_content) {
        const content = document.createElement('div');
        content.className = 'post-content';
        content.textContent = post.text_content;
        card.appendChild(content);
    }

    if (post.has_file) {
        const img = document.createElement('img');
        img.className = 'post-image';
        img.src = `/api/posts/${post.post_id}/file`;
        img.alt = 'Изображение поста';
        card.appendChild(img);
    }

    const footer = document.createElement('footer');
    footer.className = 'post-footer';

    const reactions = document.createElement('div');
    reactions.className = 'post-reactions';

    const renderReactions = (postData) => {
        reactions.innerHTML = '';
        const openReactions = async (event) => {
            event.preventDefault();
            await openPostReactionsOverlay(postData.post_id);
        };

        reactions.appendChild(createReactionButton('👍', postData.likes_count, !!postData.is_liked_by_me, async () => {
            let updated;
            if (!!postData.is_liked_by_me) {
                updated = await unreactPost(postData.post_id);
            } else {
                updated = await reactPost(postData.post_id, true);
            }
            if (updated) {
                renderReactions(updated);
            }
        }, openReactions));
        reactions.appendChild(createReactionButton('👎', postData.dislikes_count, !!postData.is_disliked_by_me, async () => {
            let updated;
            if (!!postData.is_disliked_by_me) {
                updated = await unreactPost(postData.post_id);
            } else {
                updated = await reactPost(postData.post_id, false);
            }
            if (updated) {
                renderReactions(updated);
            }
        }, openReactions));
    };

    renderReactions(post);

    const date = document.createElement('div');
    date.className = 'post-created-at';
    date.textContent = formatPostCreatedAt(post.created_at);
    date.title = new Date(post.created_at).toLocaleString('ru-RU');

    const meta = document.createElement('div');
    meta.className = 'post-meta';
    if (isOwner) {
        meta.appendChild(createDeletePostButton(post.post_id, () => card.remove()));
    }
    meta.appendChild(date);

    footer.appendChild(reactions);
    footer.appendChild(meta);
    card.appendChild(footer);

    if (prepend) {
        list.prepend(card);
        return;
    }
    list.appendChild(card);
}

const postsState = {
    loading: false,
    ended: false,
    beforePostId: null,
};

async function loadPosts() {
    if (postsState.loading || postsState.ended) {
        return;
    }

    postsState.loading = true;
    document.getElementById('posts-loader').hidden = false;

    const params = new URLSearchParams({ limit: '20' });
    if (postsState.beforePostId) {
        params.set('before_post_id', String(postsState.beforePostId));
    }

    const response = await fetch(`/api/posts/user/${userId}?${params.toString()}`);
    if (!response.ok) {
        postsState.loading = false;
        document.getElementById('posts-loader').hidden = true;
        return;
    }

    const data = await response.json();
    const items = data.items || [];

    items.forEach((post) => renderPost(post));

    if (!items.length) {
        postsState.ended = true;
        document.getElementById('posts-end').hidden = false;
    } else {
        postsState.beforePostId = items[items.length - 1].post_id;
    }

    postsState.loading = false;
    document.getElementById('posts-loader').hidden = true;
}

function setupInfinitePostsLoading() {
    const loader = document.getElementById('posts-loader');
    const observer = new IntersectionObserver(async (entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
            await loadPosts();
        }
    }, { rootMargin: '220px' });

    observer.observe(loader);
}

function setupPostComposer() {
    if (!isOwner) {
        return;
    }

    const section = document.getElementById('post-create-section');
    const createBtn = document.getElementById('create-post-btn');
    const form = document.getElementById('post-form');
    const textEl = document.getElementById('post-text');
    const fileInput = document.getElementById('post-file-input');
    const fileBtn = document.getElementById('post-file-btn');
    const fileDeleteBtn = document.getElementById('post-file-delete-btn');
    const cancelBtn = document.getElementById('cancel-post-btn');
    const errorEl = document.getElementById('post-form-error');

    section.hidden = false;

    createBtn.addEventListener('click', () => {
        createBtn.hidden = true;
        form.hidden = false;
        textEl.focus();
    });

    const resetFileButton = () => {
        fileBtn.textContent = '+';
        fileBtn.innerHTML = '+';
        fileBtn.classList.remove('post-file-btn--has-file');
        fileBtn.classList.remove('post-file-btn--error');
        fileBtn.setAttribute('aria-label', 'Прикрепить фото');
        fileDeleteBtn.hidden = true;
    };

    const clearComposerError = () => {
        errorEl.hidden = true;
        errorEl.textContent = '';
        textEl.classList.remove('post-text--error');
        fileBtn.classList.remove('post-file-btn--error');
    };

    const showComposerError = ({ message, highlightText = false, highlightFile = false }) => {
        errorEl.hidden = false;
        errorEl.textContent = message;
        textEl.classList.toggle('post-text--error', highlightText);
        fileBtn.classList.toggle('post-file-btn--error', highlightFile);
    };

    const resetComposer = () => {
        textEl.value = '';
        fileInput.value = '';
        resetFileButton();
        clearComposerError();
        form.hidden = true;
        createBtn.hidden = false;
    };

    fileBtn.addEventListener('click', () => {
        clearComposerError();
        fileInput.click();
    });

    fileDeleteBtn.addEventListener('click', () => {
        clearComposerError();
        fileInput.value = '';
        resetFileButton();
    });

    fileInput.addEventListener('change', () => {
        clearComposerError();
        const file = fileInput.files?.[0];
        if (!file) {
            resetFileButton();
            return;
        }

        if (!file.type.startsWith('image/')) {
            fileInput.value = '';
            resetFileButton();
            showComposerError({
                message: 'Можно прикреплять только изображения',
                highlightFile: true,
            });
            return;
        }

        const preview = document.createElement('img');
        preview.alt = 'Прикрепленный файл';
        preview.src = URL.createObjectURL(file);
        fileBtn.innerHTML = '';
        fileBtn.appendChild(preview);
        fileBtn.classList.add('post-file-btn--has-file');
        fileBtn.setAttribute('aria-label', 'Заменить прикрепленное фото');
        fileDeleteBtn.hidden = false;
    });

    cancelBtn.addEventListener('click', () => {
        resetComposer();
    });

    textEl.addEventListener('input', () => {
        if (textEl.classList.contains('post-text--error')) {
            clearComposerError();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const text = textEl.value.trim();
        const file = fileInput.files?.[0] || null;

        if (!text && !file) {
            showComposerError({
                message: 'Пост не может быть пустым',
                highlightText: true,
            });
            return;
        }

        const formData = new FormData();
        if (text) {
            formData.set('text_content', text);
        }
        if (file) {
            formData.set('file', file);
        }

        const response = await fetch('/api/posts/', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            let message = 'Не удалось опубликовать пост';
            try {
                const data = await response.json();
                if (data?.detail) {
                    message = data.detail;
                }
            } catch (_) {
                // noop
            }
            showComposerError({
                message,
                highlightText: true,
                highlightFile: Boolean(file),
            });
            return;
        }

        const post = await response.json();
        renderPost(post, true);
        resetComposer();
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
        const card = document.querySelector('.profile-card');
        const controls = ['nickname-btn', 'more-btn', 'relation-controls', 'friends-stat-btn', 'followers-stat-btn', 'stats-block', 'posts-loader'];

        card.classList.add('profile-card--not-found');
        document.getElementById('full-name').innerText = 'Пользователь не найден';
        document.getElementById('avatar').classList.add('profile-avatar--not-found');
        document.getElementById('avatar').textContent = '❔';

        controls.forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });

        return;
    }

    let avatarEl = document.getElementById('avatar');
    avatarEl.innerHTML = '';

    avatarEl = renderAvatar(data, avatarEl);
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
            sessionStorage.setItem('friends:initialTab', 'incoming');
            window.location.href = '/friends';
            return;
        }
        await openPeopleOverlay('followers');
    });

    await loadUser();
    await updateRelationControls();
    setupPostComposer();
    setupInfinitePostsLoading();
    await loadPosts();
});
