import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./aboutpage.scss";

function AboutPage() {
  const { t } = useTranslation();

  const features = [
    {
      number: "01",
      title: t("about.values.easySearch"),
      text: t("about.values.easySearchText"),
    },
    {
      number: "02",
      title: t("about.values.trustedAgents"),
      text: t("about.values.trustedAgentsText"),
    },
    {
      number: "03",
      title: t("about.values.cleanManagement"),
      text: t("about.values.cleanManagementText"),
    },
  ];

  return (
    <main className="aboutPage pageFade">
      <section className="aboutHero">
        <div>
          <p className="aboutEyebrow">{t("about.hero.badge")}</p>
          <h1>{t("about.hero.title")}</h1>
          <span>{t("about.hero.description")}</span>
        </div>

        <div className="aboutHeroActions">
          <Link to="/list" className="aboutPrimaryBtn">
            {t("agents.hero.exploreProperties")}
          </Link>

          <Link to="/contact" className="aboutSecondaryBtn">
            {t("nav.contact")}
          </Link>
        </div>
      </section>

      <div className="aboutStats">
        {features.map((item) => (
          <div key={item.number}>
            <span>{item.number}</span>
            <strong>{item.title}</strong>
          </div>
        ))}
      </div>

      <section className="aboutIntroSection">
        <div className="aboutIntroText">
          <p className="aboutEyebrow">{t("about.mission.badge")}</p>
          <h2>{t("about.mission.title")}</h2>
          <p>{t("about.mission.description")}</p>
        </div>

        <div className="aboutMissionGrid">
          <article className="aboutMissionCard">
            <strong>01</strong>
            <h3>{t("about.mission.title")}</h3>
            <p>{t("about.mission.description")}</p>
          </article>

          <article className="aboutMissionCard">
            <strong>02</strong>
            <h3>{t("about.values.title")}</h3>
            <p>{t("about.hero.description")}</p>
          </article>
        </div>
      </section>

      <section className="aboutFeaturesSection">
        <div className="aboutSectionHeader">
          <p className="aboutEyebrow">{t("about.values.title")}</p>
          <h2>{t("about.values.title")}</h2>
          <p>{t("about.hero.description")}</p>
        </div>

        <div className="aboutFeaturesGrid">
          {features.map((feature) => (
            <article className="aboutFeatureCard" key={feature.number}>
              <strong>{feature.number}</strong>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="aboutWhySection">
        <div>
          <p className="aboutEyebrow">{t("about.hero.badge")}</p>
          <h2>{t("about.mission.title")}</h2>
        </div>

        <p>{t("about.mission.description")}</p>
      </section>
    </main>
  );
}

export default AboutPage;
