const loginForm = document.getElementById("login-form");
const loginEl = document.getElementById("login");
const passwordEl = document.getElementById("password");
const loginErrorEl = document.getElementById("login-error");
const passwordErrorEl = document.getElementById("password-error");
const resultEl = document.getElementById("result");
const toRegisterBtn = document.getElementById("to-register");

function setError(inputEl, errorEl, message) {
    if (message) {
        inputEl.classList.add("field-input--error");
        errorEl.textContent = message;
    } else {
        inputEl.classList.remove("field-input--error");
        errorEl.textContent = "";
    }
}

function setFormMessage(message, type = "error") {
    resultEl.textContent = message;
    resultEl.classList.remove("form-message--error", "form-message--success");
    resultEl.classList.add(type === "success" ? "form-message--success" : "form-message--error");
}

function validate() {
    let isValid = true;

    setError(loginEl, loginErrorEl, "");
    setError(passwordEl, passwordErrorEl, "");
    setFormMessage("");

    const login = loginEl.value.trim();
    const password = passwordEl.value;

    if (!login) {
        setError(loginEl, loginErrorEl, "Введите логин или почту");
        isValid = false;
    }

    if (!password) {
        setError(passwordEl, passwordErrorEl, "Введите пароль");
        isValid = false;
    } else if (password.length < 8) {
        setError(passwordEl, passwordErrorEl, "Пароль должен быть не менее 8 символов");
        isValid = false;
    }

    return isValid;
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validate()) {
        setFormMessage("Пожалуйста, проверьте поля формы");
        return;
    }

    try {
        const response = await fetch("/api/users/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                login: loginEl.value.trim(),
                password: passwordEl.value
            })
        });

        const result = await response.json();

        if (!response.ok) {
            setFormMessage(result.detail || "Неверный логин или пароль");
            return;
        }

        setFormMessage(`Успешный вход. Пользователь #${result.id}`, "success");
        window.location.href = `/id${result.id}`;
    } catch (error) {
        setFormMessage("Не удалось выполнить вход. Попробуйте позже");
    }
});

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("registered") === "1") {
    setFormMessage("Регистрация прошла успешно. Теперь войдите в аккаунт", "success");
}

toRegisterBtn.addEventListener("click", () => {
    window.location.href = "/register";
});
