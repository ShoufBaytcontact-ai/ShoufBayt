import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import InvestmentLocationPicker from "./investmentLocationPicker";
import "./investmentsPage.scss";

const TYPES = ["building", "land", "office", "shop", "warehouse"];

function NewInvestmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const role = String(currentUser?.role || "").toUpperCase();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    price: "",
    city: "",
    address: "",
    type: "building",
    description: "",
  });
  const [location, setLocation] = useState(null);
  const [images, setImages] = useState([]);

  if (role !== "AGENT" && role !== "ADMIN") {
    return (
      <main className="investForm pageFade">
        <p className="investAlert">{t("investments.errors.agentsOnly")}</p>
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
    images.forEach((file) => data.append("images", file));

    try {
      setSaving(true);
      const res = await apiRequest.post("/investments", data);
      navigate(`/investments/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || t("investments.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="investForm pageFade">
      <p className="investEyebrow">{t("investments.eyebrow")}</p>
      <h1>{t("investments.addTitle")}</h1>
      <span>{t("investments.addText")}</span>
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
        <button className="investPublish" type="submit" disabled={saving}>
          {saving ? t("investments.saving") : t("investments.publish")}
        </button>
      </form>
    </main>
  );
}

export default NewInvestmentPage;
