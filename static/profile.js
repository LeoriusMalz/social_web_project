async function loadUser() {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();

    if (!response.ok) {
        document.body.innerHTML = "<h2>User not found</h2>";
        return;
    }

    document.getElementById("nickname").innerText =
        "Nickname: " + data.nickname;

    document.getElementById("email").innerText =
        "Email: " + data.email;
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUser();
});
