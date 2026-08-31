import { useState } from "react";
import { reportApi } from "../../lib/services";
import "./reportModal.scss";

function ReportModal({ propertyId, open, onClose }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await reportApi.create({ propertyId, reason });
      setSuccess("Report submitted. Our team will review it.");
      setReason("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reportModalOverlay" onClick={onClose}>
      <div
        className="reportModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <h3>Report this listing</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p>
          Tell us what’s wrong. Fake photos, wrong price, scam behavior, or
          misleading details help us keep ShoufBayt safe.
        </p>

        {error && <div className="reportAlert error">{error}</div>}
        {success && <div className="reportAlert success">{success}</div>}

        <form onSubmit={submit}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the issue (at least 10 characters)"
            rows={5}
            required
            minLength={10}
          />

          <div className="reportActions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Sending…" : "Submit report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportModal;
