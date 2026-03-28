"""
OSINTING Chats — создание чатов, список чатов, участники.
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p59310248_messenger_osinting')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def ok(data, status=200):
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps(data, default=str)}


def err(msg, status=400):
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps({'error': msg})}


def get_user_by_token(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.username, u.name, u.bio, u.avatar, u.color, u.online "
        f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token = %s AND s.expires_at > NOW()",
        (token,)
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {'id': str(row[0]), 'username': row[1], 'name': row[2], 'bio': row[3],
            'avatar': row[4], 'color': row[5], 'online': row[6]}


def ensure_messages_table(conn):
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.messages (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            chat_id        UUID NOT NULL,
            sender_id      UUID NOT NULL,
            msg_type       TEXT NOT NULL DEFAULT 'text',
            text           TEXT,
            image_url      TEXT,
            voice_duration INTEGER,
            file_name      TEXT,
            deleted        BOOLEAN NOT NULL DEFAULT FALSE,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.message_reads (
            message_id UUID NOT NULL,
            user_id    UUID NOT NULL,
            read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (message_id, user_id)
        )
    """)
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.typing_indicators (
            chat_id    UUID NOT NULL,
            user_id    UUID NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (chat_id, user_id)
        )
    """)
    conn.commit()
    cur.close()


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/').rstrip('/')
    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token', '')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    conn = get_conn()
    try:
        ensure_messages_table(conn)

        if not token:
            return err('Требуется авторизация', 401)
        me = get_user_by_token(conn, token)
        if not me:
            return err('Сессия недействительна', 401)

        # GET /chats — список чатов пользователя
        if method == 'GET' and (path.endswith('/chats') or path == '/'):
            cur = conn.cursor()
            cur.execute(f"""
                SELECT
                    c.id, c.type, c.name, c.avatar, c.color, c.created_at,
                    (SELECT COUNT(*) FROM {SCHEMA}.chat_members cm2 WHERE cm2.chat_id = c.id) AS member_count,
                    (SELECT m.id FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_id,
                    (SELECT m.msg_type FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_type,
                    (SELECT m.text FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_text,
                    (SELECT m.file_name FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_file,
                    (SELECT m.created_at FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_at,
                    (SELECT m.sender_id FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg_sender,
                    (SELECT COUNT(*) FROM {SCHEMA}.messages m
                     WHERE m.chat_id = c.id AND m.sender_id != %s AND m.deleted = FALSE
                     AND m.id NOT IN (SELECT mr.message_id FROM {SCHEMA}.message_reads mr WHERE mr.user_id = %s)
                    ) AS unread_count
                FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.chat_members cm ON cm.chat_id = c.id AND cm.user_id = %s
                ORDER BY last_msg_at DESC NULLS LAST, c.created_at DESC
            """, (me['id'], me['id'], me['id']))

            rows = cur.fetchall()

            # For personal chats, get the other user info
            chats_out = []
            for r in rows:
                chat_id = str(r[0])
                chat_type = r[1]
                name = r[2]
                avatar = r[3]
                color = r[4]

                if chat_type == 'personal':
                    cur2 = conn.cursor()
                    cur2.execute(f"""
                        SELECT u.id, u.username, u.name, u.avatar, u.color, u.online, u.last_seen
                        FROM {SCHEMA}.chat_members cm
                        JOIN {SCHEMA}.users u ON u.id = cm.user_id
                        WHERE cm.chat_id = %s AND cm.user_id != %s
                        LIMIT 1
                    """, (chat_id, me['id']))
                    other = cur2.fetchone()
                    cur2.close()
                    if other:
                        name = other[2]
                        avatar = other[3]
                        color = other[4]
                        other_user = {
                            'id': str(other[0]), 'username': other[1], 'name': other[2],
                            'avatar': other[3], 'color': other[4], 'online': other[5],
                            'lastSeen': other[6].isoformat() if other[6] else ''
                        }
                    else:
                        other_user = None
                else:
                    other_user = None

                last_msg = None
                if r[7]:
                    last_msg = {
                        'id': str(r[7]),
                        'type': r[8],
                        'text': r[9],
                        'fileName': r[10],
                        'timestamp': r[11].isoformat() if r[11] else '',
                        'senderId': str(r[12]) if r[12] else '',
                    }

                chats_out.append({
                    'id': chat_id,
                    'type': chat_type,
                    'name': name,
                    'avatar': avatar,
                    'color': color,
                    'memberCount': int(r[6]),
                    'lastMessage': last_msg,
                    'unread': int(r[13]),
                    'otherUser': other_user,
                })
            cur.close()
            return ok({'chats': chats_out})

        # POST /chats — создать чат
        if method == 'POST' and (path.endswith('/chats') or path == '/'):
            chat_type = body.get('type', 'personal')
            target_user_id = body.get('userId')  # for personal
            name = body.get('name', '')
            color = body.get('color', 'from-purple-600 to-pink-500')
            participant_ids = body.get('participants', [])

            cur = conn.cursor()

            if chat_type == 'personal' and target_user_id:
                # Check if personal chat already exists
                cur.execute(f"""
                    SELECT c.id FROM {SCHEMA}.chats c
                    JOIN {SCHEMA}.chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = %s
                    JOIN {SCHEMA}.chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = %s
                    WHERE c.type = 'personal'
                    LIMIT 1
                """, (me['id'], target_user_id))
                existing = cur.fetchone()
                if existing:
                    cur.close()
                    return ok({'chatId': str(existing[0])})

                # Get target user info
                cur.execute(f"SELECT name, avatar, color FROM {SCHEMA}.users WHERE id = %s", (target_user_id,))
                trow = cur.fetchone()
                if not trow:
                    cur.close()
                    return err('Пользователь не найден')
                chat_name = trow[0]
                chat_avatar = trow[1]
                chat_color = trow[2]

                cur.execute(
                    f"INSERT INTO {SCHEMA}.chats (type, name, avatar, color, created_by) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    ('personal', chat_name, chat_avatar, chat_color, me['id'])
                )
                chat_id = str(cur.fetchone()[0])
                cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s)", (chat_id, me['id']))
                cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s)", (chat_id, target_user_id))
                conn.commit()
                cur.close()
                return ok({'chatId': chat_id}, 201)

            elif chat_type == 'group':
                avatar_text = ''.join(w[0].upper() for w in name.split() if w)[:2] or 'ГЧ'
                cur.execute(
                    f"INSERT INTO {SCHEMA}.chats (type, name, avatar, color, created_by) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    ('group', name, avatar_text, color, me['id'])
                )
                chat_id = str(cur.fetchone()[0])
                cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s)", (chat_id, me['id']))
                for uid in participant_ids:
                    if uid != me['id']:
                        cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (chat_id, uid))
                conn.commit()
                cur.close()
                return ok({'chatId': chat_id}, 201)

            cur.close()
            return err('Укажите тип чата')

        # GET /chats/{id}/members
        if method == 'GET' and '/members' in path:
            parts = path.split('/')
            chat_id = parts[-2] if parts[-1] == 'members' else None
            if not chat_id:
                return err('Неверный запрос')
            cur = conn.cursor()
            cur.execute(f"""
                SELECT u.id, u.username, u.name, u.avatar, u.color, u.online, u.last_seen
                FROM {SCHEMA}.chat_members cm JOIN {SCHEMA}.users u ON u.id = cm.user_id
                WHERE cm.chat_id = %s
            """, (chat_id,))
            members = []
            for r in cur.fetchall():
                members.append({
                    'id': str(r[0]), 'username': r[1], 'name': r[2],
                    'avatar': r[3], 'color': r[4], 'online': r[5],
                    'lastSeen': r[6].isoformat() if r[6] else ''
                })
            cur.close()
            return ok({'members': members})

        # POST /typing
        if method == 'POST' and path.endswith('/typing'):
            chat_id = body.get('chatId')
            is_typing = body.get('typing', True)
            if not chat_id:
                return err('chatId обязателен')
            cur = conn.cursor()
            if is_typing:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.typing_indicators (chat_id, user_id, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (chat_id, user_id) DO UPDATE SET updated_at = NOW()
                """, (chat_id, me['id']))
            else:
                cur.execute(f"UPDATE {SCHEMA}.typing_indicators SET updated_at = NOW() - INTERVAL '1 hour' WHERE chat_id = %s AND user_id = %s",
                            (chat_id, me['id']))
            conn.commit()
            cur.close()
            return ok({'ok': True})

        # GET /typing?chatId=...
        if method == 'GET' and path.endswith('/typing'):
            chat_id = (event.get('queryStringParameters') or {}).get('chatId')
            if not chat_id:
                return ok({'typers': []})
            cur = conn.cursor()
            cur.execute(f"""
                SELECT u.id, u.name FROM {SCHEMA}.typing_indicators ti
                JOIN {SCHEMA}.users u ON u.id = ti.user_id
                WHERE ti.chat_id = %s AND ti.user_id != %s AND ti.updated_at > NOW() - INTERVAL '5 seconds'
            """, (chat_id, me['id']))
            typers = [{'id': str(r[0]), 'name': r[1]} for r in cur.fetchall()]
            cur.close()
            return ok({'typers': typers})

        return err('Не найдено', 404)

    finally:
        conn.close()
