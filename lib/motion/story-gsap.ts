"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
// Imported only by story modules; normal product UI doesn't pay for plugins.
gsap.registerPlugin(ScrollTrigger, Flip, SplitText, useGSAP);
export { gsap, ScrollTrigger, Flip, SplitText, useGSAP };
