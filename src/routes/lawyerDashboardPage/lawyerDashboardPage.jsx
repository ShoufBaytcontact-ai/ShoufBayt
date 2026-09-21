import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import {
  TicketHead,
  TicketLoader,
  TicketTable,
  ticketApiPath,
} from "../ticketsPage/ticketsPage";
import "../ticketsPage/ticketsPage.scss";

const ACTIVE = new Set(["OPEN", "IN_REVIEW", "WAITING_USER", "WAITING_OTHER"]);

function LawyerDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const role = String(currentUser?.role || "").toUpperCase();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [statusBusy, setStatusBusy] = useState("");

  useEffect(() => {
    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (role !== "LAWYER") {
      navigate("/tickets", { replace: true });
    }
  }, [currentUser, navigate, role]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiRequest.get("/tickets");
        if (alive) setTickets(res.data?.tickets || []);
      } catch (err) {
        if (alive) {
          setError(err.response?.data?.message || t("lawyerHub.errors.load"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const stats = useMemo(() => {
    const active = tickets.filter((item) => ACTIVE.has(item.status));
    return {
      assigned: tickets.length,
      active: active.length,
      waiting: tickets.filter((item) => item.status === "WAITING_USER").length,
      review: tickets.filter((item) => item.status === "IN_REVIEW").length,
    };
  }, [tickets]);

  const visible = useMemo(() => {
    if (filter === "waiting") {
      return tickets.filter((item) => item.status === "WAITING_USER");
    }
    if (filter === "review") {
      return tickets.filter((item) => item.status === "IN_REVIEW");
    }
    if (filter === "active") {
      return tickets.filter((item) => ACTIVE.has(item.status));
    }
    return tickets;
  }, [filter, tickets]);

  const changeStatus = async (ticket, nextStatus) => {
    if (!nextStatus || nextStatus === ticket.status) return;
    try {
      setStatusBusy(ticket.id);
      setError("");
      const res = await apiRequest.patch(ticketApiPath(ticket.number), {
        status: nextStatus,
      });
      const updated = res.data?.ticket;
      setTickets((prev) =>
        prev.map((item) =>
          item.id === ticket.id
            ? { ...item, status: updated?.status || nextStatus }
            : item
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || t("tickets.errors.status"));
    } finally {
      setStatusBusy("");
    }
  };

  if (role !== "LAWYER") {
    return null;
  }

  return (
    <main className="tk pageFade">
      <TicketHead
        eyebrow={t("lawyerHub.badge")}
        title={t("lawyerHub.title")}
        kicker={currentUser?.username}
        action={
          <Link className="tkText" to="/tickets">
            {t("lawyerHub.allTickets")}
          </Link>
        }
      />

      <section className="tkStats">
        {[
          ["assigned", stats.assigned],
          ["active", stats.active],
          ["review", stats.review],
          ["waiting", stats.waiting],
        ].map(([key, value]) => (
          <button
            key={key}
            type="button"
            className={filter === (key === "assigned" ? "all" : key) ? "isOn" : ""}
            onClick={() => setFilter(key === "assigned" ? "all" : key)}
          >
            <span>{t(`lawyerHub.stats.${key}`)}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </section>

      {loading ? <TicketLoader /> : null}
      {error ? <p className="tkError">{error}</p> : null}

      {!loading && !visible.length ? (
        <div className="tkEmpty">
          <h2>{t("lawyerHub.emptyTitle")}</h2>
        </div>
      ) : null}

      {!loading && visible.length ? (
        <TicketTable
          tickets={visible}
          t={t}
          variant="lawyer"
          onStatusChange={changeStatus}
          statusBusy={statusBusy}
        />
      ) : null}
    </main>
  );
}

export default LawyerDashboardPage;
