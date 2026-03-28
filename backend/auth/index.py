"""
OSINTING Auth — регистрация, вход, выход, получение профиля.
"""
import json
import os
import hashlib
import secrets
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p59310248_messenger_osinting')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id',
}

AVATAR_COLORS = [
    'from-purple-600 to-pink-500',
    'from-blue-600 to-cyan-400',
    'from-green-500 to-teal-400',
    'from-orange-500 to-red-500',
    'from-indigo-600 to-purple-400',
    'from-pink-500 to-rose-400',
    'from-cyan-500 to-blue-500',
    'from-yellow-500 to-orange-400',
]


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def ok(data: dict, status: int = 200) -> dict:
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps(data)}


def err(msg: str, status: int = 400) -> dict:
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps({'error': msg})}


def get_user_by_token(conn, token: str):
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.username, u.name, u.bio, u.avatar, u.color, u.online, u.last_seen "
        f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token = %s AND s.expires_at > NOW()",
        (token,)
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {
        'id': str(row[0]), 'username': row[1], 'name': row[2], 'bio': row[3],
        'avatar': row[4], 'color': row[5], 'online': row[6],
        'lastSeen': row[7].isoformat() if row[7] else ''
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    path = event.get('path', '/').rstrip('/')
    method = event.get('httpMethod', 'GET')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token', '')

    conn = get_conn()
    try:
        # POST /register
        if method == 'POST' and path.endswith('/register'):
            username = (body.get('username') or '').strip().lower()
            password = body.get('password') or ''
            name = (body.get('name') or '').strip()
            bio = (body.get('bio') or '').strip()

            if not username or not password or not name:
                return err('Заполните все обязательные поля')
            if len(username) < 3:
                return err('Username минимум 3 символа')
            if len(password) < 6:
                return err('Пароль минимум 6 символов')

            cur = conn.cursor()
            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
            if cur.fetchone():
                cur.close()
                return err('Username уже занят')

            avatar = ''.join(w[0].upper() for w in name.split() if w)[:2]
            import random
            color = AVATAR_COLORS[random.randint(0, len(AVATAR_COLORS) - 1)]
            pw_hash = hash_password(password)

            cur.execute(
                f"INSERT INTO {SCHEMA}.users (username, name, bio, avatar, color, password_hash, online) "
                f"VALUES (%s, %s, %s, %s, %s, %s, TRUE) RETURNING id",
                (username, name, bio, avatar, color, pw_hash)
            )
            user_id = str(cur.fetchone()[0])
            token_new = secrets.token_hex(32)
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
                (user_id, token_new)
            )
            conn.commit()
            cur.close()

            return ok({'token': token_new, 'user': {
                'id': user_id, 'username': username, 'name': name,
                'bio': bio, 'avatar': avatar, 'color': color, 'online': True, 'lastSeen': ''
            }}, 201)

        # POST /login
        if method == 'POST' and path.endswith('/login'):
            username = (body.get('username') or '').strip().lower()
            password = body.get('password') or ''
            if not username or not password:
                return err('Заполните все поля')

            cur = conn.cursor()
            cur.execute(
                f"SELECT id, username, name, bio, avatar, color FROM {SCHEMA}.users "
                f"WHERE username = %s AND password_hash = %s",
                (username, hash_password(password))
            )
            row = cur.fetchone()
            if not row:
                return err('Неверный username или пароль')

            user_id = str(row[0])
            # Update online
            cur.execute(f"UPDATE {SCHEMA}.users SET online = TRUE, last_seen = NOW() WHERE id = %s", (user_id,))
            token_new = secrets.token_hex(32)
            cur.execute(
                f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
                (user_id, token_new)
            )
            conn.commit()
            cur.close()

            return ok({'token': token_new, 'user': {
                'id': user_id, 'username': row[1], 'name': row[2],
                'bio': row[3] or '', 'avatar': row[4], 'color': row[5],
                'online': True, 'lastSeen': ''
            }})

        # POST /logout
        if method == 'POST' and path.endswith('/logout'):
            if token:
                cur = conn.cursor()
                cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = %s", (token,))
                # Set offline
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET online = FALSE, last_seen = NOW() "
                    f"WHERE id = (SELECT user_id FROM {SCHEMA}.sessions WHERE token = %s)",
                    (token,)
                )
                conn.commit()
                cur.close()
            return ok({'ok': True})

        # GET /me
        if method == 'GET' and path.endswith('/me'):
            if not token:
                return err('Требуется авторизация', 401)
            user = get_user_by_token(conn, token)
            if not user:
                return err('Сессия недействительна', 401)
            return ok({'user': user})

        # GET /users — поиск пользователей
        if method == 'GET' and path.endswith('/users'):
            q = (event.get('queryStringParameters') or {}).get('q', '').strip().lower()
            if not token:
                return err('Требуется авторизация', 401)
            me = get_user_by_token(conn, token)
            if not me:
                return err('Сессия недействительна', 401)

            cur = conn.cursor()
            if q:
                cur.execute(
                    f"SELECT id, username, name, bio, avatar, color, online, last_seen "
                    f"FROM {SCHEMA}.users WHERE id != %s AND (username ILIKE %s OR name ILIKE %s) "
                    f"ORDER BY online DESC, name LIMIT 30",
                    (me['id'], f'%{q}%', f'%{q}%')
                )
            else:
                cur.execute(
                    f"SELECT id, username, name, bio, avatar, color, online, last_seen "
                    f"FROM {SCHEMA}.users WHERE id != %s ORDER BY online DESC, name LIMIT 50",
                    (me['id'],)
                )
            rows = cur.fetchall()
            cur.close()

            users = []
            for r in rows:
                ls = r[7]
                users.append({
                    'id': str(r[0]), 'username': r[1], 'name': r[2], 'bio': r[3] or '',
                    'avatar': r[4], 'color': r[5], 'online': r[6],
                    'lastSeen': ls.isoformat() if ls else ''
                })
            return ok({'users': users})

        # PUT /profile
        if method == 'PUT' and path.endswith('/profile'):
            if not token:
                return err('Требуется авторизация', 401)
            me = get_user_by_token(conn, token)
            if not me:
                return err('Сессия недействительна', 401)
            name = (body.get('name') or '').strip()
            bio = (body.get('bio') or '').strip()
            if not name:
                return err('Имя обязательно')
            avatar = ''.join(w[0].upper() for w in name.split() if w)[:2]
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.users SET name = %s, bio = %s, avatar = %s WHERE id = %s",
                (name, bio, avatar, me['id'])
            )
            conn.commit()
            cur.close()
            return ok({'user': {**me, 'name': name, 'bio': bio, 'avatar': avatar}})

        return err('Не найдено', 404)

    finally:
        conn.close()
