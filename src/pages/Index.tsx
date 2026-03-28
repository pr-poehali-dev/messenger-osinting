import { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';

// ─── Types ──────────────────────────────────────────────────────────────────

type Screen = 'auth' | 'app';
type AuthTab = 'login' | 'register';
type AppTab = 'chats' | 'search' | 'contacts' | 'profile';
type MessageStatus = 'sending' | 'sent' | 'read';
type MessageType = 'text' | 'image' | 'voice' | 'file';

interface User {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatar: string;
  color: string;
  online: boolean;
  lastSeen: string;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  text?: string;
  imageUrl?: string;
  voiceDuration?: number;
  fileName?: string;
  timestamp: Date;
  status: MessageStatus;
  deleted?: boolean;
}

interface Chat {
  id: string;
  type: 'personal' | 'group';
  name: string;
  avatar: string;
  color: string;
  participants: string[];
  lastMessage?: Message;
  unread: number;
  isTyping?: boolean;
  pinned?: boolean;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'from-purple-600 to-pink-500',
  'from-blue-600 to-cyan-400',
  'from-green-500 to-teal-400',
  'from-orange-500 to-red-500',
  'from-indigo-600 to-purple-400',
  'from-pink-500 to-rose-400',
  'from-cyan-500 to-blue-500',
  'from-yellow-500 to-orange-400',
];

const ALL_USERS: User[] = [
  { id: 'u1', username: 'alex_shadow', name: 'Алекс Шадов', bio: 'Разведка и безопасность', avatar: 'АШ', color: AVATAR_COLORS[0], online: true, lastSeen: '' },
  { id: 'u2', username: 'neon_wolf', name: 'Неон Волков', bio: 'Кибербезопасность | OSINT', avatar: 'НВ', color: AVATAR_COLORS[1], online: true, lastSeen: '' },
  { id: 'u3', username: 'dark_iris', name: 'Ирис Дарк', bio: 'Аналитик данных', avatar: 'ИД', color: AVATAR_COLORS[2], online: false, lastSeen: '5 мин назад' },
  { id: 'u4', username: 'cipher_x', name: 'Сайфер Икс', bio: 'Шифрование и протоколы', avatar: 'СИ', color: AVATAR_COLORS[3], online: false, lastSeen: '2 ч назад' },
  { id: 'u5', username: 'ghost_proto', name: 'Призрак', bio: 'Невидимка сети', avatar: 'ПР', color: AVATAR_COLORS[4], online: true, lastSeen: '' },
  { id: 'u6', username: 'aurora_sys', name: 'Аврора Сис', bio: 'Системный архитектор', avatar: 'АС', color: AVATAR_COLORS[5], online: false, lastSeen: '1 ч назад' },
];

const MOCK_MESSAGES: Message[] = [
  { id: 'm1', chatId: 'c1', senderId: 'u1', type: 'text', text: 'Привет! Как дела с операцией?', timestamp: new Date(Date.now() - 3600000 * 3), status: 'read' },
  { id: 'm2', chatId: 'c1', senderId: 'me', type: 'text', text: 'Всё под контролем. Собираю данные.', timestamp: new Date(Date.now() - 3600000 * 2), status: 'read' },
  { id: 'm3', chatId: 'c1', senderId: 'u1', type: 'text', text: 'Отлично. Пришли отчёт когда будет готов 👍', timestamp: new Date(Date.now() - 1800000), status: 'read' },
  { id: 'm4', chatId: 'c1', senderId: 'me', type: 'text', text: 'Хорошо, примерно через час', timestamp: new Date(Date.now() - 900000), status: 'read' },
  { id: 'm5', chatId: 'c1', senderId: 'u1', type: 'text', text: 'Принял, жду 🔐', timestamp: new Date(Date.now() - 300000), status: 'read' },
  { id: 'm6', chatId: 'c2', senderId: 'u2', type: 'text', text: 'Нашёл уязвимость в системе', timestamp: new Date(Date.now() - 7200000), status: 'read' },
  { id: 'm7', chatId: 'c2', senderId: 'me', type: 'text', text: 'Серьёзно? Какой тип?', timestamp: new Date(Date.now() - 7000000), status: 'read' },
  { id: 'm8', chatId: 'c2', senderId: 'u2', type: 'text', text: 'SQL-инъекция в API аутентификации. Критично.', timestamp: new Date(Date.now() - 120000), status: 'sent' },
  { id: 'm9', chatId: 'c3', senderId: 'u3', type: 'text', text: 'Данные по цели готовы', timestamp: new Date(Date.now() - 86400000), status: 'read' },
  { id: 'm10', chatId: 'c3', senderId: 'me', type: 'text', text: 'Отправляй в защищённый канал', timestamp: new Date(Date.now() - 86000000), status: 'read' },
  { id: 'm11', chatId: 'cg1', senderId: 'u1', type: 'text', text: 'Команда, завтра брифинг в 10:00', timestamp: new Date(Date.now() - 3600000), status: 'read' },
  { id: 'm12', chatId: 'cg1', senderId: 'u2', type: 'text', text: 'Принял, буду онлайн', timestamp: new Date(Date.now() - 3500000), status: 'read' },
  { id: 'm13', chatId: 'cg1', senderId: 'me', type: 'text', text: 'Подготовлю презентацию', timestamp: new Date(Date.now() - 600000), status: 'sent' },
];

const MOCK_CHATS: Chat[] = [
  {
    id: 'c1', type: 'personal', name: 'Алекс Шадов', avatar: 'АШ', color: AVATAR_COLORS[0],
    participants: ['me', 'u1'], unread: 0, pinned: true,
    lastMessage: MOCK_MESSAGES.find(m => m.id === 'm5'),
  },
  {
    id: 'c2', type: 'personal', name: 'Неон Волков', avatar: 'НВ', color: AVATAR_COLORS[1],
    participants: ['me', 'u2'], unread: 1,
    lastMessage: MOCK_MESSAGES.find(m => m.id === 'm8'),
  },
  {
    id: 'c3', type: 'personal', name: 'Ирис Дарк', avatar: 'ИД', color: AVATAR_COLORS[2],
    participants: ['me', 'u3'], unread: 0,
    lastMessage: MOCK_MESSAGES.find(m => m.id === 'm10'),
  },
  {
    id: 'cg1', type: 'group', name: 'Оперативная группа', avatar: 'ОГ', color: AVATAR_COLORS[4],
    participants: ['me', 'u1', 'u2', 'u3'], unread: 2,
    lastMessage: MOCK_MESSAGES.find(m => m.id === 'm13'),
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatChatTime(date?: Date): string {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 86400000) return formatTime(date);
  if (diff < 172800000) return 'вчера';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Avatar Component ────────────────────────────────────────────────────────

function Avatar({ initials, color, size = 'md', online = false, className = '' }:
  { initials: string; color: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; online?: boolean; className?: string }) {
  const sizes: Record<string, string> = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  };
  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-semibold text-white font-display select-none`}>
        {initials}
      </div>
      {online && (
        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#07070f] z-10" />
      )}
    </div>
  );
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────

function AuthScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    if (!username || !password) { setError('Заполните все поля'); return; }
    setIsLoading(true);
    setTimeout(() => {
      const stored: User[] = JSON.parse(localStorage.getItem('osinting_users') || '[]');
      const allKnown = [...ALL_USERS, ...stored.filter(u => !ALL_USERS.find(au => au.id === u.id))];
      const found = allKnown.find(u => u.username === username.toLowerCase());
      if (!found) { setError('Пользователь не найден'); setIsLoading(false); return; }
      const passwords: Record<string, string> = JSON.parse(localStorage.getItem('osinting_passwords') || '{}');
      const expected = passwords[found.id] || 'demo123';
      if (expected !== password) { setError('Неверный пароль'); setIsLoading(false); return; }
      onLogin(found);
    }, 800);
  };

  const handleRegister = () => {
    if (!username || !password || !name) { setError('Заполните обязательные поля'); return; }
    if (username.length < 3) { setError('Username минимум 3 символа'); return; }
    const stored: User[] = JSON.parse(localStorage.getItem('osinting_users') || '[]');
    const allKnown = [...ALL_USERS, ...stored];
    if (allKnown.some(u => u.username === username.toLowerCase())) { setError('Username уже занят'); return; }
    setIsLoading(true);
    setTimeout(() => {
      const newUser: User = {
        id: genId(),
        username: username.toLowerCase(),
        name,
        bio,
        avatar: name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        online: true,
        lastSeen: '',
      };
      localStorage.setItem('osinting_users', JSON.stringify([...stored, newUser]));
      const passwords: Record<string, string> = JSON.parse(localStorage.getItem('osinting_passwords') || '{}');
      passwords[newUser.id] = password;
      localStorage.setItem('osinting_passwords', JSON.stringify(passwords));
      onLogin(newUser);
    }, 800);
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-center overflow-hidden" style={{ background: 'var(--os-bg)' }}>
      <div className="os-mesh-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      <div className="relative z-10 w-full max-w-sm px-6 animate-fade-in-scale">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 os-glow" style={{ background: 'var(--os-gradient)' }}>
            <Icon name="Shield" size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight font-display os-gradient-text">OSINTING</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--os-text-muted)' }}>Безопасный мессенджер</p>
        </div>

        <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--os-surface2)', border: '1px solid var(--os-border)' }}>
          {(['login', 'register'] as AuthTab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200`}
              style={tab === t ? { background: 'var(--os-gradient)', color: '#fff' } : { color: 'var(--os-text-muted)' }}>
              {t === 'login' ? 'Войти' : 'Регистрация'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {tab === 'register' && (
            <input className="os-input w-full px-4 py-3 rounded-xl text-sm" placeholder="Ваше имя *"
              value={name} onChange={e => setName(e.target.value)} style={{ color: 'var(--os-text)' }} />
          )}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--os-text-muted)' }}>@</span>
            <input className="os-input w-full pl-8 pr-4 py-3 rounded-xl text-sm" placeholder="username *"
              value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} style={{ color: 'var(--os-text)' }} />
          </div>
          <input className="os-input w-full px-4 py-3 rounded-xl text-sm" placeholder="Пароль *" type="password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleRegister())}
            style={{ color: 'var(--os-text)' }} />
          {tab === 'register' && (
            <input className="os-input w-full px-4 py-3 rounded-xl text-sm" placeholder="О себе (необязательно)"
              value={bio} onChange={e => setBio(e.target.value)} style={{ color: 'var(--os-text)' }} />
          )}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm animate-fade-in"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}
          <button onClick={tab === 'login' ? handleLogin : handleRegister} disabled={isLoading}
            className="os-btn-primary w-full py-3 rounded-xl font-semibold text-sm mt-2 flex items-center justify-center gap-2">
            {isLoading
              ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <><Icon name={tab === 'login' ? 'LogIn' : 'UserPlus'} size={16} />{tab === 'login' ? 'Войти' : 'Создать аккаунт'}</>
            }
          </button>
        </div>

        {tab === 'login' && (
          <p className="text-center text-xs mt-4" style={{ color: 'var(--os-text-dim)' }}>
            Демо: <button className="underline" style={{ color: 'var(--os-purple-light)' }}
              onClick={() => { setUsername('alex_shadow'); setPassword('demo123'); }}>
              alex_shadow / demo123
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Message Status ───────────────────────────────────────────────────────────

function MsgStatus({ status }: { status: MessageStatus }) {
  if (status === 'sending') return <Icon name="Clock" size={11} className="opacity-40" />;
  if (status === 'sent') return <Icon name="Check" size={11} style={{ color: 'rgba(255,255,255,0.6)' }} />;
  return <Icon name="CheckCheck" size={11} style={{ color: 'var(--os-cyan)' }} />;
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-fade-in mb-1">
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1" style={{ background: 'var(--os-msg-in)', border: '1px solid var(--os-border)' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full typing-dot-${i}`} style={{ background: 'var(--os-text-muted)' }} />
        ))}
      </div>
    </div>
  );
}

// ─── Voice Message ───────────────────────────────────────────────────────────

function VoiceMessage({ duration, isOwn }: { duration: number; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const bars = Array.from({ length: 26 }, (_, i) => 4 + Math.abs(Math.sin(i * 0.7)) * 10 + (i % 3) * 2);

  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    setPlaying(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 100 / (duration * 10);
      setProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(interval); setPlaying(false); setProgress(0); }
    }, 100);
  };

  return (
    <div className="flex items-center gap-2.5 py-0.5 min-w-[160px]">
      <button onClick={toggle}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
        style={{ background: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(124,58,237,0.3)' }}>
        <Icon name={playing ? 'Pause' : 'Play'} size={13} className="text-white" />
      </button>
      <div className="flex items-center gap-0.5 flex-1 h-5">
        {bars.map((h, i) => (
          <div key={i} className="waveform-bar flex-shrink-0 rounded-full"
            style={{
              height: `${h}px`,
              width: '3px',
              animationDelay: `${i * 0.04}s`,
              animationPlayState: playing ? 'running' : 'paused',
              background: i / bars.length < progress / 100
                ? (isOwn ? 'rgba(255,255,255,0.9)' : 'var(--os-purple-light)')
                : (isOwn ? 'rgba(255,255,255,0.35)' : 'var(--os-text-dim)'),
            }} />
        ))}
      </div>
      <span className="text-xs flex-shrink-0 opacity-60">{duration}с</span>
    </div>
  );
}

// ─── Chat Message ────────────────────────────────────────────────────────────

function ChatMessage({ msg, isOwn, senderName, senderAvatar, senderColor, showAvatar, onDelete }:
  { msg: Message; isOwn: boolean; senderName?: string; senderAvatar?: string; senderColor?: string; showAvatar?: boolean; onDelete?: () => void }) {
  const [showMenu, setShowMenu] = useState(false);

  if (msg.deleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <span className="text-xs italic px-3 py-1.5 rounded-xl" style={{ color: 'var(--os-text-dim)', background: 'rgba(255,255,255,0.03)' }}>
          Сообщение удалено
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end gap-2 mb-1 group`}
      style={{ animation: 'message-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
      {!isOwn && (
        <div className="flex-shrink-0 w-7 mb-0.5">
          {showAvatar && senderAvatar
            ? <Avatar initials={senderAvatar} color={senderColor || AVATAR_COLORS[0]} size="xs" />
            : null}
        </div>
      )}
      <div className="max-w-[74%] relative" onMouseLeave={() => setShowMenu(false)}>
        {!isOwn && showAvatar && senderName && (
          <div className="text-xs mb-1 ml-1 font-semibold" style={{ color: 'var(--os-purple-light)' }}>{senderName}</div>
        )}
        <div className={`relative px-3.5 py-2.5 rounded-2xl ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'} cursor-pointer`}
          style={{
            background: isOwn ? 'var(--os-msg-out)' : 'var(--os-msg-in)',
            border: isOwn ? 'none' : '1px solid var(--os-border)',
            boxShadow: isOwn ? '0 2px 16px rgba(109,40,217,0.35)' : 'none',
          }}
          onClick={() => setShowMenu(s => !s)}>
          {msg.type === 'text' && (
            <p className="text-sm leading-relaxed" style={{ color: isOwn ? '#fff' : 'var(--os-text)' }}>{msg.text}</p>
          )}
          {msg.type === 'image' && (
            <div>
              <div className="w-48 h-36 rounded-xl overflow-hidden" style={{ background: 'var(--os-surface3)' }}>
                <img src={msg.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
              {msg.text && <p className="text-sm mt-1.5" style={{ color: isOwn ? '#fff' : 'var(--os-text)' }}>{msg.text}</p>}
            </div>
          )}
          {msg.type === 'voice' && <VoiceMessage duration={msg.voiceDuration || 5} isOwn={isOwn} />}
          {msg.type === 'file' && (
            <div className="flex items-center gap-2.5 py-0.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(124,58,237,0.2)' }}>
                <Icon name="File" size={15} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: isOwn ? '#fff' : 'var(--os-text)' }}>{msg.fileName}</div>
                <div className="text-[10px] opacity-60" style={{ color: isOwn ? '#fff' : 'var(--os-text-muted)' }}>Файл</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px]" style={{ color: isOwn ? 'rgba(255,255,255,0.55)' : 'var(--os-text-dim)' }}>
              {formatTime(msg.timestamp)}
            </span>
            {isOwn && <MsgStatus status={msg.status} />}
          </div>
        </div>
        {showMenu && onDelete && isOwn && (
          <div className="absolute bottom-full right-0 mb-1 z-20" style={{ animation: 'fadeInScale 0.15s ease forwards' }}>
            <button onClick={() => { onDelete(); setShowMenu(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'var(--os-surface3)', border: '1px solid var(--os-border)', color: '#f87171' }}>
              <Icon name="Trash2" size={12} /> Удалить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Window ─────────────────────────────────────────────────────────────

function ChatWindow({ chat, allUsers, messages, onSend, onDelete, onClose }:
  { chat: Chat; allUsers: User[]; messages: Message[]; onSend: (chatId: string, msg: Partial<Message>) => void; onDelete: (msgId: string) => void; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const chatMessages = messages.filter(m => m.chatId === chat.id);
  const otherUser = chat.type === 'personal'
    ? allUsers.find(u => chat.participants.includes(u.id)) || null
    : null;

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const handleTyping = (val: string) => {
    setInput(val);
    setIsTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), 2000);
  };

  const sendText = () => {
    if (!input.trim()) return;
    onSend(chat.id, { type: 'text', text: input.trim() });
    setInput('');
    setIsTyping(false);
  };

  const sendVoice = () => {
    if (!recording) {
      setRecording(true);
      setRecordTime(0);
      recordTimer.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } else {
      if (recordTimer.current) clearInterval(recordTimer.current);
      onSend(chat.id, { type: 'voice', voiceDuration: Math.max(recordTime, 1) });
      setRecording(false);
      setRecordTime(0);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => onSend(chat.id, { type: 'image', imageUrl: ev.target?.result as string });
      reader.readAsDataURL(file);
    } else {
      onSend(chat.id, { type: 'file', fileName: file.name });
    }
    setShowAttach(false);
    e.target.value = '';
  };

  const getUserById = (id: string) => allUsers.find(u => u.id === id);

  return (
    <div className="flex flex-col h-full animate-slide-right">
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: 'var(--os-surface)', borderBottom: '1px solid var(--os-border)' }}>
        <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity">
          <Icon name="ChevronLeft" size={22} style={{ color: 'var(--os-text)' }} />
        </button>
        <Avatar initials={chat.avatar} color={chat.color} size="sm" online={otherUser?.online || false} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" style={{ color: 'var(--os-text)' }}>{chat.name}</div>
          <div className="text-xs" style={{ color: 'var(--os-text-muted)' }}>
            {chat.type === 'group'
              ? `${chat.participants.length} участников`
              : otherUser?.online
                ? <span className="text-green-400">онлайн</span>
                : otherUser?.lastSeen || 'давно'}
          </div>
        </div>
        <button className="opacity-60 hover:opacity-100 transition-opacity">
          <Icon name="Phone" size={20} style={{ color: 'var(--os-text)' }} />
        </button>
        <button className="opacity-60 hover:opacity-100 transition-opacity ml-2">
          <Icon name="MoreVertical" size={20} style={{ color: 'var(--os-text)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4" style={{ background: 'var(--os-bg)' }}>
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
            <Icon name="MessageCircle" size={44} style={{ color: 'var(--os-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--os-text-muted)' }}>Начните переписку</p>
          </div>
        )}
        {chatMessages.map((msg, i) => {
          const prev = chatMessages[i - 1];
          const isOwn = msg.senderId === 'me';
          const sender = !isOwn ? getUserById(msg.senderId) : undefined;
          const showAvatar = !isOwn && (!prev || prev.senderId !== msg.senderId);
          return (
            <ChatMessage key={msg.id} msg={msg} isOwn={isOwn}
              senderName={sender?.name} senderAvatar={sender?.avatar} senderColor={sender?.color}
              showAvatar={showAvatar} onDelete={() => onDelete(msg.id)} />
          );
        })}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEnd} />
      </div>

      {recording && (
        <div className="flex items-center gap-3 px-4 py-2.5 animate-fade-in" style={{ background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: 'pulse 1s infinite' }} />
          <span className="text-sm" style={{ color: '#f87171' }}>Запись голосового... {recordTime}с</span>
          <span className="ml-auto text-xs" style={{ color: 'var(--os-text-muted)' }}>нажмите снова чтобы отправить</span>
        </div>
      )}

      {showAttach && (
        <div className="px-4 py-3 flex gap-4 animate-slide-up" style={{ background: 'var(--os-surface)', borderTop: '1px solid var(--os-border)' }}>
          {[
            { icon: 'Image', label: 'Фото', accept: 'image/*' },
            { icon: 'File', label: 'Файл', accept: '*/*' },
          ].map(item => (
            <label key={item.icon} className="flex flex-col items-center gap-1.5 cursor-pointer">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110"
                style={{ background: 'var(--os-surface3)', border: '1px solid var(--os-border)' }}>
                <Icon name={item.icon as 'Image' | 'File'} size={20} style={{ color: 'var(--os-purple-light)' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--os-text-muted)' }}>{item.label}</span>
              <input type="file" accept={item.accept} className="hidden" onChange={handleFile} />
            </label>
          ))}
        </div>
      )}

      <div className="px-3 py-3 flex items-center gap-2 flex-shrink-0" style={{ background: 'var(--os-surface)', borderTop: '1px solid var(--os-border)' }}>
        <button onClick={() => setShowAttach(s => !s)}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
          style={{
            background: showAttach ? 'var(--os-gradient)' : 'var(--os-surface2)',
            border: '1px solid var(--os-border)',
            transform: showAttach ? 'rotate(45deg)' : 'none',
          }}>
          <Icon name="Plus" size={18} style={{ color: showAttach ? '#fff' : 'var(--os-text-muted)' }} />
        </button>
        <div className="flex-1 flex items-center rounded-2xl px-4 py-2.5" style={{ background: 'var(--os-surface2)', border: '1px solid var(--os-border)' }}>
          <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Сообщение..."
            value={input} onChange={e => handleTyping(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendText()}
            style={{ color: 'var(--os-text)' }} />
        </div>
        <button onClick={input.trim() ? sendText : sendVoice}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 os-glow-sm"
          style={{ background: recording ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'var(--os-gradient)' }}>
          {input.trim()
            ? <Icon name="Send" size={15} className="text-white" style={{ transform: 'rotate(-45deg) translateX(1px)' }} />
            : <Icon name={recording ? 'Square' : 'Mic'} size={16} className="text-white" />
          }
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ─── Chat List Item ───────────────────────────────────────────────────────────

function ChatListItem({ chat, active, onClick }: { chat: Chat; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all relative"
      style={{ background: active ? 'rgba(124,58,237,0.08)' : 'transparent', borderBottom: '1px solid var(--os-border)' }}>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-r-full" style={{ background: 'var(--os-gradient)' }} />}
      <div className="relative flex-shrink-0">
        <Avatar initials={chat.avatar} color={chat.color} size="md" />
        {chat.type === 'group' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: 'var(--os-surface)', border: '1px solid var(--os-border)' }}>
            <Icon name="Users" size={8} style={{ color: 'var(--os-purple-light)' }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--os-text)' }}>{chat.name}</span>
            {chat.pinned && <Icon name="Pin" size={9} style={{ color: 'var(--os-text-dim)', transform: 'rotate(45deg)', flexShrink: 0 }} />}
          </div>
          {chat.lastMessage && (
            <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: 'var(--os-text-dim)' }}>
              {formatChatTime(chat.lastMessage.timestamp)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--os-text-muted)' }}>
            {chat.isTyping
              ? <span style={{ color: 'var(--os-purple-light)' }}>печатает...</span>
              : chat.lastMessage?.type === 'voice' ? '🎤 Голосовое'
                : chat.lastMessage?.type === 'image' ? '📷 Фото'
                  : chat.lastMessage?.type === 'file' ? `📎 ${chat.lastMessage.fileName}`
                    : chat.lastMessage?.text || ''}
          </span>
          {chat.unread > 0 && (
            <div className="flex-shrink-0 ml-2 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
              style={{ background: 'var(--os-gradient)' }}>
              {chat.unread}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chats Tab ────────────────────────────────────────────────────────────────

function ChatsTab({ chats, messages, allUsers, onSend, onDelete, initialChat, onClearInitial }:
  { chats: Chat[]; messages: Message[]; allUsers: User[]; currentUser: User; onSend: (chatId: string, msg: Partial<Message>) => void; onDelete: (msgId: string) => void; initialChat?: Chat | null; onClearInitial?: () => void }) {
  const [activeChat, setActiveChat] = useState<Chat | null>(initialChat || null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (initialChat) { setActiveChat(initialChat); onClearInitial?.(); }
  }, [initialChat, onClearInitial]);

  const filtered = chats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.lastMessage?.timestamp.getTime() || 0) - (a.lastMessage?.timestamp.getTime() || 0);
  });

  if (activeChat) {
    return (
      <ChatWindow chat={activeChat} allUsers={allUsers} messages={messages}
        onSend={onSend} onDelete={onDelete} onClose={() => setActiveChat(null)} />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--os-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-black font-display os-gradient-text">Чаты</h1>
          <button className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--os-surface2)', border: '1px solid var(--os-border)' }}>
            <Icon name="Edit" size={14} style={{ color: 'var(--os-purple-light)' }} />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--os-surface2)', border: '1px solid var(--os-border)' }}>
          <Icon name="Search" size={14} style={{ color: 'var(--os-text-dim)' }} />
          <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Поиск чатов..."
            value={search} onChange={e => setSearch(e.target.value)} style={{ color: 'var(--os-text)' }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
            <Icon name="MessageSquare" size={40} style={{ color: 'var(--os-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--os-text-muted)' }}>Нет чатов</p>
          </div>
        )}
        {sorted.map(c => (
          <ChatListItem key={c.id} chat={c} active={activeChat?.id === c.id} onClick={() => setActiveChat(c)} />
        ))}
      </div>
    </div>
  );
}

// ─── Search Tab ───────────────────────────────────────────────────────────────

function SearchTab({ allUsers, currentUser, onStartChat }:
  { allUsers: User[]; currentUser: User; onStartChat: (u: User) => void }) {
  const [query, setQuery] = useState('');
  const results = query.trim()
    ? allUsers.filter(u => u.id !== currentUser.id && (
      u.username.toLowerCase().includes(query.toLowerCase().replace('@', '')) ||
      u.name.toLowerCase().includes(query.toLowerCase())
    ))
    : [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--os-border)' }}>
        <h1 className="text-xl font-black font-display os-gradient-text mb-4">Поиск</h1>
        <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: 'var(--os-surface2)', border: '1px solid var(--os-border)' }}>
          <Icon name="Search" size={16} style={{ color: 'var(--os-text-dim)' }} />
          <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Найти по @username..."
            value={query} onChange={e => setQuery(e.target.value)} style={{ color: 'var(--os-text)' }} autoFocus />
          {query && <button onClick={() => setQuery('')}><Icon name="X" size={14} style={{ color: 'var(--os-text-dim)' }} /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3">
        {!query && (
          <div className="pt-8 flex flex-col items-center gap-3 opacity-30">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: 'var(--os-surface2)' }}>
              <Icon name="UserSearch" size={28} style={{ color: 'var(--os-text-muted)' }} />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--os-text-muted)' }}>Введите имя или @username</p>
          </div>
        )}
        {query && results.length === 0 && (
          <div className="pt-8 flex flex-col items-center gap-2 opacity-30">
            <Icon name="SearchX" size={36} style={{ color: 'var(--os-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--os-text-muted)' }}>Не найдено</p>
          </div>
        )}
        {results.map((user, i) => (
          <div key={user.id} onClick={() => onStartChat(user)}
            className="flex items-center gap-3 py-3 cursor-pointer rounded-2xl px-3 mb-2 transition-all hover:scale-[1.01] animate-fade-in"
            style={{ background: 'var(--os-surface)', border: '1px solid var(--os-border)', animationDelay: `${i * 0.05}s` }}>
            <Avatar initials={user.avatar} color={user.color} size="md" online={user.online} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--os-text)' }}>{user.name}</span>
                {user.online && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>онлайн</span>}
              </div>
              <span className="text-xs" style={{ color: 'var(--os-text-muted)' }}>@{user.username}</span>
              {user.bio && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--os-text-dim)' }}>{user.bio}</p>}
            </div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--os-gradient)' }}>
              <Icon name="MessageCircle" size={14} className="text-white" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({ allUsers, currentUser, onStartChat }:
  { allUsers: User[]; currentUser: User; onStartChat: (u: User) => void }) {
  const contacts = allUsers.filter(u => u.id !== currentUser.id);
  const online = contacts.filter(u => u.online);
  const offline = contacts.filter(u => !u.online);

  const Section = ({ title, users }: { title: string; users: User[] }) => (
    <div className="mb-2">
      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--os-text-dim)' }}>{title}</div>
      {users.map(user => (
        <div key={user.id} onClick={() => onStartChat(user)}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-white/5"
          style={{ borderBottom: '1px solid var(--os-border)' }}>
          <Avatar initials={user.avatar} color={user.color} size="md" online={user.online} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: 'var(--os-text)' }}>{user.name}</div>
            <div className="text-xs" style={{ color: 'var(--os-text-muted)' }}>
              @{user.username}
              {!user.online && user.lastSeen && <span className="ml-2" style={{ color: 'var(--os-text-dim)' }}>• {user.lastSeen}</span>}
            </div>
          </div>
          <Icon name="ChevronRight" size={14} style={{ color: 'var(--os-text-dim)' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--os-border)' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black font-display os-gradient-text">Контакты</h1>
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--os-surface2)', color: 'var(--os-text-muted)', border: '1px solid var(--os-border)' }}>
            {contacts.length}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pt-2">
        {online.length > 0 && <Section title={`В сети · ${online.length}`} users={online} />}
        {offline.length > 0 && <Section title="Не в сети" users={offline} />}
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ user, onLogout, onUpdate }: { user: User; onLogout: () => void; onUpdate: (u: User) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);

  const save = () => {
    const updated = { ...user, name, bio, avatar: name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() };
    onUpdate(updated);
    localStorage.setItem('osinting_current_user', JSON.stringify(updated));
    setEditing(false);
  };

  const menuItems = [
    { icon: 'Edit3', label: 'Редактировать профиль', action: () => setEditing(true) },
    { icon: 'Bell', label: 'Уведомления' },
    { icon: 'Shield', label: 'Конфиденциальность' },
    { icon: 'Lock', label: 'Безопасность' },
    { icon: 'Palette', label: 'Оформление' },
    { icon: 'HelpCircle', label: 'Помощь' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="relative px-4 pt-10 pb-8 flex flex-col items-center text-center overflow-hidden flex-shrink-0">
        <div className="os-mesh-bg opacity-50">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="avatar-gradient-border mb-4">
            <Avatar initials={user.avatar} color={user.color} size="xl" online />
          </div>
          {editing ? (
            <div className="space-y-2 w-full max-w-[240px]">
              <input className="os-input w-full px-3 py-2 rounded-xl text-sm text-center font-semibold"
                value={name} onChange={e => setName(e.target.value)} style={{ color: 'var(--os-text)' }} />
              <input className="os-input w-full px-3 py-2 rounded-xl text-sm text-center"
                placeholder="О себе..." value={bio} onChange={e => setBio(e.target.value)} style={{ color: 'var(--os-text)' }} />
              <div className="flex gap-2">
                <button onClick={save} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white os-btn-primary">Сохранить</button>
                <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--os-surface2)', color: 'var(--os-text-muted)', border: '1px solid var(--os-border)' }}>Отмена</button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold font-display" style={{ color: 'var(--os-text)' }}>{user.name}</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--os-text-muted)' }}>@{user.username}</p>
              {user.bio && <p className="text-sm mt-2 max-w-[240px]" style={{ color: 'var(--os-text-muted)' }}>{user.bio}</p>}
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />онлайн
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 mb-4">
        {[{ label: 'Сообщений', value: '1.2k' }, { label: 'Контактов', value: '24' }, { label: 'Групп', value: '3' }].map(s => (
          <div key={s.label} className="flex flex-col items-center py-3 rounded-2xl" style={{ background: 'var(--os-surface)', border: '1px solid var(--os-border)' }}>
            <span className="text-lg font-bold font-display os-gradient-text">{s.value}</span>
            <span className="text-[10px] mt-0.5" style={{ color: 'var(--os-text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="px-4 space-y-2">
        {menuItems.map(item => (
          <button key={item.label} onClick={item.action}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all hover:scale-[1.01] text-left"
            style={{ background: 'var(--os-surface)', border: '1px solid var(--os-border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(124,58,237,0.12)' }}>
              <Icon name={item.icon as 'Edit3'} size={16} style={{ color: 'var(--os-purple-light)' }} />
            </div>
            <span className="text-sm font-medium flex-1" style={{ color: 'var(--os-text)' }}>{item.label}</span>
            <Icon name="ChevronRight" size={14} style={{ color: 'var(--os-text-dim)' }} />
          </button>
        ))}

        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all hover:scale-[1.01] mt-2"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <Icon name="LogOut" size={16} style={{ color: '#f87171' }} />
          </div>
          <span className="text-sm font-medium" style={{ color: '#f87171' }}>Выйти из аккаунта</span>
        </button>
      </div>
      <div className="h-8" />
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

function BottomNav({ active, onChange, totalUnread }: { active: AppTab; onChange: (t: AppTab) => void; totalUnread: number }) {
  const tabs: { id: AppTab; icon: string; label: string }[] = [
    { id: 'chats', icon: 'MessageCircle', label: 'Чаты' },
    { id: 'search', icon: 'Search', label: 'Поиск' },
    { id: 'contacts', icon: 'Users', label: 'Контакты' },
    { id: 'profile', icon: 'User', label: 'Профиль' },
  ];
  return (
    <div className="flex items-center px-2 py-2 flex-shrink-0" style={{ background: 'var(--os-surface)', borderTop: '1px solid var(--os-border)' }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all duration-200 relative"
            style={{ background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent' }}>
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ background: 'var(--os-gradient)' }} />
            )}
            <div className="relative">
              <Icon name={t.icon as 'MessageCircle'} size={20} style={{ color: isActive ? 'var(--os-purple-light)' : 'var(--os-text-dim)' }} />
              {t.id === 'chats' && totalUnread > 0 && (
                <div className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5"
                  style={{ background: 'var(--os-gradient)' }}>
                  {totalUnread > 9 ? '9+' : totalUnread}
                </div>
              )}
            </div>
            <span className="text-[10px] font-medium" style={{ color: isActive ? 'var(--os-purple-light)' : 'var(--os-text-dim)' }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── App Screen ───────────────────────────────────────────────────────────────

function AppScreen({ currentUser, onLogout }: { currentUser: User; onLogout: () => void }) {
  const [tab, setTab] = useState<AppTab>('chats');
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS);
  const [user, setUser] = useState(currentUser);
  const [pendingChat, setPendingChat] = useState<Chat | null>(null);

  const allUsers = [
    ...ALL_USERS,
    ...JSON.parse(localStorage.getItem('osinting_users') || '[]').filter((u: User) => !ALL_USERS.find(au => au.id === u.id) && u.id !== user.id),
  ];

  const totalUnread = chats.reduce((s, c) => s + c.unread, 0);

  const handleSend = useCallback((chatId: string, partial: Partial<Message>) => {
    const msg: Message = {
      id: genId(), chatId, senderId: 'me',
      type: partial.type || 'text', text: partial.text,
      imageUrl: partial.imageUrl, voiceDuration: partial.voiceDuration, fileName: partial.fileName,
      timestamp: new Date(), status: 'sending',
    };
    setMessages(prev => [...prev, msg]);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage: msg, unread: 0 } : c));
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sent' } : m));
      setTimeout(() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'read' } : m)), 1500);
    }, 600);
  }, []);

  const handleDelete = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true } : m));
  }, []);

  const handleStartChat = (targetUser: User) => {
    let chat = chats.find(c => c.type === 'personal' && c.participants.includes(targetUser.id));
    if (!chat) {
      chat = { id: genId(), type: 'personal', name: targetUser.name, avatar: targetUser.avatar, color: targetUser.color, participants: ['me', targetUser.id], unread: 0 };
      setChats(prev => [...prev, chat!]);
    }
    setPendingChat(chat);
    setTab('chats');
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--os-bg)' }}>
      <div className="flex-1 overflow-hidden">
        {tab === 'chats' && (
          <ChatsTab chats={chats} messages={messages} allUsers={allUsers} currentUser={user}
            onSend={handleSend} onDelete={handleDelete}
            initialChat={pendingChat} onClearInitial={() => setPendingChat(null)} />
        )}
        {tab === 'search' && (
          <SearchTab allUsers={allUsers} currentUser={user} onStartChat={handleStartChat} />
        )}
        {tab === 'contacts' && (
          <ContactsTab allUsers={allUsers} currentUser={user} onStartChat={handleStartChat} />
        )}
        {tab === 'profile' && (
          <ProfileTab user={user} onLogout={onLogout} onUpdate={setUser} />
        )}
      </div>
      <BottomNav active={tab} onChange={setTab} totalUnread={totalUnread} />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Index() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Init demo passwords
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('osinting_passwords') || '{}');
    ALL_USERS.forEach(u => { if (!passwords[u.id]) passwords[u.id] = 'demo123'; });
    localStorage.setItem('osinting_passwords', JSON.stringify(passwords));
    // Init demo users
    const stored: User[] = JSON.parse(localStorage.getItem('osinting_users') || '[]');
    const merged = [...ALL_USERS, ...stored.filter(u => !ALL_USERS.find(au => au.id === u.id))];
    localStorage.setItem('osinting_users', JSON.stringify(merged));
    // Auto-login
    const saved = localStorage.getItem('osinting_current_user');
    if (saved) {
      try { const u = JSON.parse(saved); setCurrentUser(u); setScreen('app'); } catch (e) { console.warn(e); }
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setScreen('app');
    localStorage.setItem('osinting_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    localStorage.removeItem('osinting_current_user');
    setCurrentUser(null);
    setScreen('auth');
  };

  if (screen === 'auth') return <AuthScreen onLogin={handleLogin} />;
  if (screen === 'app' && currentUser) return <AppScreen currentUser={currentUser} onLogout={handleLogout} />;
  return null;
}