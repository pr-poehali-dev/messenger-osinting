"""
OSINTING Messages — отправка, получение, удаление сообщений, polling новых.
"""
import json
import os
import psycopg2
import base64
import boto3

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
        f"SELECT u.id, u.username, u.name, u.avatar, u.color "
        f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token = %s AND s.expires_at > NOW()",
        (token,)
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {'id': str(row[0]), 'username': row[1], 'name': row[2], 'avatar': row[3], 'color': row[4]}


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
    conn.commit()
    cur.close()


def format_message(row):
    return {
        'id': str(row[0]),
        'chatId': str(row[1]),
        'senderId': str(row[2]),
        'type': row[3],
        'text': row[4],
        'imageUrl': row[5],
        'voiceDuration': row[6],
        'fileName': row[7],
        'deleted': row[8],
        'timestamp': row[9].isoformat() if row[9] else '',
        'status': 'read',
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/').rstrip('/')
    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token', '')
    params = event.get('queryStringParameters') or {}
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

        # GET /messages?chatId=...&before=...&limit=50
        if method == 'GET' and (path.endswith('/messages') or path == '/'):
            chat_id = params.get('chatId')
            if not chat_id:
                return err('chatId обязателен')
            before = params.get('before')  # timestamp ISO for pagination
            limit = min(int(params.get('limit', 50)), 100)

            cur = conn.cursor()
            # Check member
            cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, me['id']))
            if not cur.fetchone():
                cur.close()
                return err('Нет доступа к чату', 403)

            if before:
                cur.execute(f"""
                    SELECT id, chat_id, sender_id, msg_type, text, image_url, voice_duration, file_name, deleted, created_at
                    FROM {SCHEMA}.messages
                    WHERE chat_id = %s AND created_at < %s
                    ORDER BY created_at DESC LIMIT %s
                """, (chat_id, before, limit))
            else:
                cur.execute(f"""
                    SELECT id, chat_id, sender_id, msg_type, text, image_url, voice_duration, file_name, deleted, created_at
                    FROM {SCHEMA}.messages
                    WHERE chat_id = %s
                    ORDER BY created_at DESC LIMIT %s
                """, (chat_id, limit))

            rows = cur.fetchall()
            msgs = [format_message(r) for r in reversed(rows)]

            # Mark messages as read
            for r in rows:
                if str(r[2]) != me['id'] and not r[8]:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.message_reads (message_id, user_id)
                        VALUES (%s, %s) ON CONFLICT DO NOTHING
                    """, (str(r[0]), me['id']))
            conn.commit()
            cur.close()
            return ok({'messages': msgs})

        # GET /messages/poll?chatId=...&since=...
        if method == 'GET' and path.endswith('/poll'):
            chat_id = params.get('chatId')
            since = params.get('since')  # ISO timestamp
            if not chat_id or not since:
                return err('chatId и since обязательны')

            cur = conn.cursor()
            cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, me['id']))
            if not cur.fetchone():
                cur.close()
                return err('Нет доступа', 403)

            cur.execute(f"""
                SELECT id, chat_id, sender_id, msg_type, text, image_url, voice_duration, file_name, deleted, created_at
                FROM {SCHEMA}.messages
                WHERE chat_id = %s AND created_at > %s
                ORDER BY created_at ASC LIMIT 50
            """, (chat_id, since))
            rows = cur.fetchall()
            msgs = [format_message(r) for r in rows]

            # Also get updated deleted messages
            cur.execute(f"""
                SELECT id FROM {SCHEMA}.messages WHERE chat_id = %s AND deleted = TRUE AND created_at > %s - INTERVAL '1 hour'
            """, (chat_id, since))
            deleted_ids = [str(r[0]) for r in cur.fetchall()]

            # Mark new messages read
            for r in rows:
                if str(r[2]) != me['id'] and not r[8]:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.message_reads (message_id, user_id)
                        VALUES (%s, %s) ON CONFLICT DO NOTHING
                    """, (str(r[0]), me['id']))
            conn.commit()
            cur.close()
            return ok({'messages': msgs, 'deletedIds': deleted_ids})

        # GET /messages/global-poll?since=...  — poll across all user chats
        if method == 'GET' and path.endswith('/global-poll'):
            since = params.get('since')
            if not since:
                return err('since обязателен')

            cur = conn.cursor()
            # Get all chats of user
            cur.execute(f"SELECT chat_id FROM {SCHEMA}.chat_members WHERE user_id = %s", (me['id'],))
            chat_ids = [str(r[0]) for r in cur.fetchall()]
            if not chat_ids:
                cur.close()
                return ok({'messages': [], 'deletedIds': []})

            placeholders = ','.join(['%s'] * len(chat_ids))
            cur.execute(f"""
                SELECT id, chat_id, sender_id, msg_type, text, image_url, voice_duration, file_name, deleted, created_at
                FROM {SCHEMA}.messages
                WHERE chat_id IN ({placeholders}) AND created_at > %s
                ORDER BY created_at ASC LIMIT 100
            """, (*chat_ids, since))
            rows = cur.fetchall()
            msgs = [format_message(r) for r in rows]

            # Mark as read
            for r in rows:
                if str(r[2]) != me['id'] and not r[8]:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.message_reads (message_id, user_id)
                        VALUES (%s, %s) ON CONFLICT DO NOTHING
                    """, (str(r[0]), me['id']))
            conn.commit()
            cur.close()
            return ok({'messages': msgs})

        # POST /messages — отправить сообщение
        if method == 'POST' and (path.endswith('/messages') or path == '/'):
            chat_id = body.get('chatId')
            msg_type = body.get('type', 'text')
            text = body.get('text')
            image_data = body.get('imageData')  # base64
            voice_duration = body.get('voiceDuration')
            file_name = body.get('fileName')

            if not chat_id:
                return err('chatId обязателен')

            cur = conn.cursor()
            cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, me['id']))
            if not cur.fetchone():
                cur.close()
                return err('Нет доступа к чату', 403)

            image_url = None
            if msg_type == 'image' and image_data:
                try:
                    # Upload to S3
                    s3 = boto3.client(
                        's3',
                        endpoint_url='https://bucket.poehali.dev',
                        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
                    )
                    # Strip data URL prefix
                    if ',' in image_data:
                        image_data = image_data.split(',', 1)[1]
                    img_bytes = base64.b64decode(image_data)
                    import uuid
                    key = f"osinting/images/{uuid.uuid4()}.jpg"
                    s3.put_object(Bucket='files', Key=key, Body=img_bytes, ContentType='image/jpeg')
                    image_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
                except Exception as e:
                    image_url = None

            cur.execute(f"""
                INSERT INTO {SCHEMA}.messages (chat_id, sender_id, msg_type, text, image_url, voice_duration, file_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, chat_id, sender_id, msg_type, text, image_url, voice_duration, file_name, deleted, created_at
            """, (chat_id, me['id'], msg_type, text, image_url, voice_duration, file_name))
            row = cur.fetchone()
            conn.commit()
            cur.close()
            return ok({'message': format_message(row)}, 201)

        # PUT /messages/{id}/delete — soft delete
        if method == 'PUT' and '/delete' in path:
            parts = path.split('/')
            msg_id = None
            for i, p in enumerate(parts):
                if p == 'delete' and i > 0:
                    msg_id = parts[i - 1]
                    break
            if not msg_id:
                return err('Не найден ID сообщения')

            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.messages SET deleted = TRUE WHERE id = %s AND sender_id = %s RETURNING id",
                (msg_id, me['id'])
            )
            if not cur.fetchone():
                cur.close()
                return err('Сообщение не найдено или нет прав', 403)
            conn.commit()
            cur.close()
            return ok({'ok': True})

        # GET /messages/read-status?chatId=...
        if method == 'GET' and path.endswith('/read-status'):
            chat_id = params.get('chatId')
            if not chat_id:
                return err('chatId обязателен')
            cur = conn.cursor()
            cur.execute(f"""
                SELECT m.id, COUNT(mr.user_id) as readers
                FROM {SCHEMA}.messages m
                LEFT JOIN {SCHEMA}.message_reads mr ON mr.message_id = m.id AND mr.user_id != m.sender_id
                WHERE m.chat_id = %s AND m.sender_id = %s AND m.deleted = FALSE
                GROUP BY m.id
            """, (chat_id, me['id']))
            status = {str(r[0]): ('read' if r[1] > 0 else 'sent') for r in cur.fetchall()}
            cur.close()
            return ok({'status': status})

        return err('Не найдено', 404)

    finally:
        conn.close()
