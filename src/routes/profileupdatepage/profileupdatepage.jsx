import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./profileupdatepage.scss";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";

function ProfileUpdatePage() {
  const { currentUser, updateUser } = useContext(AuthContext);

  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState("/noavatar.jpg");
  const [previewUrl, setPreviewUrl] = useState("");

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const passwordChecks = useMemo(() => {
    return {
      hasPassword: form.password.trim().length > 0,
      length: form.password.trim().length >= 6,
    };
  }, [form.password]);

  useEffect(() => {
    if (currentUser) {
      setForm({
        username: currentUser.username || "",
        email: currentUser.email || "",
        password: "",
      });

      setPreview(currentUser.avatar || "/noavatar.jpg");
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleImageChange = (e) => {
    const selectedImage = e.target.files[0];

    if (!selectedImage) {
      return;
    }

    if (!selectedImage.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      e.target.value = "";
      return;
    }

    if (selectedImage.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      e.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const newPreviewUrl = URL.createObjectURL(selectedImage);

    setError("");
    setSuccess("");
    setAvatar(selectedImage);
    setPreview(newPreviewUrl);
    setPreviewUrl(newPreviewUrl);

    e.target.value = "";
  };

  const handleResetImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setAvatar(null);
    setPreviewUrl("");
    setPreview(currentUser?.avatar || "/noavatar.jpg");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.username.trim()) {
      setError("Username is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }

    if (passwordChecks.hasPassword && !passwordChecks.length) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const formData = new FormData();

    formData.append("username", form.username.trim());
    formData.append("email", form.email.trim().toLowerCase());

    if (form.password.trim()) {
      formData.append("password", form.password.trim());
    }

    if (avatar) {
      formData.append("avatar", avatar);
    }

    try {
      const res = await apiRequest.put(`/users/${currentUser.id}`, formData);

      updateUser(res.data);
      setSuccess("Profile updated successfully.");

      setTimeout(() => {
        navigate("/profile");
      }, 900);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="profileUpdateLoading">
        <div className="loadingCard">
          <span></span>
          <p>Loading user profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profileUpdatePage">
      <div className="profileUpdateWrapper">
        <div className="profileUpdateHeader">
          <div>
            <span className="smallTitle">Account Settings</span>
            <h1>Update Profile</h1>
            <p>
              Manage your SmartEstate account information, password, and profile
              image from one professional dashboard.
            </p>
          </div>

          <Link to="/profile" className="backBtn">
            Back to Profile
          </Link>
        </div>

        <div className="profileUpdateContent">
          <form className="profileUpdateForm" onSubmit={handleSubmit}>
            <div className="formTop">
              <span>Profile Details</span>
              <h2>Personal Information</h2>
              <p>Update your public information and account login details.</p>
            </div>

            <div className="inputGrid">
              <div className="inputGroup">
                <label>Username</label>
                <input
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                />
              </div>

              <div className="inputGroup">
                <label>Email Address</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="inputGroup">
              <label>New Password</label>

              <div className="passwordBox">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Leave empty to keep old password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <small>
                Only write a password if you want to change it. Minimum 6
                characters.
              </small>

              {passwordChecks.hasPassword && (
                <div
                  className={
                    passwordChecks.length
                      ? "passwordHint valid"
                      : "passwordHint invalid"
                  }
                >
                  {passwordChecks.length ? "✓" : "•"} Password has at least 6
                  characters
                </div>
              )}
            </div>

            {error && <div className="message errorMessage">{error}</div>}
            {success && <div className="message successMessage">{success}</div>}

            <div className="formActions">
              <button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Profile"}
              </button>

              <Link to="/profile" className="cancelBtn">
                Cancel
              </Link>
            </div>
          </form>

          <div className="profileAvatarCard">
            <div className="avatarCardHeader">
              <span>Profile Image</span>
              <h2>Account Picture</h2>
              <p>
                Upload a clear image that will appear on your profile,
                properties, and messages.
              </p>
            </div>

            <div className="avatarPreviewBox">
              <img src={preview} alt="Profile" />
            </div>

            <div className="avatarActions">
              <label htmlFor="avatar" className="uploadBtn">
                Choose Image
              </label>

              {avatar && (
                <button
                  type="button"
                  className="resetImageBtn"
                  onClick={handleResetImage}
                >
                  Reset
                </button>
              )}
            </div>

            <input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />

            <div className="avatarInfo">
              <span>Accepted: JPG, PNG, WEBP</span>
              <span>Maximum size: 5MB</span>
            </div>

            <div className="accountBox">
              <h3>Current Account</h3>

              <div>
                <span>Username</span>
                <strong>{currentUser.username || "User"}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{currentUser.email || "No email"}</strong>
              </div>

              <div>
                <span>Role</span>
                <strong>{currentUser.role || "USER"}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileUpdatePage;