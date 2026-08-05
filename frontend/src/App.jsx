import { useState, useEffect } from 'react';
import './App.css';
import HomePage from './pages/HomePage';
import TripTable from './components/TripTable';
import { fetchTripsByDate, fetchTokenHistory } from './api/api';
import logoFull from './assets/vbos_full.svg';
import logoDark from './assets/vbos_dark.svg';
import logoSmall from './assets/vbos.svg';

const icons = {
  menu: <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
  home: <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  history: <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  settings: <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
};

function TripHistoryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [trips, setTrips] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [tokenPage, setTokenPage] = useState(1);
  const [tokenPages, setTokenPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showTokens, setShowTokens] = useState(false);

  const loadTrips = async (date) => {
    setLoading(true);
    try {
      const data = await fetchTripsByDate(date);
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trips', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTokens = async (page) => {
    try {
      const data = await fetchTokenHistory(page);
      setTokens(data.tokens || []);
      setTokenPages(data.pages || 1);
    } catch (err) {
      console.error('Failed to load tokens', err);
    }
  };

  useEffect(() => {
    loadTrips(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (showTokens) loadTokens(tokenPage);
  }, [showTokens, tokenPage]);

  return (
    <div className="content">
      <div className="history-header">
        <h2>Trip History</h2>
        <div className="history-controls">
          <input
            type="date"
            className="date-picker"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button
            className={`toggle-btn ${showTokens ? 'active' : ''}`}
            onClick={() => setShowTokens(!showTokens)}
          >
            {showTokens ? 'Hide Token Chain' : 'Show Token Chain'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading trips...</div>
      ) : (
        <TripTable trips={trips} />
      )}

      {showTokens && (
        <section className="table-panel token-chain-panel">
          <h2>Token Chain (Blockchain Ledger)</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Token ID</th>
                  <th>Action</th>
                  <th>Vehicle</th>
                  <th>Hash</th>
                  <th>Previous Hash</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr><td colSpan="6">No token chain records.</td></tr>
                ) : (
                  tokens.map((t) => (
                    <tr key={t._id}>
                      <td className="token-cell">{t.tokenId}</td>
                      <td>
                        <span className={`action-badge action-${t.action.toLowerCase()}`}>
                          {t.action}
                        </span>
                      </td>
                      <td>{t.vehicleNumber}</td>
                      <td title={t.tokenHash}>{t.tokenHash?.slice(0, 12)}…</td>
                      <td title={t.prevTokenHash}>
                        {t.prevTokenHash === 'GENESIS' ? '🔗 GENESIS' : t.prevTokenHash?.slice(0, 12) + '…'}
                      </td>
                      <td>{new Date(t.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {tokenPages > 1 && (
            <div className="pagination">
              <button disabled={tokenPage <= 1} onClick={() => setTokenPage(tokenPage - 1)}>← Prev</button>
              <span>Page {tokenPage} of {tokenPages}</span>
              <button disabled={tokenPage >= tokenPages} onClick={() => setTokenPage(tokenPage + 1)}>Next →</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [themeSetting, setThemeSetting] = useState('system');
  const [sidebarMini, setSidebarMini] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Apply theme class to HTML root element
  useEffect(() => {
    const isDark = themeSetting === 'dark' || (themeSetting === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeSetting]);

  return (
    <div className="app-container">
      <aside className={`sidebar ${sidebarMini ? 'mini' : ''}`}>
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setSidebarMini(!sidebarMini)} title="Toggle menu">
            {icons.menu}
          </button>
          <img src={sidebarMini ? logoSmall : (isDarkMode ? logoDark : logoFull)} alt="VBoS" className="sidebar-logo" />
        </div>
        <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')} title="Dashboard">
          <span className="nav-icon">{icons.home}</span>
          {!sidebarMini && <span>Dashboard</span>}
        </button>
        <button className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} title="Trip History">
          <span className="nav-icon">{icons.history}</span>
          {!sidebarMini && <span>Trip History</span>}
        </button>
        <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Settings">
          <span className="nav-icon">{icons.settings}</span>
          {!sidebarMini && <span>Settings</span>}
        </button>
      </aside>
      <main className="main-content">
        {activeTab === 'dashboard' && <HomePage />}
        {activeTab === 'history' && <TripHistoryPage />}
        {activeTab === 'settings' && (
           <div className="content">
             <section className="settings-panel">
               <h2>Settings</h2>
               <div>
                 <label><strong>Theme: </strong></label>
                 <select value={themeSetting} onChange={(e) => setThemeSetting(e.target.value)}>
                   <option value="system">System Default</option>
                   <option value="light">Light Mode</option>
                   <option value="dark">Dark Mode</option>
                 </select>
               </div>
             </section>
           </div>
        )}
      </main>
    </div>
  );
}

export default App;
