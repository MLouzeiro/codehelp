import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  Send,
  Paperclip,
  Smile,
  Image,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Info,
  Volume2,
} from 'lucide-react';
import api from '../../services/api';

interface Message {
  id: string;
  content?: string;
  fromMe: boolean;
  sentAt: string;
  usuario?: { id: string; name: string };
  source?: string;
  mediaUrl?: string;
  mimeType?: string;
}

interface ResizableChatProps {
  ticketId: string;
  onSendMessage?: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 1200;
const MIN_HEIGHT = 300;
const MAX_HEIGHT = 2000;

export default function ResizableChat({
  ticketId,
  onSendMessage,
  disabled = false,
  placeholder = 'Digite sua mensagem...',
}: ResizableChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(800);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'width' | 'height' | 'corner' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/helpdesk/tickets/${ticketId}/history`);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11: Toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }

      // Esc: Exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }

      // Ctrl+Enter: Send message
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }

      // Ctrl+Shift+N: Toggle note mode (placeholder for now)
      if (e.key === 'N' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        // TODO: Toggle note mode
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, inputValue]);

  // Drag handlers
  const handleDragStart = useCallback(
    (type: 'width' | 'height' | 'corner') => (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDragType(type);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width,
        height,
      };
    },
    [width, height]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (dragType === 'width' || dragType === 'corner') {
        setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartRef.current.width + dx)));
      }
      if (dragType === 'height' || dragType === 'corner') {
        setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartRef.current.height + dy)));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragType(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragType]);

  const handleSend = async () => {
    if (!inputValue.trim() || sending || disabled) return;

    try {
      setSending(true);
      const content = inputValue.trim();
      setInputValue('');

      if (onSendMessage) {
        onSendMessage(content);
      } else {
        await api.post('/whatsapp/send', {
          ticketId,
          message: content,
        });
      }

      // Optimistic update
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          content,
          fromMe: true,
          sentAt: new Date().toISOString(),
          source: 'agent',
        },
      ]);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const msgDate = new Date(msg.sentAt).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msg.sentAt, messages: [] });
    }
    groupedMessages[groupedMessages.length - 1].messages.push(msg);
  }

  const containerStyle = isFullscreen
    ? { position: 'fixed' as const, inset: 0, zIndex: 50, width: '100vw', height: '100vh' }
    : { width, height };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden ${
        isFullscreen ? 'rounded-none' : ''
      } ${isDragging ? 'select-none' : ''}`}
      style={containerStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Chat
          </span>
          <span className="text-xs text-gray-500 bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
            {messages.length} msgs
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded"
            title="Atalhos de teclado"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded"
            title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia (F11)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Shortcuts panel */}
      {showShortcuts && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-3 h-3 text-blue-500" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Atalhos</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-blue-600 dark:text-blue-400">
            <span><kbd className="px-1 bg-blue-100 dark:bg-blue-800 rounded">F11</kbd> Tela cheia</span>
            <span><kbd className="px-1 bg-blue-100 dark:bg-blue-800 rounded">Esc</kbd> Sair</span>
            <span><kbd className="px-1 bg-blue-100 dark:bg-blue-800 rounded">Ctrl+Enter</kbd> Enviar</span>
            <span><kbd className="px-1 bg-blue-100 dark:bg-blue-800 rounded">Ctrl+Shift+N</kbd> Nota</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                <span className="text-[11px] text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2">
                  {formatDate(group.date)}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
              </div>

              {/* Messages */}
              {group.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg ${
                      msg.fromMe
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 rounded-bl-none'
                    }`}
                  >
                    {!msg.fromMe && msg.usuario && (
                      <div className="text-[10px] font-medium text-blue-500 dark:text-blue-400 mb-0.5">
                        {msg.usuario.name}
                      </div>
                    )}
                    {msg.content && (
                      <div className={`text-sm whitespace-pre-wrap break-words ${msg.fromMe ? 'text-white' : 'text-gray-800 dark:text-slate-200'}`}>
                        {msg.content}
                      </div>
                    )}
                    {msg.mediaUrl && (() => {
                      const mediaSrc = msg.mediaUrl.startsWith('data:')
                        ? msg.mediaUrl
                        : msg.mimeType
                          ? `data:${msg.mimeType};base64,${msg.mediaUrl}`
                          : msg.mediaUrl;
                      return (
                        <div className="mt-1">
                          {msg.mimeType?.startsWith('image/') ? (
                            <img
                              src={mediaSrc}
                              alt="Anexo"
                              className="max-w-full rounded"
                            />
                          ) : msg.mimeType?.startsWith('audio/') ? (
                            <div className="flex items-center gap-2">
                              <Volume2 className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                              <audio controls preload="none" className="h-8 max-w-[220px]">
                                <source src={mediaSrc} type={msg.mimeType} />
                              </audio>
                            </div>
                          ) : msg.mimeType?.startsWith('video/') ? (
                            <video
                              src={mediaSrc}
                              controls
                              className="max-w-full rounded max-h-[200px]"
                            />
                          ) : (
                            <a
                              href={mediaSrc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs underline"
                            >
                              <FileText className="w-3 h-3" />
                              Anexo
                            </a>
                          )}
                        </div>
                      );
                    })()}
                    <div
                      className={`text-[10px] mt-1 ${
                        msg.fromMe ? 'text-blue-100' : 'text-gray-400 dark:text-slate-500'
                      }`}
                    >
                      {formatTime(msg.sentAt)}
                      {msg.source && msg.source !== 'agent' && (
                        <span className="ml-1 opacity-70">({msg.source})</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-end gap-2">
          <div className="flex gap-1">
            <button
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              title="Anexo"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              title="Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              title="Imagem"
            >
              <Image className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={placeholder}
              disabled={disabled || sending}
              rows={1}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white disabled:opacity-50"
              style={{ minHeight: '38px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending || disabled}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-1 text-[10px] text-gray-400 dark:text-slate-500 text-center">
          Enter para enviar • Shift+Enter para nova linha • Ctrl+Enter para enviar
        </div>
      </div>

      {/* Resize handles */}
      {!isFullscreen && (
        <>
          {/* Right edge */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400 transition-colors"
            onMouseDown={handleDragStart('width')}
          />
          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-400 transition-colors"
            onMouseDown={handleDragStart('height')}
          />
          {/* Corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-400 transition-colors rounded-tl"
            onMouseDown={handleDragStart('corner')}
          />
        </>
      )}
    </div>
  );
}
