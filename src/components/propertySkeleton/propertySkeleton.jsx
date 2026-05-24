import "./propertySkeleton.scss";

function PropertySkeleton({ count = 3 }) {
  return (
    <div className="propertySkeletonList">
      {Array.from({ length: count }).map((_, index) => (
        <div className="propertySkeleton" key={index}>
          <div className="skeletonImage"></div>

          <div className="skeletonContent">
            <span></span>
            <h3></h3>
            <p></p>

            <div className="skeletonFeatures">
              <small></small>
              <small></small>
              <small></small>
            </div>

            <div className="skeletonActions">
              <button></button>
              <button></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PropertySkeleton;