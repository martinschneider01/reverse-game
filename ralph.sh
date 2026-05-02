#!/bin/bash
set -e

# Check for arguments
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <iterations> <progress-file>"
  echo "Example: $0 5 tv-progress.txt"
  exit 1
fi

ITERATIONS=$1
PROGRESS_FILE=$2

# Create progress file if it doesn't exist
touch "$PROGRESS_FILE"

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "result").result // empty'

# --- RALPH LOOP ---
for ((i=1; i<=$ITERATIONS; i++)); do
  echo "🚀 Iteration $i / $ITERATIONS"
  echo "---------------------------------"
  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  # Fetch open GitHub issues for context
  ISSUES=$(gh issue list --state open --json number,title,body,labels --limit 50)

  # Construct the System Prompt
  PROMPT="
  Here are the open GitHub issues for this project:
  $ISSUES

  @${PROGRESS_FILE}

  1. Read the open GitHub issues above and pick the highest-priority task to work on. Work only on that single task.
  This should be the one YOU decide has the highest priority - not necessarily the first one in the list.
  2. Check that the types check via bun typecheck, the tests pass via bun test, and the lint via bun lint.
  3. Append your progress to the end of the ${PROGRESS_FILE} file with a timestamp.
  Use this to leave a note for the next person working in the codebase.
  Include which GitHub issue number you worked on.
  4. Make a git commit of that work.
  5. If you make changes to the API, make sure that the changes are propagated to the frontend apps.
  ONLY WORK ON A SINGLE TASK.
  6. If needed, update the tests to cover the new functionality.
  7. On completion of the task, close the GitHub issue.
  8. If all open issues are complete, output <promise>COMPLETE</promise> (do not write that string otherwise)
  "

  # Call Claude with live output
  # Save output to temp file to check for completion while showing live output
  echo "$PROMPT" | claude --verbose --print --output-format stream-json --permission-mode bypassPermissions | grep --line-buffered '^{' | tee "$tmpfile" | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  # Check for completion token
  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "✅ All issues complete. Exiting loop."
    exit 0
  fi

  # Short pause to prevent rate-limiting issues
  sleep 2
done