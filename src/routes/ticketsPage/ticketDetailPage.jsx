import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import { lawyerName, StatusMark, TICKET_STATUSES, TicketHead, TicketLoader } from "./ticketsPage";
import "./ticketsPage.scss";

function ticketKey(value) {
  let key = String(value || "").trim();
  try {
    key = decodeURIComponent(key);
  } catch {
    // keep original
  }
  return key.replace(/^#/, "").trim();
}

function apiPath(value) {
  return `/tickets/${encodeURIComponent(ticketKey(value))}`;
}

function TicketDetailPage() {
  const params = useParams();
  const number = ticketKey(params.number);
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const role = String(currentUser?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN";
  const isLawyerRole = role === "LAWYER";
  const isDesk = isLawyerRole || isAdmin;
  const backTo = isLawyerRole ? "/lawyer" : "/tickets";

  const [ticket, setTicket] = useState(null);
  const [lawyers, setLawyers] = useState([]);
  const [lawyerId, setLawyerId] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    const res = await apiRequest.get(apiPath(number));
    setTicket(res.data.ticket);
    setLawyers(res.data.lawyers || []);
    setLawyerId(res.data.ticket?.lawyer?.id || "");
  };

  useEffect(() => {
    if (!number) {
      setError(t("tickets.errors.loadOne"));
      return;
    }
    let alive = true;
    (async () => {
      try {
        setError("");
        const res = await apiRequest.get(apiPath(number));
        if (alive) {
          setTicket(res.data.ticket);
          setLawyers(res.data.lawyers || []);
          setLawyerId(res.data.ticket?.lawyer?.id || "");
        }
      } catch (err) {
        if (alive) {
          setError(err.response?.data?.message || t("tickets.errors.loadOne"));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [number, t]);

  const send = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiRequest.post(`${apiPath(number)}/messages`, { body });
      setBody("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("tickets.errors.reply"));
    } finally {
      setSaving(false);
    }
  };

  const assign = async (event) => {
    event.preventDefault();
    if (!lawyerId) return;
    try {
      setAssigning(true);
      const res = await apiRequest.post(`${apiPath(number)}/assign`, { lawyerId });
      setTicket(res.data.ticket);
      setLawyers(res.data.lawyers || []);
      setLawyerId(res.data.ticket?.lawyer?.id || lawyerId);
    } catch (err) {
      setError(err.response?.data?.message || t("tickets.errors.assign"));
    } finally {
      setAssigning(false);
    }
  };

  const changeStatus = async (status) => {
    try {
      const res = await apiRequest.patch(apiPath(number), { status });
      setTicket(res.data.ticket);
    } catch (err) {
      setError(err.response?.data?.message || t("tickets.errors.status"));
    }
  };

  if (!ticket && !error) {
    return (
      <div className="tk pageFade">
        <TicketLoader />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="tk pageFade">
        <p className="tkError">{error}</p>
        <Link className="tkText" to={backTo}>
          {t("tickets.back")}
        </Link>
      </div>
    );
  }

  const lawyer = ticket.lawyer;

  return (
    <div className="tk tkCase pageFade">
      <TicketHead
        eyebrow={`#${ticket.number}`}
        title={ticket.title}
        kicker={`${t(`tickets.category.${ticket.category}`)} · ${lawyerName(ticket, t)}`}
        action={
          <Link className="tkText" to={backTo}>
            {t("tickets.back")}
          </Link>
        }
      />

      <div className="tkCaseGrid">
        <div className="tkMain">
          <div className="tkMeta">
            {isLawyerRole ? (
              <select
                className="tkStatusSelect"
                value={ticket.status}
                onChange={(event) => changeStatus(event.target.value)}
              >
                {TICKET_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {t(`tickets.status.${item}`)}
                  </option>
                ))}
              </select>
            ) : (
              <StatusMark status={ticket.status} t={t} />
            )}
          </div>

          <section className="tkCard">
            <p>{ticket.description}</p>
            {(ticket.images || []).length ? (
              <div className="tkImages">
                {ticket.images.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="" />
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <ul className="tkThread">
            {(ticket.messages || []).map((item) => (
              <li key={item.id}>
                <b>{item.author?.username || t("tickets.someone")}</b>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>

          {ticket.status !== "CLOSED" ? (
            <form className="tkForm tkReply" onSubmit={send}>
              <label>
                {t("tickets.fields.reply")}
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={4}
                  required
                />
              </label>
              {error ? <p className="tkError">{error}</p> : null}
              <button type="submit" className="tkSubmit" disabled={saving}>
                {saving ? t("tickets.saving") : t("tickets.reply")}
              </button>
            </form>
          ) : (
            <p className="tkHint">{t("tickets.closed")}</p>
          )}
        </div>

        <aside className="tkSide">
          {isDesk && ticket.phone ? (
            <div className="tkPhoneBlock">
              <p className="tkEyebrow">{t("tickets.fields.phone")}</p>
              <a href={`tel:${ticket.phone}`}>{ticket.phone}</a>
            </div>
          ) : null}

          <p className="tkEyebrow">{t("tickets.lawyerPanel")}</p>
          {lawyer ? (
            <div className="tkPerson">
              <img
                src={lawyer.avatar || "/no-avatar.png"}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = "/no-avatar.png";
                }}
              />
              <div>
                <b>{lawyer.username}</b>
                <span>{t("tickets.assignedTo", { name: lawyer.username })}</span>
              </div>
            </div>
          ) : (
            <div className="tkPerson isWaiting">
              <b>{t("tickets.waitingLawyer")}</b>
              <span>{t("tickets.waitingLawyerText")}</span>
            </div>
          )}

          {isAdmin ? (
            <>
              <form className="tkAssign" onSubmit={assign}>
                <label>
                  {t("tickets.assignLawyer")}
                  <select
                    value={lawyerId}
                    onChange={(event) => setLawyerId(event.target.value)}
                    required
                  >
                    <option value="">{t("tickets.chooseLawyer")}</option>
                    {lawyers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.username} ({item.activeCount})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="tkSubmit" disabled={assigning || !lawyerId}>
                  {assigning ? t("tickets.saving") : t("tickets.assign")}
                </button>
              </form>

              <p className="tkEyebrow">{t("tickets.workloadHeading")}</p>
              <ul className="tkPeople">
                {lawyers.map((item) => (
                  <li key={item.id}>
                    <img
                      src={item.avatar || "/no-avatar.png"}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = "/no-avatar.png";
                      }}
                    />
                    <div>
                      <b>{item.username}</b>
                      <span>{t("tickets.activeCount", { count: item.activeCount })}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export default TicketDetailPage;
