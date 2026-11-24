import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, ChevronLeft, MoreHorizontal, Paperclip, Send, Sparkles } from 'lucide-react';
import { agentApi } from '../services/agent_api';
import AgentIcon from '../components/AgentIcon';
import AgentCompanionPanel from '../components/AgentCompanionPanel';

function HomePage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const title = messages.length
    ? (messages[0].text.length > 48 ? `${messages[0].text.slice(0, 48)}…` : messages[0].text)
    : 'Today';

  const handleSend = async () => {
    const task = input.trim();
    if (!task || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: task }]);
    setLoading(true);
    try {
      const data = await agentApi.runTask(task);
      setMessages(prev => [...prev, { role: 'agent', text: data.result, ok: true }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'agent', text: `Error: ${err.message}`, ok: false }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setMessages(prev => [...prev, { role: 'user', text: `Uploaded document: ${file.name}` }]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (${response.status})`);
      }
      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `Got it — I stored "${data.filename}" (${data.characters_extracted} characters) in my memory. I can use it as context from now on.`,
        ok: true,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'agent', text: `Couldn't store that file: ${err.message}`, ok: false }]);
    }
  };

  const agentStatus = loading ? 'thinking' : (messages.some(m => m.ok === false) ? 'error' : 'ready');

  return (
    <div className="today-layout">
      <div className="chat-column">
        <div className="chat-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {messages.length > 0 && (
              <button
                className="btn-icon"
                title="Back to a new chat"
                onClick={() => setMessages([])}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <h1 style={{ marginBottom: 0 }}>{title}</h1>
          </div>
          <div className="chat-topbar__actions" style={{ position: 'relative' }}>
            <button
              className="btn-icon"
              title="Bookmark this conversation"
              onClick={() => setBookmarked(b => !b)}
            >
              {bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            </button>
            <button className="btn-icon" title="More" onClick={() => setMenuOpen(o => !o)}>
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div
                className="card"
                style={{ position: 'absolute', right: 0, top: 42, zIndex: 2, padding: 6, minWidth: 140 }}
              >
                <button
                  className="btn-secondary"
                  style={{ width: '100%', border: 'none', textAlign: 'left' }}
                  onClick={() => { setMessages([]); setMenuOpen(false); }}
                >
                  New chat
                </button>
              </div>
            )}
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="chat-empty">
            <AgentIcon size={56} />
            <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>What should I work on?</p>
            <p>Ask me to search the web, read or write a file, query a database, and more.</p>
          </div>
        ) : (
          <div className="chat-log">
            {messages.map((m, i) => (
              <div key={i} className={`chat-message chat-message--${m.role}`}>
                <div className="chat-message__avatar">
                  {m.role === 'agent' ? <AgentIcon size={20} /> : 'LU'}
                </div>
                <div className="chat-message__body">
                  <div className="chat-message__name">{m.role === 'agent' ? 'Agent' : 'You'}</div>
                  <div className="chat-message__bubble">{m.text}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message chat-message--agent">
                <div className="chat-message__avatar"><AgentIcon size={20} /></div>
                <div className="chat-message__body">
                  <div className="chat-message__name">Agent</div>
                  <div className="chat-message__bubble" style={{ color: 'var(--color-text-muted)' }}>
                    Thinking…
                  </div>
                </div>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        )}

        <div className="chat-input-bar">
          <Sparkles size={16} color="var(--color-text-muted)" style={{ marginLeft: 4, flexShrink: 0 }} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your agent to do something..."
            disabled={loading}
          />
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept=".txt,.md,.pdf,.docx" />
          <button className="btn-icon" title="Attach a document" onClick={handleUploadClick} disabled={loading}>
            <Paperclip size={16} />
          </button>
          <button className="send" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>

      <AgentCompanionPanel status={agentStatus} />
    </div>
  );
}

export default HomePage;
