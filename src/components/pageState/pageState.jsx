import { Link } from "react-router-dom";
import "./pageState.scss";

function PageState({
  type = "loading",
  title,
  message,
  buttonText,
  buttonLink,
  onClick,
}) {
  const isLoading = type === "loading";
  const isError = type === "error";
  const isEmpty = type === "empty";

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
        {isLoading ? <span className="loader"></span> : isError ? "!" : "⌂"}
      </div>

      <h2>
        {title ||
          (isLoading
            ? "Loading..."
            : isError
            ? "Something went wrong"
            : "No data found")}
      </h2>

      <p>
        {message ||
          (isLoading
            ? "Please wait while SmartEstate prepares your data."
            : isError
            ? "We could not complete this request. Please try again."
            : "There is nothing to show right now.")}
      </p>

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