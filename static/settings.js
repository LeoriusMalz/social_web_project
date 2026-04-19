async function logout() {
    const response = await fetch('/api/users/logout', { method: 'POST' });
    if (response.ok) {
        window.location.href = '/login';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSidebarNav({ currentUserId });
    document.getElementById('logout-btn').addEventListener('click', logout);
});
