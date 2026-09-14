#!/bin/zsh

set -u

cd /Users/nikitapakhomov/handoff || exit 1
clear

echo "Connect Nango to Opryn"
echo ""
echo "Paste the Nango server secret from Environment Settings > API Keys."
echo "It will be sent directly to Vercel and will not be displayed."
echo ""

read -r -s "task_nango_key?Nango secret key: "
echo ""

if [[ -z "${task_nango_key}" ]]; then
  echo "No key entered. Nothing changed."
  read -r "task_close?Press Return to close."
  exit 1
fi

task_failed=0
for task_target in production preview development; do
  echo "Adding NANGO_SECRET_KEY to ${task_target}..."
  if ! printf "%s" "${task_nango_key}" | npx vercel env add NANGO_SECRET_KEY "${task_target}" --sensitive; then
    task_failed=1
  fi
done

unset task_nango_key

echo ""
if [[ "${task_failed}" -eq 0 ]]; then
  echo "Nango is connected to all Opryn Vercel environments."
  echo "Return to Codex and say: done"
else
  echo "Vercel reported an error above. Leave this window open and tell Codex what it says."
fi

read -r "task_close?Press Return when you are ready to close this window."
