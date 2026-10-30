Fix the bug described in $ARGUMENTS with the smallest change, and prove it.

1. Write a test that reproduces the bug and run it: it must FAIL.
2. Make the smallest fix at the source.
3. Run scripts/ai/prove-fix.sh <fixed-file> <test-file> <pattern>: the test must pass with the fix and fail with the fix stashed.
4. Run the suite for the touched app. Then commit with a message that says what was wrong and what it broke.
