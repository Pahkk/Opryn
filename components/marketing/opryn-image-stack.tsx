import Image from "next/image";
const projects = [
  {
    title: "Bring in what you know.",
    label: "Teach",
    src: "opryn_three_step_knowledge_flow.png",
    description:
      "Documents, processes and answers become proposals for your business to review.",
    alt: "Bring knowledge in, review it, and put it to use.",
  },
  {
    title: "Keep the source attached.",
    label: "Trust",
    src: "opryn_business_answer_pipeline.png",
    description:
      "Follow the route from a business question to reviewed, source-backed knowledge.",
    alt: "Question, review, source, approval and use connected in the Opryn workflow.",
  },
  {
    title: "One source. Two ways to use it.",
    label: "Reuse",
    src: "one_source_two_uses.png",
    description:
      "Your team and compatible connected AI can use the guidance they are allowed to access.",
    alt: "One reviewed source provides a team answer and permitted AI context.",
  },
  {
    title: "A missing answer starts a loop.",
    label: "Learn",
    src: "from_question_to_trusted_answer.png",
    description:
      "Ask a person, review useful guidance, and make the next answer easier.",
    alt: "An unknown question moves through human review into reusable approved knowledge.",
  },
  {
    title: "Connected. On your terms.",
    label: "Connect",
    src: "opryn_integrations_connection_page.png",
    description:
      "Choose supported sources and destinations. Each connection requires setup.",
    alt: "Opryn connects selected business sources with supported destinations.",
  },
];

// Native sticky positioning keeps reading time tied to the visitor's scroll,
// without a timer, scroll handler, animation dependency, or input interception.
export function OprynImageStack() {
  return (
    <div className="opryn-image-stack">
      {projects.map(({ label, title, description, src, alt }, index) => (
        <article
          key={src}
          className="opryn-stack-card"
          style={{ top: `calc(var(--stack-top) + ${index * 6}px)` }}
          aria-labelledby={`opryn-image-${index}`}
        >
          <header className="opryn-stack-card-heading">
            <div>
              <span className="stack-index">
                {String(index + 1).padStart(2, "0")} / {label}
              </span>
              <h3 id={`opryn-image-${index}`}>{title}</h3>
            </div>
            <p>{description}</p>
          </header>
          <div className="opryn-stack-art">
            <Image
              src={`/opryn-marketing/${src}`}
              alt={alt}
              width={1672}
              height={941}
              sizes="(max-width: 760px) 92vw, 1040px"
            />
          </div>
        </article>
      ))}
    </div>
  );
}
