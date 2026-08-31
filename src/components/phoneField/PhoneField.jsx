import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  digitsOnly,
  flagUrl,
  formatE164,
  getPhoneCountry,
  nationalLength,
  parsePhone,
} from "../../lib/phoneCountries";
import "./phoneField.scss";

function countryName(iso, locale) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(iso) || iso;
  } catch {
    return iso;
  }
}

function PhoneField({
  id = "phone",
  value = "",
  onChange,
  disabled = false,
  required = false,
  allowEmpty = false,
}) {
  const { t, i18n } = useTranslation();
  const rootRef = useRef(null);
  const parsed = useMemo(() => parsePhone(value), [value]);

  const [iso, setIso] = useState(
    parsed.country?.iso || DEFAULT_PHONE_COUNTRY
  );
  const [national, setNational] = useState(parsed.national || "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const country = getPhoneCountry(iso);
  const { min, max } = nationalLength(country);
  const locale = i18n.language || "en";

  useEffect(() => {
    const next = parsePhone(value, iso);
    if (!value) {
      return;
    }
    if (next.e164 === formatE164(iso, national)) {
      return;
    }
    setIso(next.country.iso);
    setNational(next.national);
  }, [value]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const emit = (nextIso, nextNational) => {
    const e164 = formatE164(nextIso, nextNational);
    onChange?.(e164);
  };

  const labeledCountries = useMemo(() => {
    return PHONE_COUNTRIES.map((item) => ({
      ...item,
      name: countryName(item.iso, locale),
    })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return labeledCountries;
    return labeledCountries.filter((item) => {
      return (
        item.name.toLowerCase().includes(needle) ||
        item.iso.toLowerCase().includes(needle) ||
        item.code.includes(needle) ||
        item.dial.includes(needle.replace("+", ""))
      );
    });
  }, [labeledCountries, query]);

  const hint =
    min === max
      ? t("phoneField.digitsHint", { count: min })
      : t("phoneField.digitsRangeHint", { min, max });

  const placeholder = min === 8 ? "71123456" : t("phoneField.numberPlaceholder");

  return (
    <div className="phoneField" ref={rootRef}>
      <div className="phoneFieldRow">
        <div className="phoneFieldCountry">
          <button
            type="button"
            className="phoneFieldCountryBtn"
            onClick={() => setOpen((prev) => !prev)}
            disabled={disabled}
            aria-expanded={open}
            aria-label={t("phoneField.countryLabel")}
          >
            <img
              src={flagUrl(country.iso)}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <span>{country.code}</span>
          </button>

          {open ? (
            <div className="phoneFieldMenu">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("phoneField.searchCountry")}
                autoFocus
              />
              <div className="phoneFieldOptions">
                {filtered.map((item) => (
                  <button
                    type="button"
                    key={item.iso}
                    className={
                      item.iso === country.iso
                        ? "phoneFieldOption isActive"
                        : "phoneFieldOption"
                    }
                    onClick={() => {
                      setIso(item.iso);
                      setOpen(false);
                      setQuery("");
                      emit(item.iso, national);
                    }}
                  >
                    <img
                      src={flagUrl(item.iso)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="phoneFieldName">{item.name}</span>
                    <span className="phoneFieldCode">{item.code}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={national}
          maxLength={max}
          disabled={disabled}
          required={required && !allowEmpty}
          placeholder={placeholder || t("phoneField.numberPlaceholder")}
          onChange={(event) => {
            const next = digitsOnly(event.target.value).slice(0, max);
            setNational(next);
            emit(iso, next);
          }}
        />
      </div>
      <p className="phoneFieldHint">{hint}</p>
    </div>
  );
}

export default PhoneField;
