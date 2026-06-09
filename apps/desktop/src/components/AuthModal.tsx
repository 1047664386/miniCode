
/**
 * AuthModal — 登录/注册模态框
 *
 * 桌面端可选登录：不登录也能用（匿名模式），但登录后才能同步历史会话。
 * 两个 tab 切换：登录 / 注册
 * 纯 CSS（暗色主题），与 IDE 风格一致
 */
import { useState, type FC } from 'react';
import { useStore } from '../store';

export const AuthModal: FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { login, register } = useStore();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'register' && password !== confirmPwd) {
        setError('两次输入的密码不一致');
        return;
      }
      const fn = tab === 'login' ? login : register;
      const result = await fn(username.trim(), password);
      if (result.error) {
        setError(result.error);
      }
      // 成功时 store 会自动关闭 modal
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="auth-modal__header">
          <div className="auth-modal__logo">
            <span className="auth-modal__logo-icon">AI</span>
          </div>
          <h2 className="auth-modal__title">
            {tab === 'login' ? '登录账号' : '注册账号'}
          </h2>
          <p className="auth-modal__subtitle">
            {tab === 'login' ? '登录后同步历史会话' : '创建账号以保存会话记录'}
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="auth-modal__tabs">
          <button
            type="button"
            className={`auth-tab ${tab === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            登录
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
          >
            注册
          </button>
        </div>

        {/* 错误提示 */}
        {error && <div className="auth-modal__error">{error}</div>}

        {/* 表单 */}
        <form className="auth-modal__form" onSubmit={handleSubmit}>
          <label className="auth-modal__label">
            <span>用户名</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名"
              required
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="auth-modal__label">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'register' ? '至少 6 位密码' : '输入密码'}
              required
              minLength={tab === 'register' ? 6 : undefined}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {tab === 'register' && (
            <label className="auth-modal__label">
              <span>确认密码</span>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="再次输入密码"
                required
                autoComplete="new-password"
              />
            </label>
          )}

          <button
            type="submit"
            className="auth-modal__submit"
            disabled={loading}
          >
            {loading ? (tab === 'login' ? '登录中…' : '注册中…') : (tab === 'login' ? '登录' : '注册')}
          </button>
        </form>

        {/* Footer */}
        <div className="auth-modal__footer">
          <span className="auth-modal__footer-text">
            {tab === 'login' ? '还没有账号？' : '已有账号？'}
          </span>
          <button
            type="button"
            className="auth-modal__link"
            onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {tab === 'login' ? '注册新账号' : '去登录'}
          </button>
        </div>

        {/* Skip */}
        <button type="button" className="auth-modal__skip" onClick={onClose}>
          暂不登录，继续试用
        </button>
      </div>
    </div>
  );
};
