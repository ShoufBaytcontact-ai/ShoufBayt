import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./register.scss";
import apiRequest from "../../lib/apiRequest";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordChecks = useMemo(() => {
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    return {
      length: password.length >= 6,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      match: password !== "" && password === confirmPassword,
    };
  }, [form.password, form.confirmPassword]);

  const passwordScore = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length;
  }, [passwordChecks]);

  const strengthText =
    passwordScore <= 2 ? "Weak" : passwordScore <= 4 ? "Medium" : "Strong";

  const strengthClass =
    passwordScore <= 2 ? "weak" : passwordScore <= 4 ? "medium" : "strong";

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const clearError = () => {
    if (error) {
      setError("");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearError();
  };

  const validateForm = () => {
    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();

    if (!username) {
      return "Username is required.";
    }

    if (!email) {
      return "Email address is required.";
    }

    if (!email.includes("@") || !email.includes(".")) {
      return "Please enter a valid email address.";
    }

    if (!form.password || !form.confirmPassword) {
      return "Please fill both password fields.";
    }

    if (!isPasswordValid) {
      return "Please complete all password requirements.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      await apiRequest.post("/auth/register", {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      navigate("/login");
    } catch (err) {
      console.log("REGISTER ERROR:", err);
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register pageFade">
      <div className="registerCard">
        <div className="formContainer">
          <form onSubmit={handleSubmit} className="registerForm">
            <span className="registerBadge">Create Account</span>

            <div className="registerHeader">
              <h1>Join SmartEstate</h1>

              <p>
                Create your account to post properties, save favorites, and
                manage your real estate activity.
              </p>
            </div>

            <div className="formGroup">
              <label htmlFor="username">Username</label>

              <input
                id="username"
                type="text"
                name="username"
                placeholder="Enter your username"
                required
                autoComplete="username"
                value={form.username}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="formGroup">
              <label htmlFor="email">Email Address</label>

              <input
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email"
                required
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="formGroup">
              <label htmlFor="password">Password</label>

              <div className="passwordBox">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Create a password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={isLoading}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isLoading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="formGroup">
              <label htmlFor="confirmPassword">Confirm Password</label>

              <div className="passwordBox">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={isLoading}
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="passwordStrength">
              <div className="strengthTop">
                <span>Password Strength</span>
                <b className={strengthClass}>{strengthText}</b>
              </div>

              <div className="strengthBar">
                <div
                  className={`strengthFill ${strengthClass}`}
                  style={{
                    width: `${(passwordScore / 6) * 100}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="passwordRequirements">
              <p className="requirementsTitle">Password Requirements</p>

              <p className={passwordChecks.length ? "valid" : "invalid"}>
                {passwordChecks.length ? "✓" : "•"} At least 6 characters
              </p>

              <p className={passwordChecks.uppercase ? "valid" : "invalid"}>
                {passwordChecks.uppercase ? "✓" : "•"} At least 1 uppercase
                letter
              </p>

              <p className={passwordChecks.lowercase ? "valid" : "invalid"}>
                {passwordChecks.lowercase ? "✓" : "•"} At least 1 lowercase
                letter
              </p>

              <p className={passwordChecks.number ? "valid" : "invalid"}>
                {passwordChecks.number ? "✓" : "•"} At least 1 number
              </p>

              <p className={passwordChecks.special ? "valid" : "invalid"}>
                {passwordChecks.special ? "✓" : "•"} At least 1 special
                character
              </p>

              <p className={passwordChecks.match ? "valid" : "invalid"}>
                {passwordChecks.match ? "✓" : "•"} Passwords match
              </p>
            </div>

            {error && <span className="registerError">{error}</span>}

            <button
              type="submit"
              className="registerBtn"
              disabled={isLoading || !isPasswordValid}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>

            <div className="registerFooter">
              <span>Already have an account?</span>
              <Link to="/login">Sign In</Link>
            </div>
          </form>
        </div>

        <div className="imgContainer">
          <div className="imageContent">
            <span>SmartEstate</span>

            <h2>Start managing your properties professionally.</h2>

            <p>
              Create an account and get access to property posting, saved homes,
              messages, and profile management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;