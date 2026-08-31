import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./slider.scss";

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {direction === "left" ? (
        <path d="M15 5 8 12l7 7" />
      ) : (
        <path d="M9 5l7 7-7 7" />
      )}
    </svg>
  );
}

function Slider({ images = [] }) {
  const { t } = useTranslation();

  const imageKey = useMemo(
    () => (Array.isArray(images) ? images.filter(Boolean).join("|") : ""),
    [images]
  );

  const safeImages = useMemo(() => {
    return imageKey ? imageKey.split("|") : ["/no-image.png"];
  }, [imageKey]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const thumbnailRailRef = useRef(null);

  const hasMultipleImages = safeImages.length > 1;
  const currentImage = safeImages[currentIndex] || "/no-image.png";

  const goTo = useCallback(
    (index) => {
      const last = safeImages.length - 1;
      if (last < 0) return;
      if (index < 0) {
        setCurrentIndex(last);
        return;
      }
      if (index > last) {
        setCurrentIndex(0);
        return;
      }
      setCurrentIndex(index);
    },
    [safeImages.length]
  );

  const changeSlide = useCallback(
    (direction) => {
      if (!hasMultipleImages) return;

      setCurrentIndex((prev) => {
        if (direction === "left") {
          return prev === 0 ? safeImages.length - 1 : prev - 1;
        }
        return prev === safeImages.length - 1 ? 0 : prev + 1;
      });
    },
    [hasMultipleImages, safeImages.length]
  );

  useEffect(() => {
    setCurrentIndex(0);
  }, [imageKey]);

  useEffect(() => {
    const rail = thumbnailRailRef.current;
    if (!rail) return;

    const active = rail.querySelector(".thumbnail.active");
    if (!active) return;

    const railBox = rail.getBoundingClientRect();
    const thumbBox = active.getBoundingClientRect();
    const extra =
      thumbBox.left - railBox.left - railBox.width / 2 + thumbBox.width / 2;

    rail.scrollBy({ left: extra, behavior: "smooth" });
  }, [currentIndex]);

  useEffect(() => {
    if (!fullScreen) return undefined;

    const onKey = (e) => {
      if (e.key === "ArrowLeft") changeSlide("left");
      if (e.key === "ArrowRight") changeSlide("right");
      if (e.key === "Escape") setFullScreen(false);
    };

    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullScreen, changeSlide]);

  return (
    <div className="propertySlider">
      <div className="sliderStage">
        <img
          src={currentImage}
          alt={t("slider.alt.mainProperty")}
          onClick={() => setFullScreen(true)}
          onError={(e) => {
            e.currentTarget.src = "/no-image.png";
          }}
        />

        <span className="sliderCount">
          {currentIndex + 1} / {safeImages.length}
        </span>

        {hasMultipleImages && (
          <>
            <button
              type="button"
              className="sliderArrow isPrev"
              onClick={() => changeSlide("left")}
              aria-label="Previous photo"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              type="button"
              className="sliderArrow isNext"
              onClick={() => changeSlide("right")}
              aria-label="Next photo"
            >
              <ArrowIcon direction="right" />
            </button>
          </>
        )}
      </div>

      {hasMultipleImages && (
        <div className="sliderThumbs" ref={thumbnailRailRef}>
          {safeImages.map((image, index) => (
            <button
              type="button"
              key={`${image}-${index}`}
              className={index === currentIndex ? "thumbnail active" : "thumbnail"}
              onClick={() => goTo(index)}
            >
              <img
                src={image}
                alt={t("slider.alt.propertyNumber", { number: index + 1 })}
                onError={(e) => {
                  e.currentTarget.src = "/no-image.png";
                }}
              />
            </button>
          ))}
        </div>
      )}

      {fullScreen && (
        <div className="sliderLightbox" onClick={() => setFullScreen(false)}>
          <button
            type="button"
            className="lightboxClose"
            onClick={() => setFullScreen(false)}
          >
            ✕
          </button>

          {hasMultipleImages && (
            <button
              type="button"
              className="sliderArrow isPrev"
              onClick={(e) => {
                e.stopPropagation();
                changeSlide("left");
              }}
            >
              <ArrowIcon direction="left" />
            </button>
          )}

          <img
            src={currentImage}
            alt={t("slider.alt.propertyPreview")}
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              e.currentTarget.src = "/no-image.png";
            }}
          />

          {hasMultipleImages && (
            <button
              type="button"
              className="sliderArrow isNext"
              onClick={(e) => {
                e.stopPropagation();
                changeSlide("right");
              }}
            >
              <ArrowIcon direction="right" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Slider;
