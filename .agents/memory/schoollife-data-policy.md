---
name: SchoolLife data policy
description: Durable product rule for family records and connected-source data.
---

SchoolLife must never seed or display sample family records for a new account. Children are created through onboarding, and messages, tasks, events, and source status come only from that user's approved live connections.

**Why:** The product is a private family organizer; demo records make a new user's plan misleading and can assign real synced messages to the wrong child.

**How to apply:** Keep defaults disconnected and empty, assign synced records to the user's actual first child when available, and use an explicit unassigned family bucket only when no child exists.