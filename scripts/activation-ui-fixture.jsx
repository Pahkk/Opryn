// Local-only fixture: actual product components, synthetic workspace, no credentials.
import React from "react";
import { createRoot } from "react-dom/client";
import { ActivationOnboarding } from "../components/onboarding/activation-onboarding";
createRoot(document.getElementById("root")).render(<ActivationOnboarding organizationId={location.search.includes("existing")?"10000000-0000-4000-8000-000000000001":undefined}/>);
