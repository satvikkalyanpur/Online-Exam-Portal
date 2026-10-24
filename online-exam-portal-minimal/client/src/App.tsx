export default function App() {
  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
      </header>

      <section className="panel">
        <h2>Project skeleton</h2>
        <p>
          
import { useState } from "react";
import "./styles.css";

export default function App() {
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [totalMarks, setTotalMarks] = useState("100");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (new Date(endAt) <= new Date(startAt)) {
      setError("End time must be after start time.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          durationMinutes: Number(durationMinutes),
          totalMarks: Number(totalMarks),
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create examination.");
      }

      setMessage("Examination created successfully.");
      setTitle("");
      setDurationMinutes("60");
      setTotalMarks("100");
      setStartAt("");
      setEndAt("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create examination."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="exam-page">
      <section className="exam-card">
        <h1>Create Examination</h1>
        <p>Enter the examination details below.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="title">Examination title</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            required
          />

          <label htmlFor="duration">Duration (minutes)</label>
          <input
            id="duration"
            type="number"
            min="1"
            max="1440"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
          />

          <label htmlFor="marks">Total marks</label>
          <input
            id="marks"
            type="number"
            min="1"
            max="100000"
            value={totalMarks}
            onChange={(e) => setTotalMarks(e.target.value)}
            required
          />

          <label htmlFor="startAt">Start date and time</label>
          <input
            id="startAt"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />

          <label htmlFor="endAt">End date and time</label>
          <input
            id="endAt"
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            required
          />

          <button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Examination"}
          </button>
        </form>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}

        </p>
        <ul>
          <li>Authentication and role-based access</li>
          <li>Exam scheduling and question bank</li>
          <li>Timed attempts, autosave, and review</li>
          <li>Automatic evaluation and results</li>
          <li>Reports and activity logs</li>
        </ul>
      </section>
    </main>
  );
}
