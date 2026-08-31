import "./houseMark.scss";

function HouseMark({ className = "", size = "nav" }) {
  return (
    <div
      className={`houseMark houseMark--${size}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <span className="roof" />
      <span className="tower" />
      <span className="door" />
    </div>
  );
}

export default HouseMark;
