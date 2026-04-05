const db = require('../db/database');

/**
 * Recalculates a document's status from its SME assignments and updates the DB.
 * Called any time an SME submits feedback.
 *
 * Rules (in priority order):
 *   - Any SME rejected           → Rejected
 *   - Any SME needs changes      → Needs Changes
 *   - All SMEs approved          → Approved
 *   - Some submitted, none above → In Review
 *   - No SMEs assigned           → Draft
 */
function recalculateStatus(documentId) {
  const assignments = db.prepare(
    'SELECT status, decision FROM sme_assignments WHERE document_id = ?'
  ).all(documentId);

  let status;

  if (assignments.length === 0) {
    status = 'Draft';
  } else {
    const submitted = assignments.filter(a => a.status === 'Submitted');
    const decisions = submitted.map(a => a.decision);

    if (decisions.includes('Reject')) {
      status = 'Rejected';
    } else if (decisions.includes('Needs Changes')) {
      status = 'Needs Changes';
    } else if (submitted.length === assignments.length && decisions.every(d => d === 'Approve')) {
      status = 'Approved';
    } else {
      status = 'In Review';
    }
  }

  db.prepare(
    "UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(status, documentId);

  return status;
}

module.exports = { recalculateStatus };
