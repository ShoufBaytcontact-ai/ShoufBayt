import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../statusBadge/statusBadge";
import apiRequest from "../../lib/apiRequest";
import "./profilePostCard.scss";

function ProfilePostCard({ item, showActions, onDelete, onStatusUpdated }) {
  const post = item?.post || item || {};
  const postId = post.id || item?.postId;

  const [currentStatus, setCurrentStatus] = useState(
    post.status || "available"
  );

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    setCurrentStatus(post.status || "available");
  }, [post.status]);

  if (!item || !postId) {
    return null;
  }

  const image = post.images?.[0] || "/noimage.jpg";
  const title = post.title || "Untitled Property";
  const address = post.address || "No address";
  const price = post.price || 0;
  const bedroom = post.bedroom || 0;
  const bathroom = post.bathroom || 0;

  const statusOptions =
    post.type === "rent"
      ? [
          { value: "available", label: "Available" },
          { value: "rented", label: "Rented" },
        ]
      : [
          { value: "available", label: "Available" },
          { value: "sold", label: "Sold" },
        ];

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    const oldStatus = currentStatus;

    try {
      setIsUpdatingStatus(true);
      setCurrentStatus(newStatus);

      const res = await apiRequest.patch(`/posts/${postId}/status`, {
        status: newStatus,
      });

      onStatusUpdated?.(postId, res.data.status);
    } catch (err) {
      console.log(err);
      setCurrentStatus(oldStatus);
      alert(err.response?.data?.message || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="profilePostCard">
      <Link to={`/properties/${postId}`} className="profilePostImage">
        <img src={image} alt={title} />
      </Link>

      <div className="profilePostInfo">
        <div className="profilePostTop">
          <div>
            <div className="profilePostTitleRow">
              <h2>
                <Link to={`/properties/${postId}`}>{title}</Link>
              </h2>

              <StatusBadge status={currentStatus} />
            </div>

            <p className="profilePostAddress">
              <img src="/pin.png" alt="Location" />
              <span>{address}</span>
            </p>
          </div>

          <p className="profilePostPrice">$ {price}</p>
        </div>

        {showActions && (
          <div className="statusControlBox">
            <label>Property Status</label>

            <select
              value={currentStatus}
              onChange={handleStatusChange}
              disabled={isUpdatingStatus}
              className={`statusSelect ${currentStatus}`}
            >
              {statusOptions.map((status) => (
                <option value={status.value} key={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            {isUpdatingStatus && <span>Updating...</span>}
          </div>
        )}

        <div className="profilePostFeatures">
          <div>
            <img src="/bed.png" alt="Bedroom" />
            <span>{bedroom} bedroom</span>
          </div>

          <div>
            <img src="/bath.png" alt="Bathroom" />
            <span>{bathroom} bathroom</span>
          </div>
        </div>

        <div className="profilePostActions">
          <Link to={`/properties/${postId}`} className="viewBtn">
            View Details
          </Link>

          {showActions && (
            <>
              <Link to={`/posts/edit/${postId}`} className="editPostBtn">
                Edit Property
              </Link>

              <button onClick={onDelete} className="deletePostBtn">
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePostCard;