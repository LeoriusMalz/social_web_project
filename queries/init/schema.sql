CREATE TABLE IF NOT EXISTS marital_statuses (
    status_id SERIAL PRIMARY KEY,
    status_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
    city_id SERIAL PRIMARY KEY,
    region_name TEXT NOT NULL,
    city_name TEXT NOT NULL,

    UNIQUE(city_name, region_name)
);

CREATE TABLE IF NOT EXISTS request_statuses (
    status_id SERIAL PRIMARY KEY,
    status_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_types (
    type_id SERIAL PRIMARY KEY,
    status_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participant_roles (
    role_id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL DEFAULT 'Name',
    surname VARCHAR(30) NOT NULL DEFAULT 'Surname',
    patronym VARCHAR(40) DEFAULT NULL,
    nickname VARCHAR(20) UNIQUE NOT NULL,
    phone VARCHAR(18) UNIQUE DEFAULT NULL,
    email TEXT UNIQUE NOT NULL,
    sex CHAR(1) NOT NULL,
    marital_status_id INTEGER DEFAULT NULL,
    city_id INTEGER DEFAULT NULL,
    created_at TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    password_hash TEXT NOT NULL,
    avatar BYTEA DEFAULT NULL,

    CONSTRAINT users_marital_status_id_fkey
        FOREIGN KEY (marital_status_id) REFERENCES marital_statuses (status_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT users_city_id_fkey
        FOREIGN KEY (city_id) REFERENCES cities (city_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS requests (
    request_id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    request_status_id INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMP NOT NULL,
    decision_at TIMESTAMP DEFAULT NULL,

    CONSTRAINT requests_from_user_id_fkey
        FOREIGN KEY (from_user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT requests_to_user_id_fkey
        FOREIGN KEY (to_user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT requests_request_status_id_fkey
        FOREIGN KEY (request_status_id) REFERENCES request_statuses (status_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS friendships (
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    request_id INTEGER NOT NULL UNIQUE,
    added_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP DEFAULT NULL,
    deleted_by INTEGER DEFAULT NULL,

    CHECK(user1_id < user2_id),
    PRIMARY KEY (user1_id, user2_id),
    CONSTRAINT friendships_user1_id_fkey
        FOREIGN KEY (user1_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT friendships_user2_id_fkey
        FOREIGN KEY (user2_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT friendships_request_id_fkey
        FOREIGN KEY (request_id) REFERENCES requests (request_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS chats (
    chat_id SERIAL PRIMARY KEY,
    type_id INTEGER NOT NULL DEFAULT 0,
    title VARCHAR(120) DEFAULT NULL,
    avatar BYTEA DEFAULT NULL,
    created_at TIMESTAMP NOT NULL,
    created_by INTEGER NOT NULL,

    CONSTRAINT chats_type_id_fkey
        FOREIGN KEY (type_id) REFERENCES chat_types (type_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS participation (
    part_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMP NOT NULL,
    invited_by INTEGER,
    left_at TIMESTAMP DEFAULT NULL,
    kicked_by INTEGER DEFAULT NULL,

    CONSTRAINT participation_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES participant_roles (role_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT participation_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT participation_chat_id_fkey
        FOREIGN KEY (chat_id) REFERENCES chats (chat_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    msg_id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    reply_msg_id INTEGER DEFAULT NULL,
    sent_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP DEFAULT NULL,
    deleted_by INTEGER DEFAULT NULL,

    CHECK(LENGTH(content) > 0),
    CONSTRAINT messages_chat_id_fkey
        FOREIGN KEY (chat_id) REFERENCES chats (chat_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT messages_sender_id_fkey
        FOREIGN KEY (sender_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT messages_reply_msg_id_fkey
        FOREIGN KEY (reply_msg_id) REFERENCES messages (msg_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS message_reads (
    msg_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at TIMESTAMP NOT NULL,

    CONSTRAINT message_reads_msg_id_fkey
        FOREIGN KEY (msg_id) REFERENCES messages (msg_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT message_reads_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS message_reads_unique_idx
    ON message_reads (msg_id, user_id);

CREATE INDEX IF NOT EXISTS participation_user_chat_active_idx
    ON participation (user_id, chat_id)
    WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS messages_chat_id_msg_id_idx
    ON messages (chat_id, msg_id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS messages_chat_sent_at_idx
    ON messages (chat_id, sent_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_unique_idx
    ON users (LOWER(nickname));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
    ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS user_sessions (
    session_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP DEFAULT NULL,
    user_agent TEXT,
    ip_address TEXT,

    CONSTRAINT user_sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx
    ON user_sessions (user_id);

CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx
    ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS posts (
    post_id SERIAL PRIMARY KEY,
    post_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    text_content TEXT DEFAULT NULL,
    file_content BYTEA DEFAULT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT posts_post_by_fkey
        FOREIGN KEY (post_by) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK (NULLIF(BTRIM(COALESCE(text_content, '')), '') IS NOT NULL OR file_content IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS reactions (
    reaction_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    reaction_by INTEGER NOT NULL,
    reacted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_liked BOOLEAN NOT NULL,

    CONSTRAINT reactions_post_id_fkey
        FOREIGN KEY (post_id) REFERENCES posts (post_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT reactions_reaction_by_fkey
        FOREIGN KEY (reaction_by) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (post_id, reaction_by)
);

CREATE INDEX IF NOT EXISTS posts_post_by_post_id_idx
    ON posts (post_by, post_id DESC);

CREATE INDEX IF NOT EXISTS reactions_post_id_idx
    ON reactions (post_id);
