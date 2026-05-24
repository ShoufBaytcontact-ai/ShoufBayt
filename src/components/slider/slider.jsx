import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./slider.scss";

function Slider({ images = [] }) {
  const safeImages = useMemo(() => {
    const list = Array.isArray(images) ? images.filter(Boolean) : [];
    return list.length > 0 ? list : ["/no-image.png"];
  }, [images]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const thumbnailRefs = useRef([]);
  const thumbnailRailRef = useRef(null);

  const hasMultipleImages = safeImages.length > 1;

  const changeSlide = useCallback(
    (direction) => {
      if (!hasMultipleImages) {
        return;
      }

      setCurrentIndex((prev) => {
        if (direction === "left") {
          return prev === 0 ? safeImages.length - 1 : prev - 1;
        }

        return prev === safeImages.length - 1 ? 0 : prev + 1;
      });
    },
    [hasMultipleImages, safeImages.length]
  );

  const openFullScreen = () => {
    setFullScreen(true);
    setIsPaused(true);
  };

  const closeFullScreen = () => {
    setFullScreen(false);
    setIsPaused(false);
  };

  useEffect(() => {
    setCurrentIndex(0);
    thumbnailRefs.current = [];
  }, [safeImages.length]);

  useEffect(() => {
    if (!hasMultipleImages || fullScreen || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      changeSlide("right");
    }, 4000);

    return () => clearInterval(interval);
  }, [hasMultipleImages, fullScreen, isPaused, changeSlide]);

  useEffect(() => {
    const rail = thumbnailRailRef.current;
    const activeThumbnail = thumbnailRefs.current[currentIndex];

    if (!rail || !activeThumbnail) {
      return;
    }

    const railRect = rail.getBoundingClientRect();
    const thumbRect = activeThumbnail.getBoundingClientRect();

    const hasVerticalScroll = rail.scrollHeight > rail.clientHeight;
    const hasHorizontalScroll = rail.scrollWidth > rail.clientWidth;

    if (hasVerticalScroll) {
      const thumbTop = thumbRect.top - railRect.top + rail.scrollTop;
      const targetTop =
        thumbTop - rail.clientHeight / 2 + activeThumbnail.clientHeight / 2;

      rail.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });
    }

    if (hasHorizontalScroll) {
      const thumbLeft = thumbRect.left - railRect.left + rail.scrollLeft;
      const targetLeft =
        thumbLeft - rail.clientWidth / 2 + activeThumbnail.clientWidth / 2;

      rail.scrollTo({
        left: targetLeft,
        behavior: "smooth",
      });
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!fullScreen) {
        return;
      }

      if (e.key === "ArrowLeft") {
        changeSlide("left");
      }

      if (e.key === "ArrowRight") {
        changeSlide("right");
      }

      if (e.key === "Escape") {
        closeFullScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullScreen, changeSlide]);

  return (
    <div
      className="slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        if (!fullScreen) {
          setIsPaused(false);
        }
      }}
    >
      {fullScreen && (
        <div className="fullSlider">
          <button
            type="button"
            className="closeFullSlider"
            onClick={closeFullScreen}
          >
            ✕
          </button>

          {hasMultipleImages && (
            <button
              type="button"
              className="fullArrow leftArrow"
              onClick={() => changeSlide("left")}
            >
              ‹
            </button>
          )}

          <div className="fullImageBox">
            <img
              src={safeImages[currentIndex]}
              alt="Property preview"
              onError={(e) => {
                e.currentTarget.src = "/no-image.png";
              }}
            />
          </div>

          {hasMultipleImages && (
            <button
              type="button"
              className="fullArrow rightArrow"
              onClick={() => changeSlide("right")}
            >
              ›
            </button>
          )}

          <div className="fullCounter">
            {currentIndex + 1} / {safeImages.length}
          </div>
        </div>
      )}

      <div className="sliderLayout">
        <div className="mainImagePanel">
          <img
            src={safeImages[currentIndex]}
            alt="Main property"
            onClick={openFullScreen}
            onError={(e) => {
              e.currentTarget.src = "/no-image.png";
            }}
          />

          <div className="galleryBadge">
            {hasMultipleImages
              ? isPaused
                ? "Gallery Paused"
                : "Auto Gallery"
              : "Property Gallery"}
          </div>

          <div className="galleryCounter">
            {currentIndex + 1} / {safeImages.length}
          </div>

          {hasMultipleImages && (
            <div className="mainControls">
              <button type="button" onClick={() => changeSlide("left")}>
                ‹
              </button>

              <button type="button" onClick={() => changeSlide("right")}>
                ›
              </button>
            </div>
          )}
        </div>

        {hasMultipleImages && (
          <div className="thumbnailRail" ref={thumbnailRailRef}>
            {safeImages.map((image, index) => (
              <button
                type="button"
                ref={(el) => {
                  thumbnailRefs.current[index] = el;
                }}
                className={
                  currentIndex === index ? "thumbnail active" : "thumbnail"
                }
                key={`${image}-${index}`}
                onClick={() => setCurrentIndex(index)}
              >
                <img
                  src={image}
                  alt={`Property ${index + 1}`}
                  onError={(e) => {
                    e.currentTarget.src = "/no-image.png";
                  }}
                />

                <span>{index + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Slider;