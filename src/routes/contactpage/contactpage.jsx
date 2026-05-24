import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./contact.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import ContactStatusBox from "../../components/contactBoxStatus/contactBoxStatus";

const getInitialFormData = (user) => ({
  name: user?.username || "",
  email: user?.email || "",
  subject: "",
  message: "",
  type: "MESSAGE",
});

function ContactPage() {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState(getInitialFormData(currentUser));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [refreshMessages, setRefreshMessages] = useState(0);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      name: currentUser?.username || "",
      email: currentUser?.email || "",
    }));
  }, [currentUser]);

  const clearMessages = () => {
    setSuccess("");
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearMessages();
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      return "Full name is required.";
    }

    if (!formData.email.trim()) {
      return "Email address is required.";
    }

    if (!formData.subject.trim()) {
      return "Subject is required.";
    }

    if (!formData.message.trim()) {
      return "Message is required.";
    }

    if (!["MESSAGE", "REPORT"].includes(formData.type)) {
      return "Invalid message type.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      navigate("/login");
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      clearMessages();

      await apiRequest.post("/contact", {
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        type: formData.type,
      });

      setSuccess(
        formData.type === "REPORT"
          ? "Your report has been sent successfully. You can track its status below."
          : "Your message has been sent successfully. You can track the admin reply below."
      );

      setFormData(getInitialFormData(currentUser));
      setRefreshMessages((prev) => prev + 1);
    } catch (err) {
      console.log("SEND CONTACT MESSAGE ERROR:", err);
      setError(err.response?.data?.message || "Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contactPage pageFade">
      <div className="contactHeader">
        <span>SmartEstate Support</span>

        <h1>Contact Us</h1>

        <p>
          Have a question, need help, or want to report a problem? Contact the
          SmartEstate team and track the status of your message from one place.
        </p>

        {!currentUser && (
          <div className="loginNotice">
            You can view this page, but you must{" "}
            <Link to="/login">sign in</Link> before sending or tracking
            messages.
          </div>
        )}
      </div>

      <div className="contactContainer">
        <div className="contactInfo">
          <span className="sectionBadge">Get in Touch</span>

          <h2>We Are Ready to Help</h2>

          <p>
            SmartEstate makes it easy to connect with support. Send a message,
            report a problem, and review admin responses directly from this
            page.
          </p>

          <div className="infoBox">
            <h3>Email</h3>
            <span>support@smartestate.com</span>
          </div>

          <div className="infoBox">
            <h3>Phone</h3>
            <span>+961 70 123 456</span>
          </div>

          <div className="infoBox">
            <h3>Location</h3>
            <span>Beirut, Lebanon</span>
          </div>

          <div className="infoBox">
            <h3>Working Hours</h3>
            <span>Monday - Friday, 9:00 AM - 6:00 PM</span>
          </div>
        </div>

        <div className="contactForm">
          <span className="sectionBadge">Send Request</span>

          <h2>Send a Message</h2>

          <form onSubmit={handleSubmit}>
            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="name">Full Name</label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={!currentUser || loading}
                />
              </div>

              <div className="formGroup">
                <label htmlFor="email">Email Address</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={!currentUser || loading}
                />
              </div>
            </div>

            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="type">Request Type</label>

                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  disabled={!currentUser || loading}
                >
                  <option value="MESSAGE">General Message</option>
                  <option value="REPORT">Report a Problem</option>
                </select>
              </div>

              <div className="formGroup">
                <label htmlFor="subject">Subject</label>

                <input
                  id="subject"
                  name="subject"
                  type="text"
                  placeholder="Enter subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  disabled={!currentUser || loading}
                />
              </div>
            </div>

            <div className="formGroup full">
              <label htmlFor="message">Message</label>

              <textarea
                id="message"
                name="message"
                placeholder={
                  currentUser
                    ? "Write your message..."
                    : "Please sign in to send a message"
                }
                value={formData.message}
                onChange={handleChange}
                required
                disabled={!currentUser || loading}
              ></textarea>
            </div>

            {success && <span className="successMessage">{success}</span>}
            {error && <span className="errorMessage">{error}</span>}

            <button type="submit" disabled={loading}>
              {!currentUser
                ? "Sign in to Send"
                : loading
                ? "Sending..."
                : formData.type === "REPORT"
                ? "Send Report"
                : "Send Message"}
            </button>
          </form>
        </div>
      </div>

      {currentUser ? (
        <ContactStatusBox refreshKey={refreshMessages} />
      ) : (
        <div className="contactLoginBox">
          <h2>Track Your Messages</h2>
          <p>
            Sign in to review your sent messages, reports, admin replies, and
            request status.
          </p>

          <Link to="/login">Login to Track Messages</Link>
        </div>
      )}
    </div>
  );
}

export default ContactPage;