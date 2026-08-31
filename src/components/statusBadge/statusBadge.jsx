import { useTranslation } from "react-i18next";
import { toUiPropertyStatus } from "../../lib/propertyStatus";
import "./statusBadge.scss";

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const value = toUiPropertyStatus(status);

  const statusText = {
    available: t("statusBadge.available"),
    sold: t("statusBadge.sold"),
    rented: t("statusBadge.rented"),
    pending: t("statusBadge.pending"),
    rejected: t("statusBadge.rejected"),
  };

  return (
    <span className={`statusBadge ${value}`}>
      {statusText[value] || t("statusBadge.available")}
    </span>
  );
}

export default StatusBadge;
