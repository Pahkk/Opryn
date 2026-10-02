"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const words = ["Questions.", "Answers.", "Approved.", "Remembered."];
const sessionKey = "opryn:homepage-intro:v1";

export function OprynWordsPreloader() {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [skipExit, setSkipExit] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion || window.sessionStorage.getItem(sessionKey) === "seen") {
      let hideTimer: number | undefined;
      const skipTimer = window.setTimeout(() => {
        setSkipExit(true);
        hideTimer = window.setTimeout(() => setVisible(false), 0);
      }, 0);
      return () => {
        window.clearTimeout(skipTimer);
        if (hideTimer) window.clearTimeout(hideTimer);
      };
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const wordTimer = window.setInterval(() => {
      setWordIndex((current) => Math.min(current + 1, words.length - 1));
    }, 360);
    const closeTimer = window.setTimeout(() => {
      window.clearInterval(wordTimer);
      window.sessionStorage.setItem(sessionKey, "seen");
      document.body.style.overflow = previousOverflow;
      setVisible(false);
    }, 1780);

    return () => {
      window.clearInterval(wordTimer);
      window.clearTimeout(closeTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [reducedMotion]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className={`opryn-words-preloader ${skipExit ? "is-skipping" : ""}`}
          role="status"
          aria-label="Opening the Opryn homepage"
          initial={false}
          exit={skipExit ? { opacity: 0 } : { y: "-105%" }}
          transition={{
            duration: skipExit ? 0 : 0.58,
            ease: [0.76, 0, 0.24, 1],
          }}
        >
          <div className="opryn-preloader-top" aria-hidden="true">
            <Image
              src="/opryn-mark.png"
              alt=""
              width={48}
              height={48}
              priority
            />
            <span>Company knowledge, made reusable</span>
          </div>

          <div className="opryn-preloader-word-window" aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={words[wordIndex]}
                initial={{ y: "82%", opacity: 0, rotateX: -18 }}
                animate={{ y: "0%", opacity: 1, rotateX: 0 }}
                exit={{ y: "-82%", opacity: 0, rotateX: 18 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {words[wordIndex]}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="opryn-preloader-progress" aria-hidden="true">
            <span>Teach once</span>
            <div>
              <motion.i
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.75, ease: "linear" }}
              />
            </div>
            <span>Use everywhere</span>
          </div>
          <div className="opryn-preloader-curve" aria-hidden="true" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
