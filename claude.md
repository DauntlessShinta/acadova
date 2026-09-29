# CLAUDE.md

The canonical project instructions for Acadova are located in:

`AGENTS.md`

Read and follow the root `AGENTS.md` before making any changes.

`AGENTS.md` contains the current post-milestone locked scope,
architecture, role logic, security requirements, implementation rules,
and development priorities.

Architecture alignment:

- Account roles are `student`, `moderator`, and `admin`.
- Learner and Tutor are contextual Session relationships, not account roles.
- React/Vite in `acadova-frontend` is the canonical frontend.
- `acadova-backend/public` is a deprecated legacy frontend, still served for compatibility; do not add new functionality there or disable/remove it without approval and regression testing.
- Treat unfinished items in the locked final scope as planned work, not implemented features.

Do not use outdated assumptions from previous Acadova designs.

If this file conflicts with `AGENTS.md`, `AGENTS.md` takes precedence.
