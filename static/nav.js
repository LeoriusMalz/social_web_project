async function ensureAuthorized(currentUserIdHint) {
    const checkUserId = Number.isInteger(currentUserIdHint) ? currentUserIdHint : window.currentUserId;

    if (Number.isInteger(checkUserId)) {
        const response = await fetch(`/api/users/${checkUserId}`);
        if (response.status === 401) {
            window.location.href = '/login';
            return false;
        }
        return response.ok;
    }

    const fallback = await fetch('/api/users/me');
    if (fallback.status === 401) {
        window.location.href = '/login';
        return false;
    }

    return fallback.ok;
}

function initSidebarNav(options = {}) {
    const buttons = document.querySelectorAll('.sidebar-btn');
    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            const ok = await ensureAuthorized(options.currentUserId);
            if (!ok) {
                return;
            }

            const route = button.dataset.route;
            if (route === 'profile') {
                const userId = options.currentUserId ?? window.currentUserId;
                if (Number.isInteger(userId)) {
                    window.location.href = `/id${userId}`;
                }
                return;
            }

            if (route === 'friends') {
                window.location.href = '/friends';
                return;
            }

            if (route === 'settings') {
                window.location.href = '/settings';
                return;
            }

            if (route === 'messages') {
                console.log('Раздел сообщений будет добавлен позже');
            }
        });
    });
}
