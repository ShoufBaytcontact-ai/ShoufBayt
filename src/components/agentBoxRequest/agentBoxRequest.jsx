import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./agentBoxRequest.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";

const countryCodes = [
  { iso: "AF", code: "+93" },
  { iso: "AL", code: "+355" },
  { iso: "DZ", code: "+213" },
  { iso: "AS", code: "+1-684" },
  { iso: "AD", code: "+376" },
  { iso: "AO", code: "+244" },
  { iso: "AI", code: "+1-264" },
  { iso: "AG", code: "+1-268" },
  { iso: "AR", code: "+54" },
  { iso: "AM", code: "+374" },
  { iso: "AW", code: "+297" },
  { iso: "AU", code: "+61" },
  { iso: "AT", code: "+43" },
  { iso: "AZ", code: "+994" },
  { iso: "BS", code: "+1-242" },
  { iso: "BH", code: "+973" },
  { iso: "BD", code: "+880" },
  { iso: "BB", code: "+1-246" },
  { iso: "BY", code: "+375" },
  { iso: "BE", code: "+32" },
  { iso: "BZ", code: "+501" },
  { iso: "BJ", code: "+229" },
  { iso: "BM", code: "+1-441" },
  { iso: "BT", code: "+975" },
  { iso: "BO", code: "+591" },
  { iso: "BA", code: "+387" },
  { iso: "BW", code: "+267" },
  { iso: "BR", code: "+55" },
  { iso: "IO", code: "+246" },
  { iso: "VG", code: "+1-284" },
  { iso: "BN", code: "+673" },
  { iso: "BG", code: "+359" },
  { iso: "BF", code: "+226" },
  { iso: "BI", code: "+257" },
  { iso: "KH", code: "+855" },
  { iso: "CM", code: "+237" },
  { iso: "CA", code: "+1" },
  { iso: "CV", code: "+238" },
  { iso: "KY", code: "+1-345" },
  { iso: "CF", code: "+236" },
  { iso: "TD", code: "+235" },
  { iso: "CL", code: "+56" },
  { iso: "CN", code: "+86" },
  { iso: "CO", code: "+57" },
  { iso: "KM", code: "+269" },
  { iso: "CG", code: "+242" },
  { iso: "CD", code: "+243" },
  { iso: "CK", code: "+682" },
  { iso: "CR", code: "+506" },
  { iso: "CI", code: "+225" },
  { iso: "HR", code: "+385" },
  { iso: "CU", code: "+53" },
  { iso: "CW", code: "+599" },
  { iso: "CY", code: "+357" },
  { iso: "CZ", code: "+420" },
  { iso: "DK", code: "+45" },
  { iso: "DJ", code: "+253" },
  { iso: "DM", code: "+1-767" },
  { iso: "DO", code: "+1-809" },
  { iso: "EC", code: "+593" },
  { iso: "EG", code: "+20" },
  { iso: "SV", code: "+503" },
  { iso: "GQ", code: "+240" },
  { iso: "ER", code: "+291" },
  { iso: "EE", code: "+372" },
  { iso: "SZ", code: "+268" },
  { iso: "ET", code: "+251" },
  { iso: "FK", code: "+500" },
  { iso: "FO", code: "+298" },
  { iso: "FJ", code: "+679" },
  { iso: "FI", code: "+358" },
  { iso: "FR", code: "+33" },
  { iso: "GF", code: "+594" },
  { iso: "PF", code: "+689" },
  { iso: "GA", code: "+241" },
  { iso: "GM", code: "+220" },
  { iso: "GE", code: "+995" },
  { iso: "DE", code: "+49" },
  { iso: "GH", code: "+233" },
  { iso: "GI", code: "+350" },
  { iso: "GR", code: "+30" },
  { iso: "GL", code: "+299" },
  { iso: "GD", code: "+1-473" },
  { iso: "GP", code: "+590" },
  { iso: "GU", code: "+1-671" },
  { iso: "GT", code: "+502" },
  { iso: "GG", code: "+44" },
  { iso: "GN", code: "+224" },
  { iso: "GW", code: "+245" },
  { iso: "GY", code: "+592" },
  { iso: "HT", code: "+509" },
  { iso: "HN", code: "+504" },
  { iso: "HK", code: "+852" },
  { iso: "HU", code: "+36" },
  { iso: "IS", code: "+354" },
  { iso: "IN", code: "+91" },
  { iso: "ID", code: "+62" },
  { iso: "IR", code: "+98" },
  { iso: "IQ", code: "+964" },
  { iso: "IE", code: "+353" },
  { iso: "IM", code: "+44" },
  { iso: "IL", code: "+972" },
  { iso: "IT", code: "+39" },
  { iso: "JM", code: "+1-876" },
  { iso: "JP", code: "+81" },
  { iso: "JE", code: "+44" },
  { iso: "JO", code: "+962" },
  { iso: "KZ", code: "+7" },
  { iso: "KE", code: "+254" },
  { iso: "KI", code: "+686" },
  { iso: "XK", code: "+383" },
  { iso: "KW", code: "+965" },
  { iso: "KG", code: "+996" },
  { iso: "LA", code: "+856" },
  { iso: "LV", code: "+371" },
  { iso: "LB", code: "+961" },
  { iso: "LS", code: "+266" },
  { iso: "LR", code: "+231" },
  { iso: "LY", code: "+218" },
  { iso: "LI", code: "+423" },
  { iso: "LT", code: "+370" },
  { iso: "LU", code: "+352" },
  { iso: "MO", code: "+853" },
  { iso: "MG", code: "+261" },
  { iso: "MW", code: "+265" },
  { iso: "MY", code: "+60" },
  { iso: "MV", code: "+960" },
  { iso: "ML", code: "+223" },
  { iso: "MT", code: "+356" },
  { iso: "MH", code: "+692" },
  { iso: "MQ", code: "+596" },
  { iso: "MR", code: "+222" },
  { iso: "MU", code: "+230" },
  { iso: "YT", code: "+262" },
  { iso: "MX", code: "+52" },
  { iso: "FM", code: "+691" },
  { iso: "MD", code: "+373" },
  { iso: "MC", code: "+377" },
  { iso: "MN", code: "+976" },
  { iso: "ME", code: "+382" },
  { iso: "MS", code: "+1-664" },
  { iso: "MA", code: "+212" },
  { iso: "MZ", code: "+258" },
  { iso: "MM", code: "+95" },
  { iso: "NA", code: "+264" },
  { iso: "NR", code: "+674" },
  { iso: "NP", code: "+977" },
  { iso: "NL", code: "+31" },
  { iso: "NC", code: "+687" },
  { iso: "NZ", code: "+64" },
  { iso: "NI", code: "+505" },
  { iso: "NE", code: "+227" },
  { iso: "NG", code: "+234" },
  { iso: "NU", code: "+683" },
  { iso: "NF", code: "+672" },
  { iso: "KP", code: "+850" },
  { iso: "MK", code: "+389" },
  { iso: "MP", code: "+1-670" },
  { iso: "NO", code: "+47" },
  { iso: "OM", code: "+968" },
  { iso: "PK", code: "+92" },
  { iso: "PW", code: "+680" },
  { iso: "PS", code: "+970" },
  { iso: "PA", code: "+507" },
  { iso: "PG", code: "+675" },
  { iso: "PY", code: "+595" },
  { iso: "PE", code: "+51" },
  { iso: "PH", code: "+63" },
  { iso: "PL", code: "+48" },
  { iso: "PT", code: "+351" },
  { iso: "PR", code: "+1-787" },
  { iso: "QA", code: "+974" },
  { iso: "RE", code: "+262" },
  { iso: "RO", code: "+40" },
  { iso: "RU", code: "+7" },
  { iso: "RW", code: "+250" },
  { iso: "BL", code: "+590" },
  { iso: "SH", code: "+290" },
  { iso: "KN", code: "+1-869" },
  { iso: "LC", code: "+1-758" },
  { iso: "MF", code: "+590" },
  { iso: "PM", code: "+508" },
  { iso: "VC", code: "+1-784" },
  { iso: "WS", code: "+685" },
  { iso: "SM", code: "+378" },
  { iso: "ST", code: "+239" },
  { iso: "SA", code: "+966" },
  { iso: "SN", code: "+221" },
  { iso: "RS", code: "+381" },
  { iso: "SC", code: "+248" },
  { iso: "SL", code: "+232" },
  { iso: "SG", code: "+65" },
  { iso: "SX", code: "+1-721" },
  { iso: "SK", code: "+421" },
  { iso: "SI", code: "+386" },
  { iso: "SB", code: "+677" },
  { iso: "SO", code: "+252" },
  { iso: "ZA", code: "+27" },
  { iso: "KR", code: "+82" },
  { iso: "SS", code: "+211" },
  { iso: "ES", code: "+34" },
  { iso: "LK", code: "+94" },
  { iso: "SD", code: "+249" },
  { iso: "SR", code: "+597" },
  { iso: "SJ", code: "+47" },
  { iso: "SE", code: "+46" },
  { iso: "CH", code: "+41" },
  { iso: "SY", code: "+963" },
  { iso: "TW", code: "+886" },
  { iso: "TJ", code: "+992" },
  { iso: "TZ", code: "+255" },
  { iso: "TH", code: "+66" },
  { iso: "TL", code: "+670" },
  { iso: "TG", code: "+228" },
  { iso: "TK", code: "+690" },
  { iso: "TO", code: "+676" },
  { iso: "TT", code: "+1-868" },
  { iso: "TN", code: "+216" },
  { iso: "TR", code: "+90" },
  { iso: "TM", code: "+993" },
  { iso: "TC", code: "+1-649" },
  { iso: "TV", code: "+688" },
  { iso: "UG", code: "+256" },
  { iso: "UA", code: "+380" },
  { iso: "AE", code: "+971" },
  { iso: "GB", code: "+44" },
  { iso: "US", code: "+1" },
  { iso: "UY", code: "+598" },
  { iso: "UZ", code: "+998" },
  { iso: "VU", code: "+678" },
  { iso: "VA", code: "+379" },
  { iso: "VE", code: "+58" },
  { iso: "VN", code: "+84" },
  { iso: "VI", code: "+1-340" },
  { iso: "WF", code: "+681" },
  { iso: "EH", code: "+212" },
  { iso: "YE", code: "+967" },
  { iso: "ZM", code: "+260" },
  { iso: "ZW", code: "+263" },
];

const initialForm = {
  name: "",
  title: "Real Estate Agent",
  countryIso: "LB",
  countryCode: "+961",
  phone: "",
  location: "",
  bio: "",
};

function AgentRequestBox() {
  const { currentUser, updateUser } = useContext(AuthContext);

  const countryRef = useRef(null);

  const [freshUser, setFreshUser] = useState(currentUser);
  const [form, setForm] = useState(initialForm);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const userRole = freshUser?.role || currentUser?.role;
  const requestStatus = freshUser?.agentRequestStatus || "NONE";

  const isAgent = userRole === "AGENT";
  const isPending = requestStatus === "PENDING";
  const isRejected = requestStatus === "REJECTED";

  const selectedCountry =
    countryCodes.find((item) => item.iso === form.countryIso) ||
    countryCodes.find((item) => item.code === form.countryCode) ||
    countryCodes[0];

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (countryRef.current && !countryRef.current.contains(e.target)) {
        setCountryDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchFreshUser = async () => {
    if (!currentUser?.id) {
      return;
    }

    try {
      setChecking(true);

      const res = await apiRequest.get(`/users/${currentUser.id}`);
      const updatedUser = res.data?.user || res.data;

      setFreshUser(updatedUser);

      updateUser({
        ...currentUser,
        ...updatedUser,
      });

      setForm((prev) => ({
        ...prev,
        name: updatedUser?.username || currentUser?.username || "",
      }));

      setImagePreview(updatedUser?.avatar || currentUser?.avatar || "");
    } catch (err) {
      console.log("FETCH USER STATUS ERROR:", err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchFreshUser();
  }, [currentUser?.id]);

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearMessages();
  };

  const handleSelectCountry = (country) => {
    setForm((prev) => ({
      ...prev,
      countryIso: country.iso,
      countryCode: country.code,
    }));

    setCountryDropdownOpen(false);
    clearMessages();
  };

  const handlePhoneChange = (e) => {
    const cleanPhone = e.target.value.replace(/[^\d\s]/g, "");

    setForm((prev) => ({
      ...prev,
      phone: cleanPhone,
    }));

    clearMessages();
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      e.target.value = "";
      return;
    }

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);

    setImageFile(file);
    setImagePreview(previewUrl);
    clearMessages();

    e.target.value = "";
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview(freshUser?.avatar || currentUser?.avatar || "");
    clearMessages();
  };

  const validateForm = () => {
    const phoneRegex = /^[0-9\s]{6,15}$/;

    if (!form.name.trim()) {
      return "Full name is required.";
    }

    if (!form.title.trim()) {
      return "Agent title is required.";
    }

    if (!form.phone.trim()) {
      return "Phone number is required.";
    }

    if (!phoneRegex.test(form.phone.trim())) {
      return "Phone number can only contain numbers and spaces.";
    }

    if (!form.location.trim()) {
      return "Location is required.";
    }

    if (!form.bio.trim()) {
      return "Bio is required.";
    }

    if (form.bio.trim().length < 20) {
      return "Bio must be at least 20 characters.";
    }

    return "";
  };

  const openRequestForm = () => {
    setShowForm(true);
    clearMessages();
  };

  const closeRequestForm = () => {
    if (requesting) {
      return;
    }

    setShowForm(false);
    setError("");
    setCountryDropdownOpen(false);
  };

  const handleRequestAgent = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setRequesting(true);
      clearMessages();

      const data = new FormData();

      data.append("name", form.name.trim());
      data.append("title", form.title.trim());
      data.append("phone", `${form.countryCode} ${form.phone.trim()}`);
      data.append("location", form.location.trim());
      data.append("bio", form.bio.trim());

      if (imageFile) {
        data.append("image", imageFile);
      }

      await apiRequest.post("/agents/request", data);

      setMessage("Your agent request has been sent to the admin.");
      setShowForm(false);

      await fetchFreshUser();
    } catch (err) {
      console.log("AGENT REQUEST ERROR:", err);
      setError(err.response?.data?.message || "Failed to send agent request.");
    } finally {
      setRequesting(false);
    }
  };

  const getFlagUrl = (iso) => {
    return `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
  };

  if (!currentUser) {
    return (
      <div className="agentRequestBox">
        <div>
          <span>Become an Agent</span>
          <h2>Join SmartEstate Agents</h2>
          <p>Login to request becoming a verified SmartEstate agent.</p>
        </div>

        <Link to="/login">Login First</Link>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="agentRequestBox">
        <div>
          <span>Checking Status</span>
          <h2>Loading your agent status...</h2>
          <p>Please wait while we check your latest account status.</p>
        </div>
      </div>
    );
  }

  if (isAgent) {
    return (
      <div className="agentRequestBox verifiedBox">
        <div>
          <span>Verified Agent</span>
          <h2>You are a verified SmartEstate agent</h2>
          <p>Your account is approved and visible on the agents page.</p>
        </div>

        <Link to="/profile">Go to Profile</Link>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="agentRequestBox pendingBox">
        <div>
          <span>Request Pending</span>
          <h2>Your agent request is under review</h2>
          <p>The admin will review your request and approve or reject it.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={isRejected ? "agentRequestBox rejectedBox" : "agentRequestBox"}
      >
        <div>
          <span>{isRejected ? "Request Rejected" : "Become an Agent"}</span>

          <h2>
            {isRejected
              ? "Your previous request was rejected"
              : "Want to become a SmartEstate agent?"}
          </h2>

          <p>
            {isRejected
              ? "You can submit a new request with updated information for admin review."
              : "Fill your agent information and send a request to become a verified SmartEstate real estate agent."}
          </p>

          {message && <small>{message}</small>}
          {error && <small className="requestError">{error}</small>}
        </div>

        <button type="button" onClick={openRequestForm}>
          {isRejected ? "Request Again" : "Become an Agent"}
        </button>
      </div>

      {showForm && (
        <div className="agentRequestModal">
          <div className="agentRequestPanel">
            <div className="modalHeader">
              <div>
                <span>Agent Application</span>

                <h2>Complete Your Agent Profile</h2>

                <p>
                  Add your professional information. The admin will review your
                  request before approving your agent account.
                </p>
              </div>

              <button type="button" onClick={closeRequestForm}>
                ×
              </button>
            </div>

            <form onSubmit={handleRequestAgent} className="agentRequestForm">
              <div className="formGrid">
                <div className="inputGroup">
                  <label>Full Name</label>

                  <input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    disabled={requesting}
                  />
                </div>

                <div className="inputGroup">
                  <label>Agent Title</label>

                  <input
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Real Estate Agent"
                    disabled={requesting}
                  />
                </div>

                <div className="inputGroup">
                  <label>Phone Number</label>

                  <div className="phoneInputRow">
                    <div className="countrySelect" ref={countryRef}>
                      <button
                        type="button"
                        className="countrySelectButton"
                        onClick={() =>
                          setCountryDropdownOpen((prev) => !prev)
                        }
                        disabled={requesting}
                      >
                        <img
                          src={getFlagUrl(selectedCountry.iso)}
                          alt={selectedCountry.iso}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />

                        <span>{selectedCountry.code}</span>
                      </button>

                      {countryDropdownOpen && (
                        <div className="countryDropdown">
                          {countryCodes.map((country) => (
                            <button
                              type="button"
                              key={`${country.iso}-${country.code}`}
                              className={
                                form.countryIso === country.iso
                                  ? "countryOption active"
                                  : "countryOption"
                              }
                              onClick={() => handleSelectCountry(country)}
                            >
                              <img
                                src={getFlagUrl(country.iso)}
                                alt={country.iso}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />

                              <span>{country.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      value={form.phone}
                      onChange={handlePhoneChange}
                      placeholder="70 123 456"
                      disabled={requesting}
                    />
                  </div>
                </div>

                <div className="inputGroup">
                  <label>Location</label>

                  <input
                    name="location"
                    type="text"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Beirut, Lebanon"
                    disabled={requesting}
                  />
                </div>

                <div className="inputGroup wide">
                  <label>Agent Profile Image</label>

                  <div className="agentImageUpload">
                    <div className="agentImagePreview">
                      <img
                        src={imagePreview || "/no-avatar.png"}
                        alt="Agent preview"
                        onError={(e) => {
                          e.currentTarget.src = "/no-avatar.png";
                        }}
                      />
                    </div>

                    <div className="agentImageActions">
                      <label htmlFor="agentImage">Upload Image</label>

                      {imageFile && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={requesting}
                        >
                          Remove
                        </button>
                      )}

                      <small>JPG, PNG, WEBP • Max 5MB</small>
                    </div>

                    <input
                      id="agentImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={requesting}
                    />
                  </div>
                </div>

                <div className="inputGroup wide">
                  <label>Professional Bio</label>

                  <textarea
                    name="bio"
                    value={form.bio}
                    onChange={handleChange}
                    placeholder="Write a short professional bio about your real estate experience..."
                    disabled={requesting}
                  ></textarea>
                </div>
              </div>

              {error && <div className="modalError">{error}</div>}

              <div className="modalActions">
                <button
                  type="button"
                  className="cancelBtn"
                  onClick={closeRequestForm}
                  disabled={requesting}
                >
                  Cancel
                </button>

                <button type="submit" disabled={requesting}>
                  {requesting ? "Sending Request..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default AgentRequestBox;