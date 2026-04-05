import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import styles from './SMEReview.module.css';

const DECISIONS = ['Approve', 'Needs Changes', 'Reject'];

// ── Name confirmation screen ────────────────────────────────────────────────

function NameConfirmation({ smeName, twName, onConfirm, onWrongPerson }) {
  const [reporting, setReporting] = useState(false);

  async function handleWrongPerson() {
    setReporting(true);
    await onWrongPerson();
  }

  return (
    <div className={styles.confirmPage}>
      <div className={styles.confirmCard}>
        <h1 className={styles.confirmTitle}>Review Request</h1>
        <p className={styles.confirmQuestion}>
          This review link was sent to:
        </p>
        <p className={styles.confirmName}>{smeName}</p>
        <p className={styles.confirmSubtext}>Is that you?</p>
        <div className={styles.confirmButtons}>
          <button onClick={onConfirm} className={styles.yesBtn}>
            Yes, that's me
          </button>
          <button onClick={handleWrongPerson} disabled={reporting} className={styles.noBtn}>
            {reporting ? 'Notifying…' : "That's not me"}
          </button>
        </div>
        <p className={styles.confirmFrom}>From: {twName}</p>
      </div>
    </div>
  );
}

// ── Wrong person confirmation ───────────────────────────────────────────────

function WrongPersonScreen({ twName }) {
  return (
    <div className={styles.confirmPage}>
      <div className={styles.confirmCard}>
        <p className={styles.wrongIcon}>⚠️</p>
        <h2 className={styles.confirmTitle}>Thanks for letting us know</h2>
        <p className={styles.confirmSubtext}>
          {twName} has been notified via Slack that this link was sent to the wrong person.
          You can close this tab.
        </p>
      </div>
    </div>
  );
}

// ── Thank-you screen ────────────────────────────────────────────────────────

function ThankYouScreen({ decision }) {
  return (
    <div className={styles.confirmPage}>
      <div className={styles.confirmCard}>
        <p className={styles.wrongIcon}>✅</p>
        <h2 className={styles.confirmTitle}>Review submitted</h2>
        <p className={styles.confirmSubtext}>
          Your decision (<strong>{decision}</strong>) has been recorded. Thank you for your feedback.
          You can close this tab.
        </p>
      </div>
    </div>
  );
}

// ── Document viewer with inline commenting ──────────────────────────────────

function DocumentViewer({ lines, comments, onAddComment, onRemoveComment, readOnly }) {
  const [activeLine, setActiveLine] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  // Group comments by line number
  const byLine = {};
  for (const c of comments) {
    if (!byLine[c.line_number]) byLine[c.line_number] = [];
    byLine[c.line_number].push(c);
  }

  function selectLine(lineNum) {
    if (readOnly) return;
    setActiveLine(lineNum === activeLine ? null : lineNum);
    setDraft('');
    // Focus input on next render
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleAdd() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    await onAddComment(activeLine, draft.trim());
    setDraft('');
    setActiveLine(null);
    setSaving(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
    if (e.key === 'Escape') { setActiveLine(null); setDraft(''); }
  }

  return (
    <div className={styles.editor}>
      {lines.map((text, i) => {
        const lineNum = i + 1;
        const lineComments = byLine[lineNum] || [];
        const isActive = activeLine === lineNum;

        return (
          <div key={lineNum} className={styles.lineGroup}>
            <div
              className={`${styles.line} ${isActive ? styles.lineActive : ''} ${!readOnly ? styles.lineClickable : ''}`}
              onClick={() => selectLine(lineNum)}
            >
              <span className={styles.lineNumber}>{lineNum}</span>
              <span className={styles.lineContent}>{text || ' '}</span>
            </div>

            {lineComments.map(c => (
              <div key={c.id} className={styles.commentBubble}>
                <span className={styles.commentText}>{c.comment_text}</span>
                {!readOnly && (
                  <button
                    className={styles.removeCommentBtn}
                    onClick={() => onRemoveComment(c.id)}
                    title="Remove comment"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {isActive && (
              <div className={styles.commentInput}>
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Comment on line ${lineNum}… (Ctrl+Enter to save, Esc to cancel)`}
                  rows={2}
                  className={styles.commentTextarea}
                />
                <div className={styles.commentInputActions}>
                  <button onClick={handleAdd} disabled={!draft.trim() || saving} className={styles.saveCommentBtn}>
                    {saving ? 'Saving…' : 'Add comment'}
                  </button>
                  <button onClick={() => { setActiveLine(null); setDraft(''); }} className={styles.cancelCommentBtn}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function SMEReview() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState(null);         // { assignment, document, fileContent, comments }
  const [comments, setComments] = useState([]);

  // Confirmation flow
  const [confirmed, setConfirmed] = useState(false);
  const [wrongPerson, setWrongPerson] = useState(false);
  const [twName, setTwName] = useState('');

  // Submission
  const [decision, setDecision] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/sme/${token}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Invalid or expired review link');
        }
        return res.json();
      })
      .then(d => {
        setData(d);
        setComments(d.comments || []);
        if (d.assignment.status === 'Submitted') {
          setConfirmed(true);
          setSubmitted(true);
          setDecision(d.assignment.decision || '');
        }
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleWrongPerson() {
    const res = await fetch(`/api/sme/${token}/wrong-person`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setTwName(body.twName || 'the document owner');
    setWrongPerson(true);
  }

  async function handleAddComment(lineNumber, commentText) {
    const res = await fetch(`/api/sme/${token}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_number: lineNumber, comment_text: commentText }),
    });
    if (res.ok) {
      const saved = await res.json();
      setComments(c => [...c, saved]);
    }
  }

  async function handleRemoveComment(commentId) {
    const res = await fetch(`/api/sme/${token}/comment/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      setComments(c => c.filter(x => x.id !== commentId));
    }
  }

  async function handleSubmit() {
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sme/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, general_notes: generalNotes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Submission failed');
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return <div className={styles.centerMessage}>Loading…</div>;
  }

  if (loadError) {
    return (
      <div className={styles.centerMessage}>
        <p className={styles.errorText}>{loadError}</p>
      </div>
    );
  }

  if (wrongPerson) {
    return <WrongPersonScreen twName={twName} />;
  }

  if (!confirmed) {
    return (
      <NameConfirmation
        smeName={data.assignment.sme_name}
        twName={data.document.title}
        onConfirm={() => setConfirmed(true)}
        onWrongPerson={handleWrongPerson}
      />
    );
  }

  if (submitted) {
    return <ThankYouScreen decision={decision} />;
  }

  const lines = data.fileContent.split('\n');
  const readOnly = data.assignment.status === 'Submitted';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.docTitle}>{data.document.title}</h1>
          {data.document.description && (
            <p className={styles.docDescription}>{data.document.description}</p>
          )}
          {data.document.deadline && (
            <p className={styles.deadline}>
              Due: {new Date(data.document.deadline).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          )}
        </div>
        {!readOnly && (
          <p className={styles.hint}>Click any line to add an inline comment.</p>
        )}
      </div>

      <div className={styles.layout}>
        <div className={styles.editorWrapper}>
          <DocumentViewer
            lines={lines}
            comments={comments}
            onAddComment={handleAddComment}
            onRemoveComment={handleRemoveComment}
            readOnly={readOnly}
          />
        </div>

        {!readOnly && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>General notes</label>
              <textarea
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                placeholder="Overall feedback, context, or anything not tied to a specific line…"
                rows={6}
                className={styles.notesTextarea}
              />
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>Decision</label>
              <div className={styles.decisionGroup}>
                {DECISIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDecision(d)}
                    className={`${styles.decisionBtn} ${decision === d ? styles[`decision${d.replace(' ', '')}`] : ''}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {submitError && <p className={styles.submitError}>{submitError}</p>}

            <button
              onClick={handleSubmit}
              disabled={!decision || submitting}
              className={styles.submitBtn}
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>

            {!decision && (
              <p className={styles.submitHint}>Select a decision to submit.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
