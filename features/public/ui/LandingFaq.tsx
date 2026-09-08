import { PUBLIC_FAQ } from "../model/publicFaq";

export const LandingFaq = () => (
  <section id="faq" aria-labelledby="landing-faq-title">
    <div className="container">
      <div className="sec-label">Otázky a odpovědi</div>
      <h2 className="sec-title" id="landing-faq-title">Časté otázky</h2>
      <div className="integration-grid">
        {PUBLIC_FAQ.map(({ question, answer }) => (
          <article className="integration-card" key={question}>
            <h3>{question}</h3>
            <p>{answer}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);
