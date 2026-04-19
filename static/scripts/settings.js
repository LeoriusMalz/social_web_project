const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const form = document.getElementById('settings-form');
const resultEl = document.getElementById('result');
const avatarButton = document.getElementById('avatar-button');
const avatarFileInput = document.getElementById('avatar-file');
const deleteAvatarBtn = document.getElementById('delete-avatar-btn');
const avatarStatusEl = document.getElementById('avatar-status');
const cityDropdown = document.getElementById('cities-dropdown');
const cityInput = document.getElementById('city');
const cityIdInput = document.getElementById('city-id');

const fields = {
    name: document.getElementById('name'),
    surname: document.getElementById('surname'),
    patronym: document.getElementById('patronym'),
    nickname: document.getElementById('nickname'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone')
};

const statusEls = {
    nickname: document.getElementById('nickname-status'),
    email: document.getElementById('email-status')
};

const errorEls = {
    name: document.getElementById('name-error'),
    surname: document.getElementById('surname-error'),
    patronym: document.getElementById('patronym-error'),
    nickname: document.getElementById('nickname-status'),
    email: document.getElementById('email-status'),
    phone: document.getElementById('phone-error'),
    sex: document.getElementById('sex-error'),
    oldPassword: document.getElementById('old-password-error'),
    newPassword: document.getElementById('new-password-error'),
    repeatNewPassword: document.getElementById('repeat-new-password-error')
};

function initials(user) {
    return `${user.name?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase();
}

function selectedSex() {
    return document.querySelector('input[name="sex"]:checked')?.value || '';
}

function setFieldError(fieldName, message) {
    const input = fields[fieldName] || document.getElementById(fieldName.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));
    const error = errorEls[fieldName];
    if (!error) return;

    if (input) {
        input.classList.remove('field-input--success');
        input.classList.toggle('field-input--error', Boolean(message));
    }
    error.textContent = message || '';
}

function setFieldStatus(fieldName, message, type = 'neutral') {
    const status = statusEls[fieldName];
    const input = fields[fieldName];
    if (!status || !input) return;

    status.textContent = message || '';
    status.classList.remove('field-hint--success', 'field-hint--error');
    input.classList.remove('field-input--success', 'field-input--error');

    if (type === 'success') {
        status.classList.add('field-hint--success');
        input.classList.add('field-input--success');
    } else if (type === 'error') {
        status.classList.add('field-hint--error');
        input.classList.add('field-input--error');
    }
}

function setAvatarStatus(message, type = 'neutral') {
    avatarStatusEl.textContent = message || '';
    avatarStatusEl.classList.remove('field-hint--success', 'field-hint--error');
    if (type === 'success') {
        avatarStatusEl.classList.add('field-hint--success');
    } else if (type === 'error') {
        avatarStatusEl.classList.add('field-hint--error');
    }
}

function setFormMessage(message, type = 'error', target = resultEl) {
    target.textContent = message;
    target.classList.remove('form-message--error', 'form-message--success');
    target.classList.add(type === 'success' ? 'form-message--success' : 'form-message--error');
}

function renderAvatar(user) {
    avatarButton.innerHTML = '';
    if (user.avatar_url) {
        const img = document.createElement('img');
        img.src = `${user.avatar_url}?t=${Date.now()}`;
        img.alt = 'Аватар';
        avatarButton.appendChild(img);
        deleteAvatarBtn.hidden = false;
        return;
    }

    avatarButton.textContent = initials(user);
    deleteAvatarBtn.hidden = true;
}

function normalizePhoneDigits(value) {
    const rawDigits = value.replace(/\D/g, '');
    if (!rawDigits) {
        return '';
    }

    if ((rawDigits.startsWith('7') || rawDigits.startsWith('8')) && rawDigits.length >= 11) {
        return rawDigits.slice(1, 11);
    }

    return rawDigits.slice(0, 10);
}

function formatPhone(value) {
    // оставляем только цифры
    let digits = value.replace(/\D/g, '');

    // если пользователь ввёл 8 или 7 в начале — убираем
    if (digits.startsWith('8')) {
        digits = digits.slice(1);
    }
    if (digits.startsWith('7')) {
        digits = digits.slice(1);
    }

    // максимум 10 цифр (без +7)
    digits = digits.substring(0, 10);

    let result = '+7';

    if (digits.length > 0) {
        result += ' (' + digits.substring(0, 3);
    }
    if (digits.length >= 4) {
        result += ') ' + digits.substring(3, 6);
    }
    if (digits.length >= 7) {
        result += '-' + digits.substring(6, 8);
    }
    if (digits.length >= 9) {
        result += '-' + digits.substring(8, 10);
    }

    return result;
}

function validateForm() {
    let isValid = true;
    Object.keys(errorEls).forEach((key) => setFieldError(key, ''));
    setFormMessage('');

    if (!fields.name.value.trim()) {
        setFieldError('name', 'Имя обязательно');
        isValid = false;
    }
    if (!fields.surname.value.trim()) {
        setFieldError('surname', 'Фамилия обязательна');
        isValid = false;
    }

    const nickname = fields.nickname.value.trim();
    if (!nickname) {
        setFieldError('nickname', 'Никнейм обязателен');
        isValid = false;
    } else if (nickname.length < 3) {
        setFieldError('nickname', 'Минимум 3 символа');
        isValid = false;
    } else if (/\s/.test(nickname)) {
        setFieldError('nickname', 'Никнейм не должен содержать пробелы');
        isValid = false;
    }

    const email = fields.email.value.trim();
    if (!email) {
        setFieldError('email', 'Почта обязательна');
        isValid = false;
    } else if (!EMAIL_REGEX.test(email)) {
        setFieldError('email', 'Введите корректный email');
        isValid = false;
    }

    const phone = fields.phone.value.trim();
    if (phone && !/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone)) {
        setFieldError('phone', 'Телефон должен быть в формате +7 (913) 077-93-20');
        isValid = false;
    }

    if (!selectedSex()) {
        setFieldError('sex', 'Выберите пол');
        isValid = false;
    }

    return isValid;
}

async function loadMaritalStatuses(selectedId = null) {
    const select = document.getElementById('marital-status');
    const response = await fetch('/api/settings/marital-statuses');
    if (!response.ok) return;
    const data = await response.json();

    select.innerHTML = '<option value="">Не выбрано</option>';
    data.forEach((status) => {
        const option = document.createElement('option');
        option.value = status.status_id;
        option.textContent = status.status_name;
        if (selectedId && Number(selectedId) === status.status_id) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

let cityAbortController = null;
async function searchCities(query) {
    if (!query.trim()) {
        cityDropdown.hidden = true;
        cityDropdown.innerHTML = '';
        return;
    }

    if (cityAbortController) {
        cityAbortController.abort();
    }
    cityAbortController = new AbortController();

    try {
        const response = await fetch(`/api/settings/cities?q=${encodeURIComponent(query.trim())}`, { signal: cityAbortController.signal });
        if (!response.ok) return;
        const cities = await response.json();

        cityDropdown.innerHTML = '';
        if (!cities.length) {
            cityDropdown.hidden = true;
            return;
        }

        cities.forEach((city) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = city.city_name;
            btn.addEventListener('click', () => {
                cityInput.value = city.city_name;
                cityIdInput.value = city.city_id;
                cityDropdown.hidden = true;
            });
            cityDropdown.appendChild(btn);
        });
        cityDropdown.hidden = false;
    } catch (_) {
        cityDropdown.hidden = true;
    }
}

async function loadSettings() {
    const response = await fetch('/api/settings/me');
    if (!response.ok) {
        setFormMessage('Не удалось загрузить настройки');
        return;
    }
    const user = await response.json();

    fields.name.value = user.name || '';
    fields.surname.value = user.surname || '';
    fields.patronym.value = user.patronym || '';
    fields.nickname.value = user.nickname || '';
    fields.email.value = user.email || '';
    fields.phone.value = user.phone || '';
    if (user.sex) {
        const radio = document.querySelector(`input[name="sex"][value="${user.sex}"]`);
        if (radio) radio.checked = true;
    }
    await loadMaritalStatuses(user.marital_status_id);
    cityInput.value = user.city || '';
    cityIdInput.value = user.city_id || '';
    setFieldStatus('nickname', '');
    setFieldStatus('email', '');
    setAvatarStatus('');
    renderAvatar(user);
}

async function checkNickname() {
    const nickname = fields.nickname.value.trim();
    if (!nickname || nickname.length < 3) {
        setFieldError('nickname', 'Введите никнейм (минимум 3 символа)');
        return;
    }

    const response = await fetch(`/api/settings/check-nickname?nickname=${encodeURIComponent(nickname)}`);
    if (!response.ok) return;
    const data = await response.json();

    if (data.is_taken) {
        setFieldStatus('nickname', 'Никнейм занят', 'error');
    } else {
        setFieldError('nickname', '');
        setFieldStatus('nickname', 'Никнейм свободен', 'success');
    }
}

async function checkEmail() {
    const email = fields.email.value.trim();
    if (!EMAIL_REGEX.test(email)) {
        setFieldError('email', 'Введите корректный email');
        return;
    }

    const response = await fetch(`/api/settings/check-email?email=${encodeURIComponent(email)}`);
    if (!response.ok) return;
    const data = await response.json();

    if (data.is_taken) {
        setFieldStatus('email', 'Почта занята', 'error');
    } else {
        setFieldError('email', '');
        setFieldStatus('email', 'Почта свободна', 'success');
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm()) {
        setFormMessage('Исправьте ошибки в форме');
        return;
    }

    const payload = {
        name: fields.name.value.trim(),
        surname: fields.surname.value.trim(),
        patronym: fields.patronym.value.trim() || null,
        nickname: fields.nickname.value.trim(),
        email: fields.email.value.trim(),
        phone: fields.phone.value.trim() || null,
        sex: selectedSex(),
        marital_status_id: document.getElementById('marital-status').value ? Number(document.getElementById('marital-status').value) : null,
        city_id: cityIdInput.value ? Number(cityIdInput.value) : null
    };

    const response = await fetch('/api/settings/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
        setFormMessage(data.detail || 'Не удалось сохранить');
        return;
    }

    setFormMessage('Настройки сохранены', 'success');
});

avatarButton.addEventListener('click', () => avatarFileInput.click());
avatarFileInput.addEventListener('change', async () => {
    const file = avatarFileInput.files?.[0];
    if (!file) return;

    const body = new FormData();
    body.append('file', file);

    const response = await fetch('/api/settings/avatar', { method: 'POST', body });
    const data = await response.json();
    if (!response.ok) {
        setAvatarStatus(data.detail || 'Не удалось загрузить аватар', 'error');
        return;
    }

    avatarFileInput.value = '';
    await loadSettings();
    setAvatarStatus('Аватар обновлен', 'success');
});

deleteAvatarBtn.addEventListener('click', async () => {
    const ok = window.confirm('Удалить текущую аватарку и вернуть инициалы по умолчанию?');
    if (!ok) {
        return;
    }

    const response = await fetch('/api/settings/avatar', { method: 'DELETE' });
    if (response.ok) {
        await loadSettings();
        setAvatarStatus('Аватар удален', 'success');
    } else {
        setAvatarStatus('Не удалось удалить аватар', 'error');
    }
});

document.getElementById('check-nickname-btn').addEventListener('click', checkNickname);
document.getElementById('check-email-btn').addEventListener('click', checkEmail);

fields.nickname.addEventListener('input', () => setFieldStatus('nickname', ''));
fields.email.addEventListener('input', () => setFieldStatus('email', ''));

document.getElementById('clear-phone-btn').addEventListener('click', () => {
    fields.phone.value = '';
    setFieldError('phone', '');
});

fields.phone.addEventListener('input', () => {
    // const cursorPos = fields.phone.selectionStart;
    fields.phone.value = formatPhone(fields.phone.value);
    fields.phone.setSelectionRange(fields.phone.value.length, fields.phone.value.length);
});

cityInput.addEventListener('input', async () => {
    cityIdInput.value = '';
    await searchCities(cityInput.value);
});

document.getElementById('clear-city-btn').addEventListener('click', () => {
    cityInput.value = '';
    cityIdInput.value = '';
    cityDropdown.hidden = true;
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('.city-wrap')) {
        cityDropdown.hidden = true;
    }
});

async function logout() {
    const response = await fetch('/api/users/logout', { method: 'POST' });
    if (response.ok) {
        window.location.href = '/login';
    }
}

document.getElementById('delete-profile-btn').addEventListener('click', () => {
    setFormMessage('Удаление профиля пока недоступно');
});

const passwordModal = document.getElementById('password-modal');
const passwordForm = document.getElementById('password-form');
const passwordResult = document.getElementById('password-result');

document.getElementById('change-password-btn').addEventListener('click', () => {
    passwordModal.classList.add('modal-overlay--open');
    passwordModal.setAttribute('aria-hidden', 'false');
});

document.getElementById('close-password-modal').addEventListener('click', () => {
    passwordModal.classList.remove('modal-overlay--open');
    passwordModal.setAttribute('aria-hidden', 'true');
});

passwordModal.addEventListener('click', (event) => {
    if (event.target === passwordModal) {
        passwordModal.classList.remove('modal-overlay--open');
        passwordModal.setAttribute('aria-hidden', 'true');
    }
});

passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFieldError('oldPassword', '');
    setFieldError('newPassword', '');
    setFieldError('repeatNewPassword', '');
    setFormMessage('', 'error', passwordResult);

    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const repeatNewPassword = document.getElementById('repeat-new-password').value;

    let valid = true;
    if (!oldPassword || oldPassword.length < 8 || /\s/.test(oldPassword)) {
        setFieldError('oldPassword', 'Введите корректный старый пароль');
        valid = false;
    }
    if (!newPassword || newPassword.length < 8 || /\s/.test(newPassword)) {
        setFieldError('newPassword', 'Новый пароль минимум 8 символов без пробелов');
        valid = false;
    }
    if (newPassword !== repeatNewPassword) {
        setFieldError('repeatNewPassword', 'Пароли не совпадают');
        valid = false;
    }
    if (!valid) return;

    const response = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword, repeat_new_password: repeatNewPassword })
    });

    const data = await response.json();
    if (!response.ok) {
        setFormMessage(data.detail || 'Не удалось поменять пароль', 'error', passwordResult);
        return;
    }

    setFormMessage('Пароль успешно изменен', 'success', passwordResult);
    passwordForm.reset();
});

document.addEventListener('DOMContentLoaded', async () => {
    initSidebarNav({ currentUserId });
    document.getElementById('logout-btn').addEventListener('click', logout);
    await loadSettings();
});
