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

function initGlobalImagePreview() {
    const overlay = document.createElement('div');
    overlay.className = 'details-overlay image-preview-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="details-modal image-preview-modal" role="dialog" aria-modal="true" aria-label="Просмотр изображения">
            <img class="image-preview-modal__img" alt="Полноразмерное изображение">
        </div>
    `;
    overlay.style.display = 'none';
    document.body.appendChild(overlay);

    const modalImage = overlay.querySelector('.image-preview-modal__img');

    const blockedSelector = [
        'button',
        'a.sidebar-btn',
        '#avatar-button',
        '#group-avatar-btn',
        '#chat-info-avatar.avatar-picker--editable',
        '#post-file-btn'
    ].join(',');

    const isPreviewable = (img) => {
        if (!img || img.dataset.imagePreviewDisabled === 'true') {
            return false;
        }
        if (img.closest(blockedSelector)) {
            return false;
        }
        return true;
    };

    const markPreviewableImages = (root = document) => {
        const images = root.querySelectorAll ? root.querySelectorAll('img') : [];
        images.forEach((img) => {
            img.classList.toggle('image-previewable', isPreviewable(img));
        });
    };

    markPreviewableImages(document);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }
                if (node.matches?.('img')) {
                    node.classList.toggle('image-previewable', isPreviewable(node));
                    return;
                }
                markPreviewableImages(node);
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', (event) => {
        const image = event.target.closest('img');
        if (!isPreviewable(image)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        modalImage.src = image.currentSrc || image.src;
        overlay.classList.add('details-overlay--open');
        overlay.style.display = 'flex';
        overlay.setAttribute('aria-hidden', 'false');
    }, true);

    overlay.addEventListener('click', (event) => {
        if (event.target !== overlay) {
            return;
        }
        overlay.style.display = 'none';
        overlay.classList.remove('details-overlay--open');
        overlay.setAttribute('aria-hidden', 'true');
        modalImage.src = '';
    });
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
                window.location.href = '/messages';
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initGlobalImagePreview();
});
