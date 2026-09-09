import "./houseMark.scss";

function HouseMark({ className = "", size = "nav" }) {
  return (
    <div
      className={`houseMark houseMark--${size}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="houseMarkSvg">
        <path
          className="houseMarkShape"
          fill="currentColor"
          fillRule="evenodd"
          d="M24 6 42 21v3H36v18H12V24H6v-3L24 6ZM21 42V31h6v11H21Z"
        />
      </svg>
    </div>
  );
}

export default HouseMark;
