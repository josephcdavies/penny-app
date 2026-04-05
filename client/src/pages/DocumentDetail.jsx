import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import api from '../api';
import styles from './DocumentDetail.module.css';

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SmeRow({ assignment }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={styles.smeRow} onClick={() => setOpen(o => !o)}>
        <td>{assignment.sme_name}</td>
        <td>{assignment.sme_email}</td>
        <td>
          <span className={`${styles.smeStatus} ${assignment.status === 'Submitted' ? styles.submitted : styles.pending}`}>
            {assignment.status}
          </span>
        </td>
        <td>{assignment.decision || '—'}</td>
        <td>{formatDateTime(assignment.submitted_at)}</td>
        <td className={styles.expand}>{open ? '▲' : '▼'}</td>
      </tr>
      {open && (
        <tr className={styles.detailRow}>
          <td colSpan={6}>
            <div className={styles.detailContent}>
              {assignment.comments.length > 0 ? (
                <div className={styles.commentSection}>
                  <h4 className={styles.detailLabel}>Inline Comments</h4>
                  <ul className={styles.commentList}>
                    {assignment.comments.map(c => (
                      <li key={c.id} className={styles.commentItem}>
                        <span className={styles.lineTag}>Line {c.line_number}</span>
                        {c.comment_text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className={styles.noDetail}>No inline comments.</p>
              )}
              {assignment.general_notes && (
                <div className={styles.commentSection}>
                  <h4 className={styles.detailLabel}>General Notes</h4>
                  <p className={styles.generalNotes}>{assignment.general_notes}</p>
                </div>
              )}
              {!assignment.general_notes && assignment.comments.length === 0 && (
                <p className={styles.noDetail}>No feedback submitted yet.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef(null);

  const fetchDoc = useCallback(() => {
    return api.get(`/api/documents/${id}`)
      .then(setDoc)
      .catch(err => setError(err.message));
  }, [id]);

  useEffect(() => {
    fetchDoc().finally(() => setLoading(false));
  }, [fetchDoc]);

  // Poll every 5s only while In Review
  useEffect(() => {
    if (!doc) return;
    if (doc.status === 'In Review') {
      pollRef.current = setInterval(fetchDoc, 5000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [doc?.status, fetchDoc]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/api/documents/${id}`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function handleDownload() {
    const token = localStorage.getItem('token');
    setDownloading(true);
    fetch(`/api/documents/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.original_name.replace(/\.md$/i, '')}-reviewed.md`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError('Download failed'))
      .finally(() => setDownloading(false));
  }

  if (loading) return <Layout><p className={styles.state}>Loading…</p></Layout>;
  if (error && !doc) return <Layout><p className={styles.stateError}>{error}</p></Layout>;
  if (!doc) return null;

  return (
    <Layout>
      <div className={styles.topBar}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{doc.title}</h1>
          <StatusBadge status={doc.status} />
        </div>
        <div className={styles.actions}>
          <button onClick={handleDownload} disabled={downloading} className={styles.downloadBtn}>
            {downloading ? 'Preparing…' : 'Download reviewed file'}
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className={styles.deleteBtn}>
              Delete
            </button>
          ) : (
            <span className={styles.confirmRow}>
              Delete this document?{' '}
              <button onClick={handleDelete} disabled={deleting} className={styles.confirmYes}>
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className={styles.confirmNo}>
                Cancel
              </button>
            </span>
          )}
        </div>
      </div>

      {doc.description && <p className={styles.description}>{doc.description}</p>}

      <dl className={styles.meta}>
        <dt>Deadline</dt><dd>{formatDate(doc.deadline)}</dd>
        <dt>Uploaded</dt><dd>{formatDate(doc.created_at)}</dd>
        <dt>Responses</dt>
        <dd>
          {doc.assignments.filter(a => a.status === 'Submitted').length} / {doc.assignments.length}
        </dd>
      </dl>

      {error && <p className="error-message" style={{ marginBottom: 12 }}>{error}</p>}

      <h2 className={styles.sectionTitle}>Reviewers</h2>
      {doc.assignments.length === 0 ? (
        <p className={styles.empty}>No reviewers assigned yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Decision</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {doc.assignments.map(a => <SmeRow key={a.id} assignment={a} />)}
          </tbody>
        </table>
      )}

      <h2 className={styles.sectionTitle}>History</h2>
      <ol className={styles.timeline}>
        {doc.history.map(event => (
          <li key={event.id} className={styles.timelineItem}>
            <span className={styles.timelineDot} />
            <div>
              <p className={styles.timelineDesc}>{event.description}</p>
              <p className={styles.timelineMeta}>
                {event.actor && <span>{event.actor} · </span>}
                {formatDateTime(event.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Layout>
  );
}
