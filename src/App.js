import { useState } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import YouTubeChannelDownload from './components/YouTubeChannelDownload';
import './App.css';

// Parse stored user; supports legacy format (username string) for existing users
function parseStoredUser() {
  const stored = localStorage.getItem('chatapp_user');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed.username === 'string') return parsed;
  } catch {}
  return { username: stored, firstName: null, lastName: null };
}

function App() {
  const [user, setUser] = useState(() => parseStoredUser());
  const [activeTab, setActiveTab] = useState('chat');

  const handleLogin = (userObj) => {
    localStorage.setItem('chatapp_user', JSON.stringify(userObj));
    setUser(userObj);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatapp_user');
    setUser(null);
  };

  if (user) {
    return (
      <div className="app-logged-in">
        <nav className="app-tabs">
          <button
            className={`app-tab${activeTab === 'chat' ? ' active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`app-tab${activeTab === 'youtube' ? ' active' : ''}`}
            onClick={() => setActiveTab('youtube')}
          >
            YouTube Channel Download
          </button>
        </nav>
        <div className="app-tab-content">
          {activeTab === 'chat' && <Chat user={user} onLogout={handleLogout} />}
          {activeTab === 'youtube' && <YouTubeChannelDownload />}
        </div>
      </div>
    );
  }
  return <Auth onLogin={handleLogin} />;
}

export default App;
