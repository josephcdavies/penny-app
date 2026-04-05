import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import styles from './NewReview.module.css';

const EMPTY_SME = () => ({ name: '', email: '' });

export default function NewReview() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [file, setFile] = useState(null);
  const [smes, setSmes] = useState([EMPTY_SME()]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function addSme() {
    setSmes(s => [...s, EMPTY_SME()]);
  }

  function removeSme(i) {
    setSmes(s => s.filter((_, idx) => idx !== i));
  }

  function updateSme(i, field, value) {
    setSmes(s => s.map((sme, idx) => idx === i ? { ...sme, [field]: value } : sme));
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (f && !f.name.endsWith('.md')) {
      setError('Only .md files are accepted');
      e.target.value = '';
      setFile(null);
      return;
    }
    setError('');
    setFile(f || null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Catch rows where only one of name/email is filled
    const partialRow = smes.find(s => {
      const hasName = s.name.trim().length > 0;
      const hasEmail = s.email.trim().length > 0;
      return hasName !== hasEmail; // XOR — one filled, one not
    });
    if (partialRow) {
      setError('Each reviewer needs both a name and an email address');
      return;
    }

    const validSmes = smes.filter(s => s.name.trim() && s.email.trim());
    if (validSmes.length === 0) {
      setError('Add at least one reviewer with a name and email');
      return;
    }
    if (!file) {
      setError('A .md file is required');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      if (deadline) formData.append('deadline', deadline);
      formData.append('file', file);

      const doc = await api.upload('/api/documents', formData);

      await api.post('/api/reviews', {
        document_id: doc.id,
        deadline: deadline || undefined,
        smes: validSmes.map(s => ({ name: s.name.trim(), email: s.email.trim() })),
      });

      navigate(`/documents/${doc.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <h1 className={styles.title}>New Review</h1>
      <form onSubmit={handleSubmit} className={styles.form}>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Document</h2>
          <label className={styles.label}>
            Title *
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Description
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className={styles.textarea}
            />
          </label>
          <label className={styles.label}>
            Markdown file (.md) *
            <input
              type="file"
              accept=".md"
              onChange={handleFileChange}
              required
              className={styles.fileInput}
            />
          </label>
          <label className={styles.label}>
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className={styles.input}
            />
          </label>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Reviewers</h2>
          <div className={styles.smeList}>
            {smes.map((sme, i) => (
              <div key={i} className={styles.smeRow}>
                <input
                  type="text"
                  placeholder="Name"
                  value={sme.name}
                  onChange={e => updateSme(i, 'name', e.target.value)}
                  className={styles.input}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={sme.email}
                  onChange={e => updateSme(i, 'email', e.target.value)}
                  className={styles.input}
                />
                {smes.length > 1 && (
                  <button type="button" onClick={() => removeSme(i)} className={styles.removeBtn}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addSme} className={styles.addBtn}>
            + Add reviewer
          </button>
        </section>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" disabled={loading} className={styles.submitBtn}>
          {loading ? 'Submitting…' : 'Create review & notify reviewers'}
        </button>
      </form>
    </Layout>
  );
}
