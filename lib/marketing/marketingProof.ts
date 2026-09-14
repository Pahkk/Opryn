// Add only permission-cleared, attributable customer evidence. Empty by design.
export type Testimonial = { quote: string; name: string; company: string };
export type CustomerLogo = {
  src: string;
  name: string;
  width: number;
  height: number;
};
export type CaseStudy = { title: string; summary: string; href: string };
export type BeforeAfterMetric = {
  label: string;
  before: string;
  after: string;
  basis: string;
  sourceUrl: string;
};
export const marketingProof: {
  testimonials: Testimonial[];
  logos: CustomerLogo[];
  caseStudies: CaseStudy[];
  metrics: BeforeAfterMetric[];
} = { testimonials: [], logos: [], caseStudies: [], metrics: [] };
