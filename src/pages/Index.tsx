import { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type Screen = 'auth' | 'app' | 'loading';
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
  timestamp: string;
  status: MessageStatus;
  deleted?: boolean;
  _local?: boolean;
}

interface Chat {
  id: string;
  type: 'personal' | 'group';
  name: string;
  avatar: string;
  color: string;
  memberCount?: number;
  lastMessage?: {
    id: string; type: string; text?: string; fileName?: string; timestamp: string; senderId: string;
  };
  unread: number;
  otherUser?: User | null;
  isTyping?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatChatTime(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 86400000) return formatTime(ts);
    if (diff < 172800000) return 'вчера';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  } catch { return ''; }
}

function genLocalId(): string {
  return `local_${Math.random().toString(36).slice(2)}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, color, size = 'md', online = false, className = '' }:
  { initials: string; color: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; online?: boolean; className?: string }) {
  const sizes: Record<string, string> = {
    xs: 'w-7 h-7 text-xs', sm: 'w-9 h-9 text-sm', md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base', xl: 'w-20 h-20 text-xl',
  };
  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-semibold text-white font-display select-none`}>
        {initials || '?'}
      </div>
      {online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#07070f] z-10" />}
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
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError('');
    if (!username || !password) { setError('Заполните все поля'); return; }
    if (tab === 'register' && !name) { setError('Введите имя'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true);
    try {
      let res;
      if (tab === 'login') {
        res = await api.auth.login(username.trim().toLowerCase(), password);
      } else {
        res = await api.auth.register(username.trim().toLowerCase(), password, name.trim(), bio.trim());
      }
      localStorage.setItem('osinting_token', res.token as string);
      onLogin(res.user as User);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-center overflow-hidden" style={{ background: 'var(--os-bg)' }}>
      <div className="os-mesh-bg"><div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" /></div>
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
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
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
          <input className="os-input w-full px-4 py-3 rounded-xl text-sm" placeholder="Пароль (мин. 6 символов) *" type="password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()} style={{ color: 'var(--os-text)' }} />
          {tab === 'register' && (
            <input className="os-input w-full px-4 py-3 rounded-xl text-sm" placeholder="О себе (необязательно)"
              value={bio} onChange={e => setBio(e.target.value)} style={{ color: 'var(--os-text)' }} />
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm animate-fade-in"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}

          <button onClick={handle} disabled={loading}
            className="os-btn-primary w-full py-3 rounded-xl font-semibold text-sm mt-2 flex items-center justify-center gap-2">
            {loading
              ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <><Icon name={tab === 'login' ? 'LogIn' : 'UserPlus'} size={16} />{tab === 'login' ? 'Войти' : 'Создать аккаунт'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="flex items-end gap-2 animate-fade-in mb-1">
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2" style={{ background: 'var(--os-msg-in)', border: '1px solid var(--os-border)' }}>
        <div className="flex gap-1 items-center">
          {[1, 2, 3].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full typing-dot-${i}`} style={{ background: 'var(--os-text-muted)' }} />)}
        </div>
        <span className="text-xs" style={{ color: 'var(--os-text-muted)' }}>{names[0]} печатает...</span>
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
    const iv = setInterval(() => {
      p += 100 / (duration * 10);
      setProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(iv); setPlaying(false); setProgress(0); }
    }, 100);
  };

  return (
    <div className="flex items-center gap-2.5 py-0.5 min-w-[160px]">
      <button onClick={toggle} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
        style={{ background: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(124,58,237,0.3)' }}>
        <Icon name={playing ? 'Pause' : 'Play'} size={13} className="text-white" />
      </button>
      <div className="flex items-center gap-0.5 flex-1 h-5">
        {bars.map((h, i) => (
          <div key={i} className="waveform-bar flex-shrink-0 rounded-full"
            style={{
              height: `${h}px`, width: '3px', animationDelay: `${i * 0.04}s`,
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

// ─── Message Status ───────────────────────────────────────────────────────────

function MsgStatus({ status }: { status: MessageStatus }) {
  if (status === 'sending') return <Icon name="Clock" size={11} className="opacity-40" />;
  if (status === 'sent') return <Icon name="Check" size={11} style={{ color: 'rgba(255,255,255,0.6)' }} />;
  return <Icon name="CheckCheck" size={11} style={{ color: 'var(--os-cyan)' }} />;
}

// ─── Chat Message ─────────────────────────────────────────────────────────────

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
          {showAvatar && senderAvatar ? <Avatar initials={senderAvatar} color={senderColor || 'from-purple-600 to-pink-500'} size="xs" /> : null}
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
            opacity: msg._local ? 0.7 : 1,
          }}
          onClick={() => setShowMenu(s => !s)}>
          {msg.type === 'text' && (
            <p className="text-sm leading-relaxed" style={{ color: isOwn ? '#fff' : 'var(--os-text)' }}>{msg.text}</p>
          )}
          {msg.type === 'image' && (
            <div>
              <div className="w-48 h-36 rounded-xl overflow-hidden" style={{ background: 'var(--os-surface3)' }}>
                {msg.imageUrl
                  ? <img src={msg.imageUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" /></div>
                }
              </div>
              {msg.text && <p className="text-sm mt-1.5" style={{ color: isOwn ? '#fff' : 'var(--os-text)' }}>{msg.text}</p>}
            </div>
          )}
          {msg.type === 'voice' && <VoiceMessage duration={msg.voiceDuration || 3} isOwn={isOwn} />}
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
          <div className="absolute bottom-full right-0 mb-1 z-20 animate-fade-in-scale">
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

// ─── Chat Window ──────────────────────────────────────────────────────────────

function ChatWindow({ chat, currentUser, messages, onSend, onDelete, onClose }:
  { chat: Chat; currentUser: User; messages: Message[]; onSend: (partial: Partial<Message>) => Promise<void>; onDelete: (msgId: string) => void; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const [typers, setTypers] = useState<string[]>([]);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTypingRef = useRef(false);

  const chatMessages = messages.filter(m => m.chatId === chat.id);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Poll typing indicators
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.chats.getTyping(chat.id);
        const t = (res.typers as Array<{ id: string; name: string }>) || [];
        setTypers(t.map(x => x.name));
      } catch { /* silent */ }
    };
    typingPollTimer.current = setInterval(poll, 3000);
    return () => { if (typingPollTimer.current) clearInterval(typingPollTimer.current); };
  }, [chat.id]);

  const handleTyping = (val: string) => {
    setInput(val);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      api.chats.setTyping(chat.id, true).catch(() => {});
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      api.chats.setTyping(chat.id, false).catch(() => {});
    }, 2000);
  };

  const sendText = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    isTypingRef.current = false;
    api.chats.setTyping(chat.id, false).catch(() => {});
    await onSend({ type: 'text', text });
  };

  const sendVoice = () => {
    if (!recording) {
      setRecording(true); setRecordTime(0);
      recordTimer.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } else {
      if (recordTimer.current) clearInterval(recordTimer.current);
      const dur = Math.max(recordTime, 1);
      setRecording(false); setRecordTime(0);
      onSend({ type: 'voice', voiceDuration: dur });
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => {
        const data = ev.target?.result as string;
        onSend({ type: 'image', imageUrl: data });
      };
      reader.readAsDataURL(file);
    } else {
      onSend({ type: 'file', fileName: file.name });
    }
    setShowAttach(false);
    e.target.value = '';
  };

  const otherUser = chat.otherUser;
  const memberMap: Record<string, User> = {};

  return (
    <div className="flex flex-col h-full animate-slide-right">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: 'var(--os-surface)', borderBottom: '1px solid var(--os-border)' }}>
        <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity">
          <Icon name="ChevronLeft" size={22} style={{ color: 'var(--os-text)' }} />
        </button>
        <Avatar initials={chat.avatar} color={chat.color} size="sm" online={otherUser?.online || false} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" style={{ color: 'var(--os-text)' }}>{chat.name}</div>
          <div className="text-xs" style={{ color: 'var(--os-text-muted)' }}>
            {typers.length > 0
              ? <span style={{ color: 'var(--os-purple-light)' }}>{typers[0]} печатает...</span>
              : chat.type === 'group'
                ? `${chat.memberCount || ''} участников`
                : otherUser?.online
                  ? <span className="text-green-400">онлайн</span>
                  : otherUser?.lastSeen
                    ? `был(а) ${new Date(otherUser.lastSeen).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`
                    : 'давно'
            }
          </div>
        </div>
        <button className="opacity-60 hover:opacity-100 transition-opacity">
          <Icon name="Phone" size={20} style={{ color: 'var(--os-text)' }} />
        </button>
        <button className="opacity-60 hover:opacity-100 transition-opacity ml-2">
          <Icon name="MoreVertical" size={20} style={{ color: 'var(--os-text)' }} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4" style={{ background: 'var(--os-bg)' }}>
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
            <Icon name="MessageCircle" size={44} style={{ color: 'var(--os-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--os-text-muted)' }}>Начните переписку</p>
          </div>
        )}
        {chatMessages.map((msg, i) => {
          const prev = chatMessages[i - 1];
          const isOwn = msg.senderId === currentUser.id;
          const showAvatar = !isOwn && (!prev || prev.senderId !== msg.senderId);
          const sender = memberMap[msg.senderId];
          return (
            <ChatMessage key={msg.id} msg={msg} isOwn={isOwn}
              senderName={sender?.name} senderAvatar={sender?.avatar} senderColor={sender?.color}
              showAvatar={showAvatar} onDelete={() => onDelete(msg.id)} />
          );
        })}
        <TypingIndicator names={typers} />
        <div ref={messagesEnd} />
      </div>

      {recording && (
        <div className="flex items-center gap-3 px-4 py-2.5 animate-fade-in" style={{ background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: 'pulse 1s infinite' }} />
          <span className="text-sm" style={{ color: '#f87171' }}>Запись... {recordTime}с</span>
          <span className="ml-auto text-xs" style={{ color: 'var(--os-text-muted)' }}>нажмите ещё раз — отправить</span>
        </div>
      )}

      {showAttach && (
        <div className="px-4 py-3 flex gap-4 animate-slide-up" style={{ background: 'var(--os-surface)', borderTop: '1px solid var(--os-border)' }}>
          {[{ icon: 'Image', label: 'Фото', accept: 'image/*' }, { icon: 'File', label: 'Файл', accept: '*/*' }].map(item => (
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

      {/* Input bar */}
      <div className="px-3 py-3 flex items-center gap-2 flex-shrink-0" style={{ background: 'var(--os-surface)', borderTop: '1px solid var(--os-border)' }}>
        <button onClick={() => setShowAttach(s => !s)}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
          style={{ background: showAttach ? 'var(--os-gradient)' : 'var(--os-surface2)', border: '1px solid var(--os-border)', transform: showAttach ? 'rotate(45deg)' : 'none' }}>
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
  const lastText = chat.lastMessage
    ? chat.lastMessage.type === 'voice' ? '🎤 Голосовое'
      : chat.lastMessage.type === 'image' ? '📷 Фото'
        : chat.lastMessage.type === 'file' ? `📎 ${chat.lastMessage.fileName}`
          : chat.lastMessage.text || ''
    : '';

  return (
    <div onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all relative"
      style={{ background: active ? 'rgba(124,58,237,0.08)' : 'transparent', borderBottom: '1px solid var(--os-border)' }}>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-r-full" style={{ background: 'var(--os-gradient)' }} />}
      <div className="relative flex-shrink-0">
        <Avatar initials={chat.avatar} color={chat.color} size="md" online={chat.otherUser?.online || false} />
        {chat.type === 'group' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: 'var(--os-surface)', border: '1px solid var(--os-border)' }}>
            <Icon name="Users" size={8} style={{ color: 'var(--os-purple-light)' }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--os-text)' }}>{chat.name}</span>
          <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: 'var(--os-text-dim)' }}>
            {formatChatTime(chat.lastMessage?.timestamp)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs truncate max-w-[180px]" style={{ color: chat.isTyping ? 'var(--os-purple-light)' : 'var(--os-text-muted)' }}>
            {chat.isTyping ? 'печатает...' : lastText}
          </span>
          {chat.unread > 0 && (
            <div className="flex-shrink-0 ml-2 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
              style={{ background: 'var(--os-gradient)' }}>
              {chat.unread > 9 ? '9+' : chat.unread}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chats Tab ────────────────────────────────────────────────────────────────

function ChatsTab({ currentUser, pendingChat, onClearPending }:
  { currentUser: User; pendingChat: Chat | null; onClearPending: () => void }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollRef = useRef<string>(new Date(Date.now() - 5000).toISOString());

  // Load initial chats
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.chats.list();
        setChats((res.chats as Chat[]) || []);
      } catch { /* silent */ } finally { setLoading(false); }
    };
    load();
  }, []);

  // Open pending chat from search/contacts
  useEffect(() => {
    if (pendingChat) {
      setActiveChat(pendingChat);
      if (!chats.find(c => c.id === pendingChat.id)) {
        setChats(prev => [pendingChat, ...prev]);
      }
      onClearPending();
    }
  }, [pendingChat, onClearPending, chats]);

  // Global polling for new messages across all chats
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.messages.globalPoll(lastPollRef.current);
        const newMsgs = (res.messages as Message[]) || [];
        if (newMsgs.length > 0) {
          lastPollRef.current = new Date().toISOString();
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const toAdd = newMsgs.filter(m => !ids.has(m.id)).map(m => ({
              ...m, status: m.senderId === currentUser.id ? 'sent' : 'read' as MessageStatus
            }));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });
          // Update chat last messages and unread counts
          setChats(prev => prev.map(chat => {
            const chatNewMsgs = newMsgs.filter(m => m.chatId === chat.id);
            if (!chatNewMsgs.length) return chat;
            const last = chatNewMsgs[chatNewMsgs.length - 1];
            const unreadInc = chatNewMsgs.filter(m => m.senderId !== currentUser.id).length;
            return {
              ...chat,
              lastMessage: { id: last.id, type: last.type, text: last.text, fileName: last.fileName, timestamp: last.timestamp, senderId: last.senderId },
              unread: activeChat?.id === chat.id ? 0 : chat.unread + unreadInc,
            };
          }));
        }
      } catch { /* silent */ }
    };
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [currentUser.id, activeChat?.id]);

  // Load messages when opening a chat
  const handleOpenChat = async (chat: Chat) => {
    setActiveChat(chat);
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
    // Load messages for this chat if not already loaded
    const existing = messages.filter(m => m.chatId === chat.id);
    if (existing.length === 0) {
      try {
        const res = await api.messages.list(chat.id);
        const loaded = (res.messages as Message[]).map(m => ({
          ...m, status: m.senderId === currentUser.id ? 'sent' : 'read' as MessageStatus
        }));
        setMessages(prev => [...prev, ...loaded]);
      } catch { /* silent */ }
    }
  };

  const handleSend = useCallback(async (partial: Partial<Message>) => {
    if (!activeChat) return;
    const localId = genLocalId();
    const localMsg: Message = {
      id: localId, chatId: activeChat.id, senderId: currentUser.id,
      type: partial.type || 'text', text: partial.text,
      imageUrl: partial.imageUrl, voiceDuration: partial.voiceDuration, fileName: partial.fileName,
      timestamp: new Date().toISOString(), status: 'sending', _local: true,
    };
    setMessages(prev => [...prev, localMsg]);
    try {
      const res = await api.messages.send(
        activeChat.id, partial.type || 'text', partial.text,
        partial.type === 'image' ? partial.imageUrl : undefined,
        partial.voiceDuration, partial.fileName
      );
      const serverMsg = res.message as Message;
      setMessages(prev => prev.map(m => m.id === localId
        ? { ...serverMsg, status: 'sent' as MessageStatus }
        : m));
      setChats(prev => prev.map(c => c.id === activeChat.id
        ? { ...c, lastMessage: { id: serverMsg.id, type: serverMsg.type, text: serverMsg.text, fileName: serverMsg.fileName, timestamp: serverMsg.timestamp, senderId: serverMsg.senderId } }
        : c));
      lastPollRef.current = new Date().toISOString();
    } catch {
      setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'sent' as MessageStatus, _local: false } : m));
    }
  }, [activeChat, currentUser.id]);

  const handleDelete = useCallback(async (msgId: string) => {
    if (msgId.startsWith('local_')) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true } : m));
      return;
    }
    try {
      await api.messages.delete(msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true } : m));
    } catch { /* silent */ }
  }, []);

  const filtered = chats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) =>
    (b.lastMessage?.timestamp || '').localeCompare(a.lastMessage?.timestamp || ''));

  if (activeChat) {
    return (
      <ChatWindow chat={activeChat} currentUser={currentUser}
        messages={messages} onSend={handleSend} onDelete={handleDelete}
        onClose={() => setActiveChat(null)} />
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
        {loading && (
          <div className="flex items-center justify-center h-32 gap-2 opacity-40">
            <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
            <span className="text-sm" style={{ color: 'var(--os-text-muted)' }}>Загрузка...</span>
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-30">
            <Icon name="MessageSquare" size={40} style={{ color: 'var(--os-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--os-text-muted)' }}>Нет чатов. Найдите кого-нибудь в Поиске!</p>
          </div>
        )}
        {sorted.map(c => (
          <ChatListItem key={c.id} chat={c} active={activeChat?.id === c.id} onClick={() => handleOpenChat(c)} />
        ))}
      </div>
    </div>
  );
}

// ─── Search Tab ───────────────────────────────────────────────────────────────

function SearchTab({ currentUser, onStartChat }:
  { currentUser: User; onStartChat: (chat: Chat) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.auth.searchUsers(query);
        setResults((res.users as User[]) || []);
      } catch { setResults([]); } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const startChat = async (user: User) => {
    try {
      const res = await api.chats.create('personal', user.id);
      const chatId = res.chatId as string;
      onStartChat({
        id: chatId, type: 'personal', name: user.name, avatar: user.avatar,
        color: user.color, unread: 0, otherUser: user,
      });
    } catch { /* silent */ }
  };

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
        {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" /></div>}
        {!loading && query && results.length === 0 && (
          <div className="pt-8 flex flex-col items-center gap-2 opacity-30">
            <Icon name="SearchX" size={36} style={{ color: 'var(--os-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--os-text-muted)' }}>Не найдено</p>
          </div>
        )}
        {results.filter(u => u.id !== currentUser.id).map((user, i) => (
          <div key={user.id} onClick={() => startChat(user)}
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

function ContactsTab({ currentUser, onStartChat }:
  { currentUser: User; onStartChat: (chat: Chat) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.getUsers().then(res => {
      setUsers((res.users as User[]) || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startChat = async (user: User) => {
    try {
      const res = await api.chats.create('personal', user.id);
      onStartChat({
        id: res.chatId as string, type: 'personal', name: user.name,
        avatar: user.avatar, color: user.color, unread: 0, otherUser: user,
      });
    } catch { /* silent */ }
  };

  const online = users.filter(u => u.online);
  const offline = users.filter(u => !u.online);

  const Section = ({ title, list }: { title: string; list: User[] }) => (
    <div className="mb-2">
      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--os-text-dim)' }}>{title}</div>
      {list.map(user => (
        <div key={user.id} onClick={() => startChat(user)}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-white/5"
          style={{ borderBottom: '1px solid var(--os-border)' }}>
          <Avatar initials={user.avatar} color={user.color} size="md" online={user.online} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: 'var(--os-text)' }}>{user.name}</div>
            <div className="text-xs" style={{ color: 'var(--os-text-muted)' }}>
              @{user.username}
              {!user.online && user.lastSeen && (
                <span className="ml-2" style={{ color: 'var(--os-text-dim)' }}>
                  • {new Date(user.lastSeen).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </span>
              )}
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
            {users.length}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pt-2">
        {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" /></div>}
        {!loading && users.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-30">
            <Icon name="Users" size={40} style={{ color: 'var(--os-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--os-text-muted)' }}>Пока никого нет</p>
          </div>
        )}
        {online.length > 0 && <Section title={`В сети · ${online.length}`} list={online} />}
        {offline.length > 0 && <Section title="Не в сети" list={offline} />}
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ user, onLogout, onUpdate }: { user: User; onLogout: () => void; onUpdate: (u: User) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.auth.updateProfile(name.trim(), bio.trim());
      onUpdate(res.user as User);
      setEditing(false);
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const menuItems = [
    { icon: 'Edit3', label: 'Редактировать профиль', action: () => setEditing(true) },
    { icon: 'Bell', label: 'Уведомления', action: () => {} },
    { icon: 'Shield', label: 'Конфиденциальность', action: () => {} },
    { icon: 'Lock', label: 'Безопасность', action: () => {} },
    { icon: 'Palette', label: 'Оформление', action: () => {} },
    { icon: 'HelpCircle', label: 'Помощь', action: () => {} },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="relative px-4 pt-10 pb-8 flex flex-col items-center text-center overflow-hidden flex-shrink-0">
        <div className="os-mesh-bg opacity-50"><div className="blob blob-1" /><div className="blob blob-2" /></div>
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
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white os-btn-primary flex items-center justify-center">
                  {saving ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : 'Сохранить'}
                </button>
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

      <div className="px-4 space-y-2">
        {menuItems.map(item => (
          <button key={item.label} onClick={item.action}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all hover:scale-[1.01] text-left"
            style={{ background: 'var(--os-surface)', border: '1px solid var(--os-border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.12)' }}>
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
            {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ background: 'var(--os-gradient)' }} />}
            <div className="relative">
              <Icon name={t.icon as 'MessageCircle'} size={20} style={{ color: isActive ? 'var(--os-purple-light)' : 'var(--os-text-dim)' }} />
              {t.id === 'chats' && totalUnread > 0 && (
                <div className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5"
                  style={{ background: 'var(--os-gradient)' }}>
                  {totalUnread > 9 ? '9+' : totalUnread}
                </div>
              )}
            </div>
            <span className="text-[10px] font-medium" style={{ color: isActive ? 'var(--os-purple-light)' : 'var(--os-text-dim)' }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── App Screen ───────────────────────────────────────────────────────────────

function AppScreen({ currentUser, onLogout }: { currentUser: User; onLogout: () => void }) {
  const [tab, setTab] = useState<AppTab>('chats');
  const [user, setUser] = useState(currentUser);
  const [pendingChat, setPendingChat] = useState<Chat | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);

  const handleStartChat = (chat: Chat) => {
    setPendingChat(chat);
    setTab('chats');
  };

  const handleLogout = async () => {
    try { await api.auth.logout(); } catch { /* silent */ }
    localStorage.removeItem('osinting_token');
    onLogout();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--os-bg)' }}>
      <div className="flex-1 overflow-hidden">
        {tab === 'chats' && (
          <ChatsTab currentUser={user} pendingChat={pendingChat} onClearPending={() => setPendingChat(null)} />
        )}
        {tab === 'search' && <SearchTab currentUser={user} onStartChat={handleStartChat} />}
        {tab === 'contacts' && <ContactsTab currentUser={user} onStartChat={handleStartChat} />}
        {tab === 'profile' && <ProfileTab user={user} onLogout={handleLogout} onUpdate={u => { setUser(u); }} />}
      </div>
      <BottomNav active={tab} onChange={setTab} totalUnread={totalUnread} />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Index() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('osinting_token');
    if (!token) { setScreen('auth'); return; }
    api.auth.me().then(res => {
      setCurrentUser(res.user as User);
      setScreen('app');
    }).catch(() => {
      localStorage.removeItem('osinting_token');
      setScreen('auth');
    });
  }, []);

  const handleLogin = (user: User) => { setCurrentUser(user); setScreen('app'); };
  const handleLogout = () => { setCurrentUser(null); setScreen('auth'); };

  if (screen === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: 'var(--os-bg)' }}>
        <div className="os-mesh-bg"><div className="blob blob-1" /><div className="blob blob-2" /></div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-spin-slow os-glow" style={{ background: 'var(--os-gradient)' }}>
            <Icon name="Shield" size={32} className="text-white" />
          </div>
          <span className="text-sm font-display font-bold os-gradient-text">OSINTING</span>
        </div>
      </div>
    );
  }

  if (screen === 'auth') return <AuthScreen onLogin={handleLogin} />;
  if (screen === 'app' && currentUser) return <AppScreen currentUser={currentUser} onLogout={handleLogout} />;
  return null;
}
