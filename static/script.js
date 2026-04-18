async function submitForm() {
    const nickname = document.getElementById("nickname").value;
    const email = document.getElementById("email").value;

    const response = await fetch("/api/users", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ nickname, email })
    });

    const result = await response.json();

    const resultEl = document.getElementById("result");

    if (response.ok) {
        resultEl.innerText = "User created!";
    } else {
        resultEl.innerText = result.error || "Error";
    }
}
