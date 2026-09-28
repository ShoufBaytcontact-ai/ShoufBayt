import { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Slider from "../../components/slider/slider";
import Map from "../../components/map/map";
import PageState from "../../components/pageState/pageState";
import { InvestmentLoader } from "./investmentsPage";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getListingPhone, toCallHref } from "../../lib/listingContact";
import { getMapCoordinates } from "../../lib/mapCoordinates";
import InvestmentLocationPicker from "./investmentLocationPicker";
import "../singlePage/singlePage.scss";
import "./investmentsPage.scss";

function InvestmentSinglePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [sending, setSending] = useState(false);
  const [pin, setPin] = useState(null);
  const [pinError, setPinError] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest
      .get(`/investments/${id}`)
      .then((res) => {
        if (!cancelled) setItem(res.data);
      })
      .catch((err) => {
        if (!cancelled && err.response?.status === 404) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="singlePage pageFade">
        <InvestmentLoader />
      </main>
    );
  }

  if (missing || !item) {
    return (
      <main className="singlePage pageFade">
        <PageState
          type="empty"
          title={t("investments.notFound")}
          buttonText={t("investments.back")}
          buttonLink="/investments"
        />
      </main>
    );
  }

  const images =
    Array.isArray(item.images) && item.images.length
      ? item.images
      : ["/no-image.png"];
  const phone = getListingPhone(item.user);
  const callHref = toCallHref(phone);
  const coords = getMapCoordinates(item);
  const mapItem = coords
    ? {
        ...item,
        latitude: coords.latitude,
        longitude: coords.longitude,
        title: item.title,
        href: `/investments/${item.id}`,
        property: item.type,
      }
    : null;
  const ownerId = String(item.user?.id || "");
  const mine = ownerId && ownerId === String(currentUser?.id || "");
  const role = String(currentUser?.role || "").toUpperCase();
  const canManage = role === "ADMIN" || mine;

  const savePin = async () => {
    if (!pin) {
      setPinError(t("investments.errors.location"));
      return;
    }
    try {
      setSavingPin(true);
      const res = await apiRequest.patch(`/investments/${item.id}/location`, {
        latitude: pin.latitude,
        longitude: pin.longitude,
      });
      setItem(res.data);
      setPin(null);
      setPinError("");
    } catch (error) {
      setPinError(error.response?.data?.message || t("investments.errors.locationSave"));
    } finally {
      setSavingPin(false);
    }
  };

  const removeInvestment = async () => {
    if (!window.confirm(t("investments.confirmDelete"))) return;
    try {
      setDeleting(true);
      await apiRequest.delete(`/investments/${item.id}`);
      navigate("/investments");
    } catch (error) {
      window.alert(error.response?.data?.message || t("investments.errors.delete"));
      setDeleting(false);
    }
  };

  const sendMessage = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    if (!ownerId || mine) return;

    try {
      setSending(true);
      const chatRes = await apiRequest.post("/chats", { receiverId: ownerId });
      const chat = chatRes.data?.chat || chatRes.data;
      if (chat?.id) {
        await apiRequest.post("/messages", {
          chatId: chat.id,
          text: `${t("investments.inquiry")}\n${item.title}\n${window.location.href}`,
        });
        navigate("/chat", { state: { chatId: chat.id, openChatNow: Date.now() } });
      }
    } catch (error) {
      window.alert(error.response?.data?.message || t("single.alerts.chatFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="singlePage isDesk pageFade">
      <div className="singleBar">
        <Link to="/investments">{t("investments.back")}</Link>
        {canManage ? (
          <div className="investManage">
            <Link to={`/investments/${item.id}/edit`}>{t("investments.edit")}</Link>
            <button type="button" onClick={removeInvestment} disabled={deleting}>
              {deleting ? t("investments.deleting") : t("investments.delete")}
            </button>
          </div>
        ) : null}
      </div>

      <section className="singleGallery">
        <Slider images={images} />
      </section>

      <section className="singleBody">
        <div className="singleMain">
          <header className="singleIntro">
            <div className="singleTags">
              <span className="tag sale">{t("investments.eyebrow")}</span>
              <span className="tag ghost">
                {t(`investments.types.${item.type}`, { defaultValue: item.type })}
              </span>
              <span className="tag ghost">{item.city}</span>
            </div>
            <h1>{item.title}</h1>
            <p className="singleAddress">{item.address}</p>
          </header>

          <div className="singleLower">
            <article className="singleCopy">
              <h2>{t("investments.about")}</h2>
              <p className="singleCopyBody">{item.description}</p>
            </article>
            <article className="singleMap">
              <h2>{t("single.sections.propertyLocation")}</h2>
              {mapItem ? (
                <div className="singleMapBox">
                  <Map items={[mapItem]} />
                </div>
              ) : canManage ? (
                <>
                  <InvestmentLocationPicker
                    location={pin}
                    onChange={(next) => {
                      setPin(next);
                      setPinError("");
                    }}
                    onError={setPinError}
                  />
                  <div className="investPinSave">
                    {pinError ? <p className="investAlert">{pinError}</p> : null}
                    <button type="button" className="investPublish" onClick={savePin} disabled={savingPin}>
                      {savingPin ? t("investments.savingPin") : t("investments.savePin")}
                    </button>
                  </div>
                </>
              ) : (
                <div className="singleMapBox">
                  <p>{t("single.fallback.noLocation")}</p>
                </div>
              )}
            </article>
          </div>
        </div>

        <aside className="singleAside">
          <div className="singleOffer">
            <small>{t("investments.price")}</small>
            <strong>${Number(item.price || 0).toLocaleString()}</strong>
            <div className="singleActions">
              {!mine && (
                <button type="button" className="primary" onClick={sendMessage} disabled={sending}>
                  {sending ? t("investments.opening") : t("investments.contact")}
                </button>
              )}
              {callHref ? (
                <a className="soft" href={callHref}>
                  {t("investments.call")}
                </a>
              ) : null}
            </div>
          </div>
          <div className="singleOwner">
            <img src={item.user?.avatar || "/no-avatar.png"} alt="" />
            <div>
              <small>{t("investments.listedBy")}</small>
              <b>{item.user?.username || t("single.fallback.unknownUser")}</b>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default InvestmentSinglePage;
