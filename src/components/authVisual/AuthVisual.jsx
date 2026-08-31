import "./authVisual.scss";

const icons = {
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.2 16.2 21 21" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v6A3.5 3.5 0 0 1 15.5 16H11l-4.2 3.2c-.7.5-1.8 0-1.8-.8V6.5Z" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 19s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 7a3.9 3.9 0 0 1 7 2.9C19 14.6 12 19 12 19Z" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3.5 5 6.5v5.2c0 4.2 2.8 7.8 7 9.3 4.2-1.5 7-5.1 7-9.3V6.5L12 3.5Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="8.5" cy="12" r="3.5" />
      <path d="M12 12h8v2.2h-2V16h-2.2v-1.8H14" />
    </svg>
  ),
};

function AuthVisual({
  title,
  description,
  journey = [],
  showcase = [],
  chips = [],
  noteTitle,
  noteText,
}) {
  return (
    <aside className="authVisual">
      <div className="authVisualScene" aria-hidden="true">
        <div className="authVisualGrid" />
        <div className="authVisualGlow authVisualGlowA" />
        <div className="authVisualGlow authVisualGlowB" />
        <div className="authCompass" />

        <svg
          className="authSkyline"
          viewBox="0 0 480 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g className="authFloorplan">
            <circle cx="240" cy="210" r="118" />
            <circle cx="240" cy="210" r="78" />
            <path d="M240 92v236M122 210h236" />
          </g>

          <g className="authBuildings">
            <path d="M48 248V164h36v84" />
            <path d="M92 248V118h44v130" />
            <path d="M144 248V148h28v100" />
            <path className="authHeroBuilding" d="M184 248V72h72v176" />
            <path d="M184 72l36-28 36 28" />
            <path d="M264 248V108h52v140" />
            <path d="M324 248V156h38v92" />
            <path d="M370 248V128h46v120" />
            <path d="M424 248V176h28v72" />
          </g>

          <g className="authWindows">
            <rect x="58" y="176" width="7" height="10" rx="1" />
            <rect x="72" y="176" width="7" height="10" rx="1" />
            <rect x="58" y="196" width="7" height="10" rx="1" />
            <rect x="72" y="196" width="7" height="10" rx="1" />
            <rect x="104" y="136" width="8" height="12" rx="1" />
            <rect x="118" y="136" width="8" height="12" rx="1" />
            <rect x="104" y="160" width="8" height="12" rx="1" />
            <rect x="118" y="160" width="8" height="12" rx="1" />
            <rect className="authWindowLit" x="202" y="96" width="10" height="14" rx="1" />
            <rect x="220" y="96" width="10" height="14" rx="1" />
            <rect x="238" y="96" width="10" height="14" rx="1" />
            <rect className="authWindowLit" x="220" y="122" width="10" height="14" rx="1" />
            <rect x="202" y="148" width="10" height="14" rx="1" />
            <rect className="authWindowLit" x="238" y="148" width="10" height="14" rx="1" />
            <rect className="authWindowLit" x="220" y="174" width="10" height="14" rx="1" />
            <rect className="authWindowLit" x="278" y="152" width="8" height="12" rx="1" />
            <rect x="294" y="176" width="8" height="12" rx="1" />
            <rect className="authWindowLit" x="382" y="168" width="8" height="11" rx="1" />
            <rect x="396" y="188" width="8" height="11" rx="1" />
          </g>

          <path className="authGround" d="M28 248h424" />
        </svg>
      </div>

      <div className="authVisualBody">
        <div className="authVisualBrand">
          <div className="authBrandIcon">
            <span className="roof" />
            <span className="tower" />
            <span className="door" />
          </div>
          <span>ShoufBayt</span>
        </div>

        <h2>{title}</h2>
        <p>{description}</p>

        {journey.length > 0 && (
          <ol className="authJourney">
            {journey.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        )}

        {showcase.length > 0 && (
          <div className="authShowcase">
            {showcase.map((item) => (
              <article key={item.title} className="authShowcaseCard">
                <div className="authShowcaseIcon" aria-hidden="true">
                  {icons[item.icon] || icons.home}
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        )}

        {chips.length > 0 && (
          <div className="authChips">
            {chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        )}

        {(noteTitle || noteText) && (
          <div className="authVisualNote">
            {noteTitle ? <strong>{noteTitle}</strong> : null}
            {noteText ? <p>{noteText}</p> : null}
          </div>
        )}
      </div>
    </aside>
  );
}

export default AuthVisual;
