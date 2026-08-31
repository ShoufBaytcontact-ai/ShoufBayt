import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HouseLoader from "../houseLoader/houseLoader";
import HouseMark from "../houseMark/houseMark";
import "./pageState.scss";

function PageState({
  type = "loading",
  title,
  message,
  buttonText,
  buttonLink,
  onClick,
}) {
  const { t } = useTranslation();

  const isLoading = type === "loading";
  const isError = type === "error";
  const isEmpty = type === "empty";

  const defaultTitle = isLoading
    ? t("pageState.loading.title")
    : isError
    ? t("pageState.error.title")
    : t("pageState.empty.title");

  const defaultMessage = isLoading
    ? t("pageState.loading.message")
    : isError
    ? t("pageState.error.message")
    : t("pageState.empty.message");

  return (
    <div
      className={
        isError
          ? "pageState errorState"
          : isEmpty
          ? "pageState emptyState"
          : "pageState loadingState"
      }
    >
      <div className="stateIcon">
        {isLoading ? (
          <HouseLoader variant="inline" size="sm" />
        ) : isError ? (
          "!"
        ) : (
          <HouseMark size="sm" />
        )}
      </div>

      <h2>{title || defaultTitle}</h2>

      <p>{message || defaultMessage}</p>

      {buttonText && buttonLink && (
        <Link to={buttonLink} className="stateButton">
          {buttonText}
        </Link>
      )}

      {buttonText && onClick && (
        <button type="button" className="stateButton" onClick={onClick}>
          {buttonText}
        </button>
      )}
    </div>
  );
}

export default PageState;