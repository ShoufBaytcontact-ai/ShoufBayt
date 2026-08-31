import { useEffect, useState } from "react";
import {
  adminBillingApi,
  paymentApi,
  reportApi,
} from "../../lib/services";
import "./adminBillingPanel.scss";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function AdminBillingPanel({ section = "payments" }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [payments, setPayments] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [reports, setReports] = useState([]);
  const [notes, setNotes] = useState({});
  const [campaign, setCampaign] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [testRole, setTestRole] = useState("USER");
  const [forceSend, setForceSend] = useState(false);
  const [campaignBusy, setCampaignBusy] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      if (section === "payments") {
        const res = await paymentApi.adminList();
        setPayments(Array.isArray(res.data) ? res.data : res.data?.payments || []);
      }

      if (section === "subscriptions") {
        const res = await adminBillingApi.subscriptions();
        setSubscriptions(
          Array.isArray(res.data) ? res.data : res.data?.subscriptions || []
        );
        const launchRes = await adminBillingApi.launchPeriod().catch(() => null);
        if (launchRes?.data) setCampaign(launchRes.data);
      }

      if (section === "reports") {
        const res = await reportApi.adminList();
        setReports(Array.isArray(res.data) ? res.data : res.data?.reports || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [section]);

  const reviewPayment = async (id, status) => {
    try {
      setSuccess("");
      await paymentApi.review(id, {
        status,
        adminNotes: notes[id] || "",
      });
      setSuccess(`Payment marked as ${status.toLowerCase()}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to review payment");
    }
  };

  const expireSubscription = async (id) => {
    try {
      setSuccess("");
      await adminBillingApi.expireSubscription(id);
      setSuccess("Subscription expired");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to expire subscription");
    }
  };

  const sendLaunchTest = async () => {
    try {
      setCampaignBusy("test");
      setError("");
      const res = await adminBillingApi.sendLaunchTest({
        email: testEmail,
        role: testRole,
      });
      setSuccess(res.data?.message || "Preview email sent");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send preview email");
    } finally {
      setCampaignBusy("");
    }
  };

  const sendLaunchEmails = async () => {
    try {
      setCampaignBusy("all");
      setError("");
      const res = await adminBillingApi.sendLaunchEmails({
        confirm: "SEND_LAUNCH_EMAILS",
        force: forceSend,
      });
      setSuccess(res.data?.message || "Campaign ran");
      const launchRes = await adminBillingApi.launchPeriod().catch(() => null);
      if (launchRes?.data) setCampaign(launchRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send campaign emails");
    } finally {
      setCampaignBusy("");
    }
  };

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

      {section === "payments" && (
        <div className="adminBillingList">
          {payments.length === 0 ? (
            <div className="adminBillingEmpty">No payment submissions yet.</div>
          ) : (
            payments.map((item) => (
              <article key={item.id} className="adminBillingCard">
                <div className="adminBillingMeta">
                  <strong>
                    {item.user?.username || item.user?.email || "User"}
                  </strong>
                  <span className={`statusChip ${String(item.status || "").toLowerCase()}`}>
                    {item.status}
                  </span>
                </div>

                <p>
                  Plan <b>{item.plan || "—"}</b> · {item.method || "—"} · $
                  {item.amount ?? "—"}
                </p>
                <p>Txn: {item.transactionId || "—"}</p>
                <p>Submitted {formatDate(item.createdAt)}</p>

                {item.proofUrl && (
                  <a href={item.proofUrl} target="_blank" rel="noreferrer">
                    View proof
                  </a>
                )}

                <textarea
                  placeholder="Admin notes"
                  value={notes[item.id] || ""}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                />

                <div className="adminBillingActions">
                  {String(item.status).toUpperCase() === "PENDING" && (
                    <>
                      <button
                        type="button"
                        onClick={() => reviewPayment(item.id, "SUCCESS")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => reviewPayment(item.id, "FAILED")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {section === "subscriptions" && (
        <div className="adminBillingList">
          <article className="adminBillingCard">
            <div className="adminBillingMeta">
              <strong>Launch-month emails</strong>
              <span className="statusChip">
                {campaign?.complimentaryActive ? "COMPLIMENTARY" : "ENDED"}
              </span>
            </div>
            <p>
              When the free Premium month ends, every member gets a different
              email for their role (user, agent, admin). Send a preview now.
              The live send waits until the complimentary date, unless you
              force it.
            </p>
            {campaign && (
              <p>
                Until {formatDate(campaign.complimentaryUntil)} ·{" "}
                {campaign.daysLeft} days left · {campaign.sentCount} sent ·{" "}
                {campaign.pendingCount} waiting
              </p>
            )}
            <label>
              Test email
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Role
              <select
                value={testRole}
                onChange={(e) => setTestRole(e.target.value)}
              >
                <option value="USER">USER</option>
                <option value="AGENT">AGENT</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
            <div className="adminBillingActions">
              <button
                type="button"
                onClick={sendLaunchTest}
                disabled={campaignBusy === "test"}
              >
                {campaignBusy === "test" ? "Sending…" : "Send preview"}
              </button>
              <button
                type="button"
                className="danger"
                onClick={sendLaunchEmails}
                disabled={campaignBusy === "all"}
              >
                {campaignBusy === "all" ? "Sending…" : "Email everyone"}
              </button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={forceSend}
                onChange={(e) => setForceSend(e.target.checked)}
              />{" "}
              Send even if complimentary Premium is still on
            </label>
          </article>

          {subscriptions.length === 0 ? (
            <div className="adminBillingEmpty">No subscriptions found.</div>
          ) : (
            subscriptions.map((item) => (
              <article key={item.id} className="adminBillingCard">
                <div className="adminBillingMeta">
                  <strong>
                    {item.user?.username || item.user?.email || "User"}
                  </strong>
                  <span className={`statusChip ${String(item.status || "").toLowerCase()}`}>
                    {item.status}
                  </span>
                </div>

                <p>
                  Plan <b>{item.plan}</b>
                  {item.isCurrent ? " · current" : ""}
                </p>
                <p>
                  {formatDate(item.startDate || item.createdAt)} →{" "}
                  {formatDate(item.endDate)}
                </p>

                {item.status !== "EXPIRED" && (
                  <div className="adminBillingActions">
                    <button
                      type="button"
                      className="danger"
                      onClick={() => expireSubscription(item.id)}
                    >
                      Expire now
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}

      {section === "reports" && (
        <div className="adminBillingList">
          {reports.length === 0 ? (
            <div className="adminBillingEmpty">No property reports yet.</div>
          ) : (
            reports.map((item) => (
              <article key={item.id} className="adminBillingCard">
                <div className="adminBillingMeta">
                  <strong>
                    {item.property?.title || "Property report"}
                  </strong>
                  <span className={`statusChip ${String(item.status || "").toLowerCase()}`}>
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
      )}
    </section>
  );
}

export default AdminBillingPanel;
