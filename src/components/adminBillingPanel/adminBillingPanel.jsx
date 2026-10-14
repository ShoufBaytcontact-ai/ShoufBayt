import { useEffect, useState } from "react";
import { reportApi } from "../../lib/services";
import "./adminBillingPanel.scss";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function AdminBillingPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reports, setReports] = useState([]);
  const [notes, setNotes] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await reportApi.adminList();
      setReports(Array.isArray(res.data) ? res.data : res.data?.reports || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reviewReport = async (id, status) => {
    try {
      setSuccess("");
      await reportApi.review(id, {
        status,
        adminNotes: notes[id] || "",
      });
      setSuccess(`Report marked as ${status.toLowerCase()}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to review report");
    }
  };

  if (loading) {
    return <div className="adminBillingEmpty">Loading…</div>;
  }

  return (
    <section className="adminBillingPanel">
      {error && <div className="adminBillingAlert error">{error}</div>}
      {success && <div className="adminBillingAlert success">{success}</div>}

      <div className="adminBillingList">
        {reports.length === 0 ? (
          <div className="adminBillingEmpty">No property reports yet.</div>
        ) : (
          reports.map((item) => (
            <article key={item.id} className="adminBillingCard">
              <div className="adminBillingMeta">
                <strong>{item.property?.title || "Property report"}</strong>
                <span
                  className={`statusChip ${String(item.status || "").toLowerCase()}`}
                >
                  {item.status}
                </span>
              </div>

              <p>{item.reason}</p>
              <p>
                By {item.reporter?.username || item.user?.username || "User"} ·{" "}
                {formatDate(item.createdAt)}
              </p>

              {item.propertyId && (
                <a href={`/properties/${item.propertyId}`}>Open listing</a>
              )}

              <textarea
                placeholder="Admin notes"
                value={notes[item.id] || ""}
                onChange={(e) =>
                  setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
              />

              <div className="adminBillingActions">
                <button
                  type="button"
                  onClick={() => reviewReport(item.id, "REVIEWED")}
                >
                  Resolve
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => reviewReport(item.id, "DISMISSED")}
                >
                  Dismiss
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default AdminBillingPanel;
