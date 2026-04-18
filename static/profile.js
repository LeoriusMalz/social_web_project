async function loadUser() {
    const response = await fetch(`/api/users/${userId}`);

    if (response.status === 401) {
        window.location.href = "/login";
        return;
    }

    const data = await response.json();

    if (!response.ok) {
        document.body.innerHTML = "<h2>Пользователь не найден</h2>";
        return;
    }

    document.getElementById("nickname").innerText =
        "Nickname: " + data.nickname;

    document.getElementById("email").innerText =
        "Email: " + data.email;
}

async function logout() {
    const response = await fetch("/api/users/logout", {
        method: "POST"
    });

    if (!response.ok) {
        return;
    }

    window.location.href = "/login";
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadUser();

    if (isOwner) {
        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", logout);
        }
    }
});
