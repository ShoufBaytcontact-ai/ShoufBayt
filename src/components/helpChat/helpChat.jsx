import { useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { helpScript, whatsappUrl } from "./helpScript";
import "./helpChat.scss";

function messagesFor(stack, t) {
  const items = [{ role: "bot", text: t("helpChat.steps.start") }];

  for (let index = 1; index < stack.length; index += 1) {
    const previous = helpScript[stack[index - 1]];
    const choice = previous.choices.find((item) => item.next === stack[index]);

    if (!choice) {
      continue;
    }

    items.push({
      role: "user",
      text: t(`helpChat.choices.${choice.id}`),
    });
    items.push({
      role: "bot",
      text: t(`helpChat.steps.${stack[index]}`),
    });
  }

  return items;
}

function HelpChat() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const threadRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState(["start"]);

  const hidden =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/chat");

  const step = helpScript[stack[stack.length - 1]];
  const messages = messagesFor(stack, t);

  useEffect(() => {
    setOpen(false);
    setStack(["start"]);
  }, [location.pathname]);

  useEffect(() => {
    if (!open || !threadRef.current) {
      return;
    }

    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [open, stack, messages.length]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) {
    return null;
  }

  const choose = (choice) => {
    if (choice.href) {
      const href = choice.auth && !currentUser ? "/login" : choice.href;
      setOpen(false);
      navigate(href);
      return;
    }

    if (choice.next) {
      setStack((prev) => [...prev, choice.next]);
    }
  };

  return (
    <div className={`helpChat${open ? " isOpen" : ""}`}>
      {open ? (
        <section className="helpChatPanel" aria-label={t("helpChat.title")}>
          <header className="helpChatHead">
            <div>
              <p>{t("helpChat.kicker")}</p>
              <h2>{t("helpChat.title")}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              {t("helpChat.close")}
            </button>
          </header>

          <div className="helpChatThread" ref={threadRef}>
            {messages.map((message, index) => (
              <p
                key={`${message.role}-${index}`}
                className={message.role === "bot" ? "botBubble" : "userBubble"}
              >
                {message.text}
              </p>
            ))}
          </div>

          <div className="helpChatChoices">
            {step.choices.map((choice) =>
              choice.whatsapp ? (
                <a
                  key={choice.id}
                  className="whatsappChoice"
                  href={whatsappUrl(
                    choice.whatsapp,
                    t(`helpChat.whatsappText.${choice.whatsapp}`)
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t(`helpChat.choices.${choice.id}`)}
                </a>
              ) : (
                <button key={choice.id} type="button" onClick={() => choose(choice)}>
                  {t(`helpChat.choices.${choice.id}`)}
                </button>
              )
            )}
          </div>

          <footer className="helpChatFoot">
            <button
              type="button"
              onClick={() => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
              disabled={stack.length < 2}
            >
              {t("helpChat.back")}
            </button>
            <button type="button" onClick={() => setStack(["start"])}>
              {t("helpChat.startOver")}
            </button>
          </footer>
        </section>
      ) : null}

      <button
        type="button"
        className="helpChatLauncher"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {open ? t("helpChat.close") : t("helpChat.open")}
      </button>
    </div>
  );
}

export default HelpChat;
