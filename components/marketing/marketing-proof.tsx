import Image from "next/image";
import Link from "next/link";
import {
  marketingProof,
  type Testimonial,
  type CustomerLogo,
  type CaseStudy,
  type BeforeAfterMetric,
} from "@/lib/marketing/marketingProof";
export function TestimonialQuote({ item }: { item: Testimonial }) {
  return (
    <figure>
      <blockquote>{item.quote}</blockquote>
      <figcaption>
        {item.name} · {item.company}
      </figcaption>
    </figure>
  );
}
export function CustomerLogoImage({ item }: { item: CustomerLogo }) {
  return (
    <Image
      src={item.src}
      alt={item.name}
      width={item.width}
      height={item.height}
    />
  );
}
export function CaseStudyLink({ item }: { item: CaseStudy }) {
  return (
    <article>
      <h3>
        <Link href={item.href}>{item.title}</Link>
      </h3>
      <p>{item.summary}</p>
    </article>
  );
}
export function CustomerMetric({ item }: { item: BeforeAfterMetric }) {
  return (
    <figure>
      <figcaption>{item.label}</figcaption>
      <p>
        {item.before} → {item.after}
      </p>
      <p>
        {item.basis} · <a href={item.sourceUrl}>Source</a>
      </p>
    </figure>
  );
}
export function MarketingProof() {
  const { testimonials, logos, caseStudies, metrics } = marketingProof;
  if (
    !testimonials.length &&
    !logos.length &&
    !caseStudies.length &&
    !metrics.length
  )
    return null;
  return (
    <section className="marketing-proof story-shell">
      <h2>From businesses using Opryn</h2>
      {testimonials.map((item) => (
        <TestimonialQuote key={item.quote} item={item} />
      ))}
      {logos.map((item) => (
        <CustomerLogoImage key={item.name} item={item} />
      ))}
      {caseStudies.map((item) => (
        <CaseStudyLink key={item.href} item={item} />
      ))}
      {metrics.map((item) => (
        <CustomerMetric key={item.label} item={item} />
      ))}
    </section>
  );
}
