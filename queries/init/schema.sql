CREATE TABLE IF NOT EXISTS marital_statuses (
    status_id SERIAL PRIMARY KEY,
    status_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
    city_id SERIAL PRIMARY KEY,
    city_name TEXT NOT NULL
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
    phone VARCHAR(16) UNIQUE DEFAULT NULL,
    email TEXT UNIQUE NOT NULL,
    sex CHAR(1) NOT NULL,
    marital_status_id INTEGER DEFAULT NULL,
    city_id INTEGER DEFAULT NULL,
    created_at TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    password_hash TEXT NOT NULL,

    FOREIGN KEY (marital_status_id) REFERENCES marital_statuses (status_id),
    FOREIGN KEY (city_id) REFERENCES cities (city_id)
);

CREATE TABLE IF NOT EXISTS requests (
    request_id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    request_status_id INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMP NOT NULL,
    decision_at TIMESTAMP DEFAULT NULL,

    FOREIGN KEY (from_user_id) REFERENCES users (id),
    FOREIGN KEY (to_user_id) REFERENCES users (id),
    FOREIGN KEY (request_status_id) REFERENCES request_statuses (status_id)
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
    FOREIGN KEY (user1_id) REFERENCES users (id),
    FOREIGN KEY (user2_id) REFERENCES users (id),
    FOREIGN KEY (request_id) REFERENCES requests (request_id)
);

CREATE TABLE IF NOT EXISTS chats (
    chat_id SERIAL PRIMARY KEY,
    type_id INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    created_by INTEGER NOT NULL,

    FOREIGN KEY (type_id) REFERENCES chat_types (type_id)
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

    FOREIGN KEY (role_id) REFERENCES participant_roles (role_id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (chat_id) REFERENCES chats (chat_id)
);

CREATE TABLE IF NOT EXISTS messages (
    msg_id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT NULL,
    deleted_at TIMESTAMP DEFAULT NULL,
    deleted_by INTEGER DEFAULT NULL,

    CHECK(LENGTH(content) > 0),
    FOREIGN KEY (chat_id) REFERENCES chats (chat_id)
);

CREATE TABLE IF NOT EXISTS message_reads (
    msg_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at TIMESTAMP NOT NULL,

    FOREIGN KEY (msg_id) REFERENCES messages (msg_id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_unique_idx
    ON users (LOWER(nickname));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
    ON users (LOWER(email));

