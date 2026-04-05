import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import api from '../api';
import styles from './Dashboard.module.css';

function deadlineLabel(deadline) {
  if (!deadline) return null;
  const due = new Date(deadline);
  const now = new Date();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: 'Overdue', cls: 'overdue' };
  if (diffDays <= 3) return { text: `Due in ${diffDays}d`, cls: 'dueSoon' };
  return { text: due.toLocaleDateString(), cls: 'normal' };
}

export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/documents')
      .then(setDocs)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout><p className={styles.state}>Loading…</p></Layout>;
  if (error)   return <Layout><p className={styles.stateError}>{error}</p></Layout>;

  return (
    <Layout>
      <div className={styles.header}>
        <h1 className={styles.title}>My Reviews</h1>
      </div>

      {docs.length === 0 ? (
        <div className={styles.empty}>
          <p>No reviews yet.</p>
          <Link to="/documents/new" className={styles.emptyBtn}>Start your first review →</Link>
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Responses</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {docs.map(doc => {
              const dl = deadlineLabel(doc.deadline);
              return (
                <tr key={doc.id}>
                  <td>
                    <Link to={`/documents/${doc.id}`}>{doc.title}</Link>
                  </td>
                  <td><StatusBadge status={doc.status} /></td>
                  <td className={styles.responses}>
                    {doc.submitted_count} / {doc.sme_count}
                  </td>
                  <td>
                    {dl ? (
                      <span className={`${styles.deadline} ${styles[dl.cls]}`}>{dl.text}</span>
                    ) : (
                      <span className={styles.noDeadline}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
