import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { reviewApi } from "../../lib/services";
import "./reviewsPanel.scss";

function StarIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.2 14.6 8.6l6 .9-4.3 4.2 1 5.9L12 16.8 6.7 19.6l1-5.9-4.3-4.2 6-.9L12 3.2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stars({ value = 0, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span className="reviewStars" aria-hidden="true">
        {stars.map((star) => (
          <span key={star} className={star <= value ? "isOn" : ""}>
            <StarIcon filled={star <= value} />
          </span>
        ))}
      </span>
    );
  }

  return (
    <div
      className="reviewStars isPicker"
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHover(0)}
    >
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          className={star <= shown ? "isOn" : ""}
          aria-label={`${star}`}
          aria-checked={star === value}
          onMouseEnter={() => setHover(star)}
          onFocus={() => setHover(star)}
          onClick={() => onChange(star)}
        >
          <StarIcon filled={star <= shown} />
        </button>
      ))}
    </div>
  );
}

function ReviewsPanel({
  mode = "property",
  targetId,
  title,
  onStats,
  embedded,
  canWrite = true,
}) {
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const currentUserId = String(currentUser?.id || currentUser?._id || "");

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const heading =
    title ||
    (mode === "agent"
      ? t("reviews.agentTitle")
      : t("reviews.propertyTitle"));

  const myReview = useMemo(
    () =>
      reviews.find(
        (item) => String(item.reviewerId || item.reviewer?.id || "") === currentUserId
      ) || null,
    [reviews, currentUserId]
  );

  const otherReviews = useMemo(
    () =>
      reviews.filter(
        (item) => String(item.reviewerId || item.reviewer?.id || "") !== currentUserId
      ),
    [reviews, currentUserId]
  );

  const load = async () => {
    if (!targetId) return;

    try {
      setLoading(true);
      setError("");

      const res =
        mode === "agent"
          ? await reviewApi.agentList(targetId)
          : await reviewApi.propertyList(targetId);

      setReviews(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || t("reviews.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [targetId, mode]);

  useEffect(() => {
    if (!myReview || editing) {
      return;
    }

    setRating(myReview.rating || 5);
    setComment(myReview.comment || "");
  }, [myReview, editing]);

  const average =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, item) => sum + (item.rating || 0), 0) /
        reviews.length;

  useEffect(() => {
    if (!onStats) {
      return;
    }

    onStats({
      average,
      count: reviews.length,
    });
  }, [average, reviews.length, onStats]);

  const submit = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setError(t("reviews.loginError"));
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (myReview) {
        if (mode === "agent") {
          await reviewApi.agentUpdate(myReview.id, { rating, comment });
        } else {
          await reviewApi.propertyUpdate(myReview.id, { rating, comment });
        }
      } else if (mode === "agent") {
        await reviewApi.agentCreate(targetId, { rating, comment });
      } else {
        await reviewApi.propertyCreate(targetId, { rating, comment });
      }

      setEditing(false);
      setSuccess(t("reviews.thanks"));
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (myReview ? t("reviews.updateFailed") : t("reviews.submitFailed"))
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    if (!myReview) {
      return;
    }

    setRating(myReview.rating || 5);
    setComment(myReview.comment || "");
    setError("");
    setSuccess("");
    setEditing(true);
  };

  const cancelEdit = () => {
    if (!myReview) {
      return;
    }

    setRating(myReview.rating || 5);
    setComment(myReview.comment || "");
    setEditing(false);
    setError("");
  };

  const remove = async (reviewId) => {
    try {
      if (mode === "agent") {
        await reviewApi.agentDelete(reviewId);
      } else {
        await reviewApi.propertyDelete(reviewId);
      }

      setEditing(false);
      setRating(5);
      setComment("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("reviews.deleteFailed"));
    }
  };

  const showForm =
    Boolean(currentUser) && canWrite && (!myReview || editing);

  const renderReview = (review, isMine = false) => (
    <article
      key={review.id}
      className={isMine ? "reviewCard isMine" : "reviewCard"}
    >
      <div className="reviewTop">
        <strong>
          {isMine
            ? t("reviews.yours")
            : review.reviewer?.username || "User"}
        </strong>
        <Stars value={review.rating || 0} />
        <small>
          {review.createdAt
            ? new Date(review.createdAt).toLocaleDateString()
            : ""}
        </small>
        {isMine && (
          <div className="reviewOwnActions">
            <button type="button" onClick={startEdit}>
              {t("reviews.edit")}
            </button>
            <button type="button" onClick={() => remove(review.id)}>
              {t("reviews.delete")}
            </button>
          </div>
        )}
      </div>
      {review.comment && <p>{review.comment}</p>}
    </article>
  );

  return (
    <section className={embedded ? "reviewsPanel isEmbedded" : "reviewsPanel"}>
      {!embedded && (
        <div className="reviewsHead">
          <h3>{heading}</h3>
          <p>
            <Stars value={Math.round(average)} />
            <span>
              {reviews.length > 0 ? `${average.toFixed(1)} · ` : ""}
              {t("reviews.count", { count: reviews.length })}
            </span>
          </p>
        </div>
      )}

      {embedded && (
        <div className="reviewsSummary">
          <Stars value={Math.round(average)} />
          <span>
            {reviews.length > 0 ? `${average.toFixed(1)} · ` : ""}
            {t("reviews.count", { count: reviews.length })}
          </span>
        </div>
      )}

      {error && <div className="reviewAlert error">{error}</div>}
      {success && <div className="reviewAlert success">{success}</div>}

      {showForm && (
        <form className="reviewForm" onSubmit={submit}>
          <Stars value={rating} onChange={setRating} />
          <textarea
            maxLength={180}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("reviews.placeholder")}
            rows={3}
          />
          <div className="reviewFormActions">
            <button type="submit" className="reviewSubmit" disabled={saving}>
              {saving
                ? t("reviews.sending")
                : myReview
                  ? t("reviews.save")
                  : t("reviews.submit")}
            </button>
            {myReview && (
              <button
                type="button"
                className="reviewCancel"
                onClick={cancelEdit}
                disabled={saving}
              >
                {t("reviews.cancel")}
              </button>
            )}
          </div>
        </form>
      )}

      {!currentUser && <p className="muted">{t("reviews.login")}</p>}

      {loading ? (
        <p className="muted">{t("reviews.loading")}</p>
      ) : reviews.length === 0 ? (
        <p className="muted">{t("reviews.empty")}</p>
      ) : (
        <div className="reviewsList">
          {myReview && !editing ? renderReview(myReview, true) : null}
          {otherReviews.map((review) => renderReview(review))}
        </div>
      )}
    </section>
  );
}

export default ReviewsPanel;
