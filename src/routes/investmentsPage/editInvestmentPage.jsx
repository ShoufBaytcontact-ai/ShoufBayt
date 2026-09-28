import { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import PageState from "../../components/pageState/pageState";
import { InvestmentLoader } from "./investmentsPage";
import InvestmentLocationPicker from "./investmentLocationPicker";
import "./investmentsPage.scss";

const TYPES = ["building", "land", "office", "shop", "warehouse"];

function imageUrl(image) {
  if (!image) return "/no-image.png";
  if (image.startsWith("http") || image.startsWith("/")) return image;
  return `/${image}`;
}

function EditInvestmentPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const role = String(currentUser?.role || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [location, setLocation] = useState(null);
  const [kept, setKept] = useState([]);
  const [images, setImages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    apiRequest
      .get(`/investments/${id}`)
      .then((res) => {
        if (cancelled) return;
        const item = res.data;
        const ownerId = String(item.user?.id || "");
        const mine = ownerId && ownerId === String(currentUser?.id || "");
        if (role !== "ADMIN" && !mine) {
          setForbidden(true);
          return;
        }
        setForm({
          title: item.title || "",
          price: item.price ?? "",
          city: item.city || "",
          address: item.address || "",
          type: item.type || "building",
          description: item.description || "",
        });
        if (item.latitude != null && item.longitude != null) {
          setLocation({
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
          });
        }
        setKept(Array.isArray(item.images) ? item.images : []);
      })
      .catch((err) => {
        if (!cancelled && err.response?.status === 404) setMissing(true);
        else if (!cancelled) {
          setError(err.response?.data?.message || t("investments.errors.load"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, currentUser?.id, role, t]);

  if (loading) {
    return (
      <main className="investForm pageFade">
        <InvestmentLoader />
      </main>
    );
  }

  if (missing) {
    return (
      <main className="investForm pageFade">
        <PageState
          type="empty"
          title={t("investments.notFound")}
          buttonText={t("investments.back")}
          buttonLink="/investments"
        />
      </main>
    );
  }

  if (forbidden || !form) {
    return (
      <main className="investForm pageFade">
        <p className="investAlert">{error || t("investments.errors.notAllowed")}</p>
        <Link to={`/investments/${id}`}>{t("investments.backToItem")}</Link>
      </main>
    );
  }

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (form.description.trim().length < 20) {
      setError(t("investments.errors.description"));
      return;
    }
    if (!location) {
      setError(t("investments.errors.location"));
      return;
    }

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    data.append("latitude", String(location.latitude));
    data.append("longitude", String(location.longitude));
    data.append("existingImages", JSON.stringify(kept));
    images.forEach((file) => data.append("images", file));

    try {
      setSaving(true);
      await apiRequest.put(`/investments/${id}`, data);
      navigate(`/investments/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || t("investments.errors.update"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="investForm pageFade">
      <p className="investEyebrow">{t("investments.eyebrow")}</p>
      <h1>{t("investments.editTitle")}</h1>
      <span>{t("investments.editText")}</span>
      <form onSubmit={onSubmit}>
        <label>
          {t("investments.form.title")}
          <input name="title" value={form.title} onChange={onChange} required />
        </label>
        <label>
          {t("investments.form.price")}
          <input name="price" type="number" min="1" value={form.price} onChange={onChange} required />
        </label>
        <label>
          {t("investments.form.city")}
          <input name="city" value={form.city} onChange={onChange} required />
        </label>
        <label>
          {t("investments.form.address")}
          <input name="address" value={form.address} onChange={onChange} required />
        </label>
        <label>
          {t("investments.form.type")}
          <select name="type" value={form.type} onChange={onChange}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`investments.types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("investments.form.description")}
          <textarea name="description" value={form.description} onChange={onChange} required />
        </label>
        <InvestmentLocationPicker
          location={location}
          onChange={(next) => {
            setLocation(next);
            setError("");
          }}
          onError={setError}
        />
        {kept.length ? (
          <div className="investPhotos">
            <strong>{t("investments.form.currentPhotos")}</strong>
            <div>
              {kept.map((src) => (
                <figure key={src}>
                  <img src={imageUrl(src)} alt="" />
                  <button
                    type="button"
                    onClick={() => setKept((prev) => prev.filter((item) => item !== src))}
                  >
                    {t("investments.form.removePhoto")}
                  </button>
                </figure>
              ))}
            </div>
          </div>
        ) : null}
        <label>
          {t("investments.form.photos")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => setImages(Array.from(event.target.files || []))}
          />
        </label>
        {error ? <p className="investAlert">{error}</p> : null}
        <div className="investFormActions">
          <button className="investPublish" type="submit" disabled={saving}>
            {saving ? t("investments.savingChanges") : t("investments.saveChanges")}
          </button>
          <Link to={`/investments/${id}`}>{t("investments.cancel")}</Link>
        </div>
      </form>
    </main>
  );
}

export default EditInvestmentPage;
