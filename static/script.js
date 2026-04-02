async function submitForm() {
    const username = document.getElementById("nickname").value;
    const email = document.getElementById("email").value;

    console.log(JSON.stringify({ username, email }));

    const response = await fetch("/api/users", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, email })
    });

    const result = await response.json();

    const resultEl = document.getElementById("result");

    if (response.ok) {
        resultEl.innerText = "User created!";
    } else {
        resultEl.innerText = result.error || "Error";
    }
}