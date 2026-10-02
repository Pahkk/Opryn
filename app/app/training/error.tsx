"use client";
export default function TrainingError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="p-6">
      <h1 className="text-2xl font-semibold">
        Training is temporarily unavailable
      </h1>
      <p className="mt-3 text-sm">
        Your earlier progress is preserved. Retry, or ask your administrator to
        verify the training database update.
      </p>
      <button className="opryn-action mt-5" onClick={reset}>
        Retry training
      </button>
    </section>
  );
}
