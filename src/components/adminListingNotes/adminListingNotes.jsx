import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import apiRequest from "../../lib/apiRequest";
import "./adminListingNotes.scss";

function AdminListingNotes({ listingRequestId, propertyId }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canLoad = Boolean(listingRequestId || propertyId);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError("");
        setLoading(true);
        if (!canLoad) {
          setNotes([]);
          return;
        }
        const res = await apiRequest.get("/admin/listing-notes", {
          params: {
            ...(listingRequestId ? { listingRequestId } : {}),
            ...(propertyId ? { propertyId } : {}),
          },
        });
        if (alive) {
          setNotes(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        if (alive) {
          setError(
            err.response?.data?.message || t("admin.listingNotes.errors.load")
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listingRequestId, propertyId, canLoad, t]);

  const submit = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;

    try {
      setSaving(true);
      setError("");
      const res = await apiRequest.post("/admin/listing-notes", {
        body: text,
        listingRequestId: listingRequestId || undefined,
        propertyId: propertyId || undefined,
      });
      setNotes((prev) => [...prev, res.data]);
      setBody("");
    } catch (err) {
      setError(
        err.response?.data?.message || t("admin.listingNotes.errors.save")
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canLoad) return null;

  return (
    <article className="adminListingNotes">
      <p className="adminListingNotesBadge">{t("admin.listingNotes.badge")}</p>
      <h2>{t("admin.listingNotes.title")}</h2>
      <p>{t("admin.listingNotes.description")}</p>

      {loading ? (
        <p className="adminListingNotesEmpty">{t("admin.listingNotes.loading")}</p>
      ) : notes.length === 0 ? (
        <p className="adminListingNotesEmpty">{t("admin.listingNotes.empty")}</p>
      ) : (
        <ul className="adminListingNotesList">
          {notes.map((note) => (
            <li key={note.id}>
              <div>
                <b>{note.author?.username || t("admin.fallback.user")}</b>
                <small>
                  {note.createdAt
                    ? new Date(note.createdAt).toLocaleString()
                    : ""}
                </small>
              </div>
              <p>{note.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit}>
        <label>
          {t("admin.listingNotes.field")}
          <textarea
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("admin.listingNotes.placeholder")}
            required
          />
        </label>
        {error ? <p className="adminListingNotesError">{error}</p> : null}
        <button type="submit" disabled={saving || !body.trim()}>
          {saving ? t("admin.listingNotes.saving") : t("admin.listingNotes.add")}
        </button>
      </form>
    </article>
  );
}

export default AdminListingNotes;
