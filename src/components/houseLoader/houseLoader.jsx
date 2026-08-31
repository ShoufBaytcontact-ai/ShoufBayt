import { useEffect, useRef, useState } from "react";
import { useNavigation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HouseMark from "../houseMark/houseMark";
import "./houseLoader.scss";

function HouseLoader({
  variant = "inline",
  jumping = true,
  size = "lg",
  label,
}) {
  const { t } = useTranslation();
  const text =
    label ||
    t("pageLoader.label", { defaultValue: "Loading ShoufBayt" });

  return (
    <div
      className={`houseLoader houseLoader--${variant}${
        jumping ? " isJumping" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div className="houseLoaderStage">
        <div className="houseLoaderHouse">
          <HouseMark size={size} />
        </div>
        <span className="houseLoaderShadow" />
      </div>
      {variant === "overlay" && (
        <p className="houseLoaderWord">{text}</p>
      )}
    </div>
  );
}

export function RouteLoader() {
  const navigation = useNavigation();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const busy = navigation.state !== "idle";

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!busy) {
      setVisible(false);
      return undefined;
    }

    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, 160);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [busy]);

  if (!visible) return null;

  return (
    <div
      className="routeProgress"
      role="progressbar"
      aria-busy="true"
      aria-label="Loading"
    >
      <span />
    </div>
  );
}

export default HouseLoader;
