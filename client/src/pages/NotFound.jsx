import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './NotFound.module.css';

export default function NotFound() {
  const { isAuthenticated } = useAuth();
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.code}>404</h1>
        <p className={styles.message}>This page doesn't exist.</p>
        <Link to={isAuthenticated ? '/dashboard' : '/login'} className={styles.link}>
          {isAuthenticated ? '← Back to dashboard' : '← Go to login'}
        </Link>
      </div>
    </div>
  );
}
