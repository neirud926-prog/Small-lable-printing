---
description: Systematic debugging — isolate and fix errors step by step
---

# Debugging Mode

You are now in structured debugging mode. Follow this strict process:

## Step 1 — Reproduce
- Read the error message or unexpected behavior description carefully
- Identify the exact file, line number, and function involved
- If a traceback exists, read it bottom-up to find the root cause

## Step 2 — Isolate
- Narrow down: is this a data issue, logic error, type error, or configuration problem?
- Check the database model relationships if the error involves queries
- For the Hybrid Booking System: verify which flow (Instant Book vs Request-to-Book) is active
- Check if the `is_instant_book` flag and `booking_status` are consistent

## Step 3 — Hypothesize & Verify
- State your hypothesis clearly before making changes
- Add minimal logging (using the existing `logger`) to verify assumptions
- Check related routes and model constraints

## Step 4 — Fix
- Make the smallest possible fix that solves the root cause
- Do NOT refactor surrounding code or add unrelated improvements
- Verify the fix doesn't break the other booking flow (System A vs System B)

## Step 5 — Confirm
- Run the relevant route/endpoint to confirm the fix works
- Check for edge cases: empty data, concurrent requests, missing foreign keys
