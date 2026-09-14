"use client";
import { useState } from "react";
import { company } from "@/lib/marketing/company";
export const contactTopics = [
  "Sales / fit",
  "Support",
  "Security / privacy",
  "Larger team",
  "Integration request",
  "Other",
];

export function ContactComposer({
  initialTopic = "Sales / fit",
}: {
  initialTopic?: string;
}) {
  const [status, setStatus] = useState("");
  return (
    <form
      className="contact-composer"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const topic = String(data.get("topic"));
        const body = `Name: ${data.get("name")}\nWork email: ${data.get("email")}\nCompany: ${data.get("company")}\n\n${data.get("message")}`;
        window.location.href = `mailto:${company.supportEmail}?subject=${encodeURIComponent(`Opryn — ${topic}`)}&body=${encodeURIComponent(body)}`;
        setStatus(
          "Your email app was requested. Send the draft there to contact us. If it didn’t open, email us directly using the address below.",
        );
      }}
    >
      <h2>What would you like to talk about?</h2>
      <p>
        This prepares a draft in your email app. Nothing is submitted through
        this website.
      </p>
      <div className="contact-fields">
        <label>
          Name
          <input name="name" autoComplete="name" required maxLength={100} />
        </label>
        <label>
          Work email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          Company <span>(optional)</span>
          <input name="company" autoComplete="organization" maxLength={150} />
        </label>
        <label>
          Topic
          <select
            name="topic"
            defaultValue={
              contactTopics.includes(initialTopic)
                ? initialTopic
                : contactTopics[0]
            }
          >
            {contactTopics.map((topic) => (
              <option key={topic}>{topic}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Message
        <textarea
          name="message"
          required
          maxLength={3000}
          rows={5}
          aria-describedby="contact-safety"
        />
      </label>
      <p id="contact-safety" className="public-note">
        Please don’t include passwords, API keys, card details or private
        recordings.
      </p>
      <button className="story-button story-button-primary" type="submit">
        Open email draft <span aria-hidden>↗</span>
      </button>
      <p role="status">{status}</p>
    </form>
  );
}
