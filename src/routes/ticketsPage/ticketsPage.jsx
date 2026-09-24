import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import PhoneField from "../../components/phoneField/PhoneField";
import { isValidPhone } from "../../lib/phoneCountries";
import HouseLoader from "../../components/houseLoader/houseLoader";
import "./ticketsPage.scss";

export const TICKET_STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "WAITING_USER",
  "WAITING_OTHER",
  "RESOLVED",
  "CLOSED",
];

export function ticketHref(number) {
  return `/tickets/${encodeURIComponent(String(number || "").replace(/^#/, ""))}`;
}

export function ticketApiPath(number) {
  return `/tickets/${encodeURIComponent(String(number || "").replace(/^#/, ""))}`;
}

export function lawyerName(ticket, t) {
  return (
    ticket?.lawyer?.username ||
    (typeof ticket?.lawyer === "string" ? ticket.lawyer : "") ||
    t("tickets.unassigned")
  );
}

export function TicketLoader({ label }) {
  const { t } = useTranslation();
  return (
    <div className="tkLoader" role="status" aria-live="polite">
      <HouseLoader
        variant="inline"
        size="sm"
        jumping={false}
        label={label || t("tickets.loading")}
      />
      <span>{label || t("tickets.loading")}</span>
      <i />
    </div>
  );
}

export function TicketHead({ eyebrow, title, kicker, action }) {
  return (
    <header className="tkHead">
      <div>
        {eyebrow ? <p className="tkEyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {kicker ? <p>{kicker}</p> : null}
      </div>
      {action || null}
    </header>
  );
}

export function StatusMark({ status, t }) {
  return (
    <em className="tkMark" data-status={status}>
      {t(`tickets.status.${status}`)}
    </em>
  );
}

export function TicketBoard({
  tickets,
  loading,
  t,
  clickable = "mine",
  variant = "rail",
}) {
  return (
    <aside className={`tkBoard${variant === "page" ? " isPage" : ""}`}>
      <p className="tkEyebrow">{t("tickets.board")}</p>
      {loading ? <TicketLoader /> : null}
      {!loading && !tickets.length ? (
        <p className="tkHint">{t("tickets.boardEmpty")}</p>
      ) : null}
      <ul>
        {tickets.map((ticket) => {
          const canOpen =
            clickable === "all" || ticket.mine || ticket.assigned;
          const inner = (
            <>
              <span className="tkBoardNo">#{ticket.number}</span>
              <StatusMark status={ticket.status} t={t} />
              <span className="tkBoardLawyer">{lawyerName(ticket, t)}</span>
            </>
          );
          return (
            <li key={ticket.id || ticket.number}>
              {canOpen ? (
                <Link
                  className={`tkBoardItem${ticket.assigned ? " isAssigned" : ""}`}
                  to={ticketHref(ticket.number)}
                >
                  {inner}
                </Link>
              ) : (
                <div className="tkBoardItem">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function LawyerWorkload({ lawyers, t }) {
  return (
    <aside className="tkSide">
      <p className="tkEyebrow">{t("tickets.workloadTitle")}</p>
      {!lawyers?.length ? (
        <p className="tkHint">{t("tickets.noLawyers")}</p>
      ) : (
        <ul className="tkPeople">
          {lawyers.map((lawyer) => (
            <li key={lawyer.id}>
              <img
                src={lawyer.avatar || "/no-avatar.png"}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = "/no-avatar.png";
                }}
              />
              <div>
                <b>{lawyer.username}</b>
                <span>{t("tickets.activeCount", { count: lawyer.activeCount })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function TicketTable({
  tickets,
  t,
  variant = "admin",
  onStatusChange,
  statusBusy,
}) {
  const lawyerView = variant === "lawyer";
  const canEditStatus = lawyerView && typeof onStatusChange === "function";

  return (
    <div className={`tkTable ${lawyerView ? "isLawyer" : "isAdmin"}`}>
      <div className="tkTableHead">
        <span>{t("tickets.cols.number")}</span>
        <span>{t("tickets.cols.case")}</span>
        <span>{lawyerView ? t("tickets.cols.client") : t("tickets.cols.lawyer")}</span>
        {lawyerView ? <span>{t("tickets.cols.phone")}</span> : null}
        <span>{t("tickets.cols.status")}</span>
      </div>
      <ul>
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <div className="tkRow">
              <Link to={ticketHref(ticket.number)}>
                <strong>#{ticket.number}</strong>
                <b>{ticket.title}</b>
                <span>
                  {lawyerView
                    ? ticket.author?.username || t("tickets.someone")
                    : lawyerName(ticket, t)}
                </span>
                {lawyerView ? (
                  <span className="tkPhone">{ticket.phone || "—"}</span>
                ) : null}
              </Link>
              {canEditStatus ? (
                <select
                  className="tkStatusSelect"
                  value={ticket.status}
                  disabled={statusBusy === ticket.id}
                  onChange={(event) => onStatusChange(ticket, event.target.value)}
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
          </li>
        ))}
      </ul>
    </div>
  );
}

function TicketsPage() {
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const role = String(currentUser?.role || "").toUpperCase();
  const isLawyer = role === "LAWYER";
  const isAdmin = role === "ADMIN";

  const [tickets, setTickets] = useState([]);
  const [board, setBoard] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        if (isAdmin) {
          const res = await apiRequest.get("/tickets", {
            params: status ? { status } : {},
          });
          if (alive) {
            setTickets(res.data?.tickets || []);
            setLawyers(res.data?.lawyers || []);
          }
        } else if (isLawyer) {
          const res = await apiRequest.get("/tickets/board");
          if (alive) setBoard(res.data?.tickets || []);
        } else {
          const [mine, publicBoard] = await Promise.all([
            apiRequest.get("/tickets"),
            apiRequest.get("/tickets/board"),
          ]);
          if (alive) {
            setTickets(mine.data?.tickets || []);
            setBoard(publicBoard.data?.tickets || []);
          }
        }
      } catch (err) {
        if (alive) {
          setError(err.response?.data?.message || t("tickets.errors.load"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, t, isAdmin, isLawyer]);

  const openCount = useMemo(
    () => tickets.filter((item) => item.status === "OPEN").length,
    [tickets]
  );

  if (isLawyer) {
    return (
      <div className="tk pageFade">
        <TicketHead
          eyebrow={t("tickets.badge")}
          title={t("tickets.title")}
          action={
            <Link className="tkText" to="/lawyer">
              {t("lawyerHub.badge")}
            </Link>
          }
        />
        {error ? <p className="tkError">{error}</p> : null}
        <TicketBoard
          tickets={board}
          loading={loading}
          t={t}
          clickable="all"
          variant="page"
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="tk tkUser pageFade">
        <TicketHead
          eyebrow={t("tickets.badge")}
          title={t("tickets.title")}
          action={
            <Link className="tkText" to="/tickets/new">
              {t("tickets.new")}
            </Link>
          }
        />
        <div className="tkUserGrid">
          <div>
            {loading ? <TicketLoader /> : null}
            {error ? <p className="tkError">{error}</p> : null}
            {!loading && !tickets.length ? (
              <div className="tkEmpty">
                <h2>{t("tickets.emptyTitle")}</h2>
                <Link className="tkText" to="/tickets/new">
                  {t("tickets.new")}
                </Link>
              </div>
            ) : null}
            {!loading && tickets.length ? (
              <TicketTable tickets={tickets} t={t} variant="admin" />
            ) : null}
          </div>
          <TicketBoard tickets={board} loading={loading} t={t} />
        </div>
      </div>
    );
  }

  return (
    <div className="tk pageFade">
      <TicketHead
        eyebrow={t("tickets.badge")}
        title={t("tickets.deskTitle")}
      />

      <div className="tkDesk hasSide">
        <div>
          <div className="tkFilters">
            <button
              type="button"
              className={!status ? "isOn" : ""}
              onClick={() => setStatus("")}
            >
              {t("tickets.all")}
            </button>
            {TICKET_STATUSES.map((item) => (
              <button
                key={item}
                type="button"
                className={status === item ? "isOn" : ""}
                onClick={() => setStatus(item)}
              >
                {t(`tickets.status.${item}`)}
              </button>
            ))}
            <span className="tkCount">{t("tickets.openCount", { count: openCount })}</span>
          </div>

          {loading ? <TicketLoader /> : null}
          {error ? <p className="tkError">{error}</p> : null}

          {!loading && !tickets.length ? (
            <div className="tkEmpty">
              <h2>{t("tickets.emptyTitle")}</h2>
            </div>
          ) : null}

          {!loading && tickets.length ? (
            <TicketTable tickets={tickets} t={t} variant="admin" />
          ) : null}
        </div>
        <LawyerWorkload lawyers={lawyers} t={t} />
      </div>
    </div>
  );
}

export function NewTicketPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "OTHER",
    phone: currentUser?.phone || "",
  });
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onImages = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 8);
    setImages(files);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!isValidPhone(form.phone)) {
      setError(t("tickets.errors.phone"));
      return;
    }
    try {
      setSaving(true);
      setError("");
      const data = new FormData();
      data.append("title", form.title);
      data.append("description", form.description);
      data.append("category", form.category);
      data.append("phone", form.phone);
      images.forEach((file) => data.append("images", file));
      const res = await apiRequest.post("/tickets", data);
      navigate(ticketHref(res.data.ticket.number));
    } catch (err) {
      setError(err.response?.data?.message || t("tickets.errors.create"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tk pageFade">
      <TicketHead
        eyebrow={t("tickets.badge")}
        title={t("tickets.newTitle")}
        action={
          <Link className="tkText" to="/tickets">
            {t("tickets.back")}
          </Link>
        }
      />

      <form className="tkForm" onSubmit={onSubmit}>
        <label>
          {t("tickets.fields.title")}
          <input
            name="title"
            value={form.title}
            onChange={onChange}
            required
            minLength={4}
          />
        </label>
        <label>
          {t("tickets.fields.phone")}
          <PhoneField
            value={form.phone}
            onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
            required
          />
        </label>
        <label>
          {t("tickets.fields.category")}
          <select name="category" value={form.category} onChange={onChange}>
            {["REAL_ESTATE_DOCUMENTS", "LAND_REGISTRY_CADASTRE", "CONSTRUCTION", "LAWYER_DEFENSE", "PAYMENT", "OTHER"].map(
              (item) => (
                <option key={item} value={item}>
                  {t(`tickets.category.${item}`)}
                </option>
              )
            )}
          </select>
        </label>
        <label>
          {t("tickets.fields.description")}
          <textarea
            name="description"
            value={form.description}
            onChange={onChange}
            rows={6}
            required
            minLength={12}
          />
        </label>
        <label>
          {t("tickets.fields.images")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={onImages}
          />
          <small>{t("tickets.imagesHint")}</small>
        </label>
        {previews.length ? (
          <div className="tkImages">
            {previews.map((url) => (
              <img key={url} src={url} alt="" />
            ))}
          </div>
        ) : null}
        {error ? <p className="tkError">{error}</p> : null}
        <button type="submit" className="tkSubmit" disabled={saving}>
          {saving ? t("tickets.saving") : t("tickets.submit")}
        </button>
      </form>
    </div>
  );
}

export default TicketsPage;
