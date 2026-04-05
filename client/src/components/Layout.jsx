import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <Link to="/dashboard" className={styles.brand}>Penny</Link>
        <nav className={styles.nav}>
          <Link to="/dashboard" className={styles.navLink}>Dashboard</Link>
          <Link to="/documents/new" className={styles.uploadBtn}>+ New Review</Link>
          <span className={styles.userName}>{user?.name}</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>Log out</button>
        </nav>
      </header>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
