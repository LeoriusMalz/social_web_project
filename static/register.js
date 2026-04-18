const registerForm = document.getElementById("register-form");
const resultEl = document.getElementById("result");
const toLoginBtn = document.getElementById("to-login");

const fields = {
    nickname: document.getElementById("nickname"),
    email: document.getElementById("email"),
    name: document.getElementById("name"),
    surname: document.getElementById("surname"),
    patronym: document.getElementById("patronym"),
    sex: document.getElementById("sex"),
    password: document.getElementById("password"),
    passwordRepeat: document.getElementById("password-repeat")
};

const errorEls = {
    nickname: document.getElementById("nickname-error"),
    email: document.getElementById("email-error"),
    name: document.getElementById("name-error"),
    surname: document.getElementById("surname-error"),
    patronym: document.getElementById("patronym-error"),
    sex: document.getElementById("sex-error"),
    password: document.getElementById("password-error"),
    passwordRepeat: document.getElementById("password-repeat-error")
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setFieldError(fieldName, message) {
    const input = fields[fieldName];
    const error = errorEls[fieldName];

    if (!input || !error) {
        return;
    }

    if (message) {
        input.classList.add(input.tagName === "SELECT" ? "field-select--error" : "field-input--error");
        error.textContent = message;
    } else {
        input.classList.remove("field-input--error", "field-select--error");
        error.textContent = "";
    }
}

function setFormMessage(message, type = "error") {
    resultEl.textContent = message;
    resultEl.classList.remove("form-message--error", "form-message--success");
    resultEl.classList.add(type === "success" ? "form-message--success" : "form-message--error");
}

function trimValue(value) {
    return value.trim();
}

function validateForm() {
    let isValid = true;

    Object.keys(errorEls).forEach((fieldName) => setFieldError(fieldName, ""));
    setFormMessage("");

    const nickname = trimValue(fields.nickname.value);
    const email = trimValue(fields.email.value);
    const name = trimValue(fields.name.value);
    const surname = trimValue(fields.surname.value);
    const sex = fields.sex.value;
    const password = fields.password.value;
    const passwordRepeat = fields.passwordRepeat.value;

    if (!nickname) {
        setFieldError("nickname", "Логин обязателен");
        isValid = false;
    } else if (nickname.length < 3) {
        setFieldError("nickname", "Логин должен содержать минимум 3 символа");
        isValid = false;
    } else if (/\s/.test(nickname)) {
        setFieldError("nickname", "Логин не должен содержать пробелы");
        isValid = false;
    }

    if (!email) {
        setFieldError("email", "Почта обязательна");
        isValid = false;
    } else if (!EMAIL_REGEX.test(email)) {
        setFieldError("email", "Введите корректный email");
        isValid = false;
    }

    if (!name) {
        setFieldError("name", "Имя обязательно");
        isValid = false;
    }

    if (!surname) {
        setFieldError("surname", "Фамилия обязательна");
        isValid = false;
    }

    if (!sex) {
        setFieldError("sex", "Выберите пол");
        isValid = false;
    }

    if (!password) {
        setFieldError("password", "Пароль обязателен");
        isValid = false;
    } else if (password.length < 8) {
        setFieldError("password", "Пароль должен быть не менее 8 символов");
        isValid = false;
    } else if (!password.trim()) {
        setFieldError("password", "Пароль не может состоять только из пробелов");
        isValid = false;
    } else if (/\s/.test(password)) {
        setFieldError("password", "Пароль не должен содержать пробелы");
        isValid = false;
    }

    if (!passwordRepeat) {
        setFieldError("passwordRepeat", "Повторите пароль");
        isValid = false;
    } else if (password !== passwordRepeat) {
        setFieldError("passwordRepeat", "Пароли не совпадают");
        isValid = false;
    }

    return isValid;
}

async function checkAvailability(nickname, email) {
    const params = new URLSearchParams({ nickname, email });
    const response = await fetch(`/api/users/check-availability?${params.toString()}`);
    return response.json();
}

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validateForm()) {
        setFormMessage("Пожалуйста, исправьте ошибки в форме");
        return;
    }

    const payload = {
        nickname: trimValue(fields.nickname.value),
        email: trimValue(fields.email.value),
        name: trimValue(fields.name.value),
        surname: trimValue(fields.surname.value),
        patronym: trimValue(fields.patronym.value) || null,
        sex: fields.sex.value,
        password: fields.password.value
    };

    try {
        const availability = await checkAvailability(payload.nickname, payload.email);

        if (availability.nickname_exists) {
            setFieldError("nickname", "Такой логин уже занят");
        }

        if (availability.email_exists) {
            setFieldError("email", "Такая почта уже используется");
        }

        if (availability.nickname_exists || availability.email_exists) {
            setFormMessage("Выберите другой логин или почту");
            return;
        }

        const response = await fetch("/api/users/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            setFormMessage(result.detail || "Ошибка регистрации");
            return;
        }

        window.location.href = "/login?registered=1";
    } catch (error) {
        setFormMessage("Не удалось выполнить запрос. Попробуйте позже");
    }
});

toLoginBtn.addEventListener("click", () => {
    window.location.href = "/login";
});
