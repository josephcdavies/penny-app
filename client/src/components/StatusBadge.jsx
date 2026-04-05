import styles from './StatusBadge.module.css';

const STATUS_CLASS = {
  'Draft': 'draft',
  'In Review': 'inReview',
  'Approved': 'approved',
  'Rejected': 'rejected',
  'Needs Changes': 'needsChanges',
};

export default function StatusBadge({ status }) {
  const cls = STATUS_CLASS[status] || 'draft';
  return <span className={`${styles.badge} ${styles[cls]}`}>{status}</span>;
}
