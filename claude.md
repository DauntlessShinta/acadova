# CLAUDE.md

Guidance for Claude Code working with code in this repository.

## Project Context

This repository contains **Acadova**, the implementation of our proposed system:

**EduExchange: Peer-to-Peer Academic Skill and Knowledge Sharing Platform**

Acadova is a peer-to-peer academic skill and knowledge-sharing platform where students can learn from and teach other students using a credit-based system instead of direct monetary payments.

The project is a **3rd-year BSIT academic project**. Code must remain understandable, maintainable, secure, and appropriate for a student project.

---

# Technology Stack

The final project uses the **MERN stack**:

* **MongoDB** - database
* **Express.js** - backend API framework
* **React.js** - frontend framework
* **Node.js** - backend runtime
* **Mongoose** - MongoDB object modeling

Other technologies may include:

* JWT authentication
* JavaScript
* HTML/CSS
* Vite for the React frontend if appropriate

Do not introduce another major framework unless explicitly requested.

The existing backend is important and should be preserved unless changes are genuinely necessary.

The frontend should be implemented using React.

---

# Architecture

The intended application architecture is:

```text
React Frontend
      |
      | HTTP / API
      v
Express.js API
      |
      v
Node.js
      |
      v
Mongoose
      |
      v
MongoDB Atlas
```

The actual directory structure may differ.

Do not force the repository into a specific folder structure if the existing architecture is already clean and functional.

Adapt to the current repository rather than restructuring everything unnecessarily.

---

# General Principles

* Review existing files before modifying, refactoring, or creating related functionality.
* Understand the current architecture before making changes.
* Inspect the actual repository rather than assuming the project structure.
* Prefer concise, short solutions for new modules and features.
* Prioritize precise, readable, maintainable code.
* Avoid over-engineering.
* Avoid unnecessary abstractions.
* Avoid oversized files and identify files that clearly need refactoring.
* Watch for obvious bugs and broken assumptions.
* Watch for syntax and style that do not match the existing codebase.
* Reuse existing patterns and utilities when appropriate.
* Do not rewrite working functionality unnecessarily.
* Make the smallest reasonable change that solves the problem.
* Keep documentation concise and useful.
* Do not add unnecessary dependencies.
* Do not add external libraries unless absolutely necessary.
* Use the project's existing dependency files to determine compatible package versions.
* Do not guess package versions when `package.json` or lock files already provide the correct versions.
* Avoid redundancy unless it meaningfully improves usability or maintainability.
* Do not expose data unnecessarily.
* Follow the Principle of Least Privilege throughout the application.
* Prefer simple solutions that a 3rd-year BSIT student can understand and explain.

---

# Before Making Changes

Before modifying code:

1. Inspect the relevant existing files.
2. Read `package.json` and lock files when dependencies are involved.
3. Identify the current architecture and established coding patterns.
4. Determine whether the requested functionality already exists.
5. Check whether existing code can be extended instead of replaced.
6. Inspect affected routes, controllers, models, middleware, React components, pages, services, configuration, and tests.
7. Determine whether the frontend already has an implementation that can be improved.
8. Make a concise to-do list for non-trivial tasks.

Do not immediately rewrite files without first understanding them.

---

# Existing Work Takes Priority

This is an existing project, not a blank project.

Before creating new functionality:

* Check whether an equivalent implementation already exists.
* Reuse working code where reasonable.
* Do not create duplicate routes.
* Do not create duplicate controllers.
* Do not create duplicate models.
* Do not create duplicate React components.
* Do not replace working authentication without a clear reason.
* Do not replace the database architecture without a clear reason.

Preserve useful existing code.

---

# User Approval for Major Changes

Ask for user approval before making major architectural changes.

Examples:

* Replacing MongoDB.
* Replacing Express.js.
* Replacing React.
* Replacing JWT authentication.
* Changing the overall application architecture.
* Introducing microservices.
* Introducing a message broker.
* Performing a large-scale refactor across the project.
* Removing a major existing feature.
* Introducing complex cloud infrastructure.
* Replacing established project patterns across many files.

Normal feature development, bug fixes, security fixes, React components, backend endpoints, and localized refactoring generally do not require approval.

When approval is required, explain:

* What will change.
* Why it is necessary.
* What files or systems are affected.
* What simpler alternatives were considered.

Do not make major architectural changes silently.

---

# To-Do List

For non-trivial tasks, create and maintain a short to-do list.

Example:

```text
1. Inspect existing authentication flow.
2. Update backend authorization.
3. Create required React page.
4. Connect page to API.
5. Test complete user flow.
6. Update documentation.
```

Mark items complete as work progresses.

Keep the list focused on the current task.

---

# Activity Log

Maintain:

```text
docs/activity-log.md
```

Use the activity log as a lightweight record of important development decisions and completed work.

Record important information such as:

* Significant implementation changes.
* Important debugging discoveries.
* Configuration changes.
* Architectural decisions.
* Resolved issues.
* Important limitations.
* Testing results.
* Important frontend or backend decisions.

Keep entries concise and useful.

Example:

```markdown
## 2026-08-26

- Connected React login page to the existing authentication API.
- Added role-based navigation for learner, tutor, and admin.
- Restricted analytics endpoints to admin users.
- Connected subject demand analytics to MapReduce output.
```

When confused about previous work, inspect `docs/activity-log.md` before making assumptions.

Do not treat the activity log as a replacement for source code.

Do not automatically commit activity logs or documentation.

---

# Documentation Naming

Markdown files must use kebab-case filenames.

Use:

```text
some-description.md
activity-log.md
api-documentation.md
database-notes.md
security-guidelines.md
frontend-guidelines.md
```

Do not use:

```text
SomeDescription.md
some_description.md
Some Description.md
```

---

# Comments

Comments must be concise.

Rules:

* Use one-line comments.
* Use one sentence per comment.
* Explain why something exists when the reason is not obvious.
* Do not write comments that simply repeat the code.
* Do not create large comment blocks for simple logic.
* Do not use emojis or decorative special characters in comments.

Good:

```javascript
// Prevent learners from accessing another user's session.
```

Avoid:

```javascript
// This code checks whether the current authenticated user is allowed to
// access the requested session and then performs several additional checks...
```

Code should explain itself whenever practical.

---

# Code Quality

Prioritize:

* Readability.
* Correctness.
* Security.
* Maintainability.
* Appropriate data structures.
* Appropriate algorithms.
* Minimal complexity.
* Consistent project style.

Use the right data structure and algorithm for the problem.

Avoid:

* Deeply nested logic.
* Duplicate validation.
* Duplicate database queries.
* Unnecessary helper layers.
* Premature abstractions.
* Large controller functions.
* Unrelated changes inside feature patches.
* Clever syntax that makes code harder to understand.
* Excessive React component nesting.
* Unnecessary global state.

Prefer straightforward code over clever code.

---

# Dependencies

Do not add external libraries unless absolutely necessary.

Before adding a dependency:

1. Check whether the project already provides the required functionality.
2. Check existing dependencies.
3. Check whether built-in functionality is sufficient.
4. Confirm compatibility with the current project.
5. Use versions already established by `package.json` or lock files when possible.

Do not introduce a library merely for convenience.

Avoid adding large UI frameworks, state-management libraries, chart libraries, or utility packages unless there is a real project need.

---

# React Frontend

The official frontend technology is **React.js**.

The React frontend should:

* Use reusable components.
* Keep pages and shared components organized.
* Separate API communication from UI where practical.
* Avoid putting large amounts of business logic directly inside components.
* Handle loading states.
* Handle empty states.
* Handle errors.
* Handle authentication state.
* Handle role-based navigation.
* Keep components focused.

Prefer a simple structure such as:

```text
client/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── services/
│   ├── context/
│   ├── hooks/
│   ├── assets/
│   ├── App.jsx
│   └── main.jsx
```

Adapt this to the actual repository.

Do not create excessive folders for tiny components.

---

# React UI/UX

The frontend should look like a polished, real academic platform rather than a basic CRUD school project.

Use the Acadova reference website as the primary visual and UX reference:

```text
https://acadova01-svg.github.io/Acadova/
```

The reference is for **visual direction and user experience**, not source-code copying.

The frontend should follow the reference's overall:

* Visual identity.
* Layout direction.
* Typography hierarchy.
* Navigation style.
* Hero presentation.
* Card design.
* Button style.
* Spacing.
* Section organization.
* Dashboard presentation.
* Credit system presentation.
* Skill exploration.
* Analytics presentation.
* Responsive behavior.

Do not copy the reference website's source code.

Do not copy its fake/demo data.

Use our own backend and database data.

---

# UI/UX Principles

Prioritize:

* Clean visual hierarchy.
* Consistent spacing.
* Clear navigation.
* Consistent typography.
* Consistent cards and buttons.
* Responsive layouts.
* Accessible forms.
* Clear loading states.
* Useful empty states.
* Understandable error messages.
* Confirmation for important destructive actions.
* Minimal unnecessary interaction steps.

The user should quickly understand:

* Where they are.
* What they can do.
* What action should happen next.

Avoid:

* Excessive animations.
* Excessive gradients.
* Excessive shadows.
* Decorative effects that reduce usability.
* Unnecessary popups.
* Cluttered dashboards.

Keep the interface professional and modern.

---

# Acadova Landing Page

The landing page should communicate the core idea clearly:

**Learn What You Need. Teach What You Know.**

The experience should explain the credit-based exchange:

```text
TEACH
   ↓
EARN CREDITS
   ↓
LEARN
   ↓
GROW
```

The landing page may include:

* Hero section.
* Platform explanation.
* How it works.
* Credit system.
* Skills.
* Features.
* Peer-learning benefits.
* Community information.
* SDG 4 connection.
* Call to action.
* Footer.

Do not invent statistics.

Use actual database data when displaying dynamic numbers.

---

# Dashboard UX

Authenticated dashboards should feel like part of the same Acadova product.

## Learner Dashboard

May include:

* Available credits.
* Active sessions.
* Completed sessions.
* Ratings.
* Upcoming sessions.
* Recommended tutors.
* Learning activity.
* Find Tutor action.
* Request Session action.

## Tutor Dashboard

May include:

* Available credits.
* Pending requests.
* Active sessions.
* Completed sessions.
* Average rating.
* Skills.
* Incoming requests.
* Manage Skills action.

## Admin Dashboard

May include:

* Total users.
* Total sessions.
* Completed sessions.
* Average rating.
* Credit activity.
* Subject demand.
* Platform analytics.
* User management.

Use real backend data.

---

# API Integration

The React frontend must use the actual Express API.

Do not guess API endpoints.

Before connecting a frontend feature:

1. Inspect the route.
2. Inspect its controller.
3. Inspect expected request data.
4. Inspect expected response data.
5. Connect the React frontend to the actual implementation.

Create a simple service/API layer where practical.

Handle:

* Loading.
* Success.
* Validation errors.
* `401 Unauthorized`.
* `403 Forbidden`.
* `404 Not Found`.
* `409 Conflict`.
* `500 Internal Server Error`.
* Network failures.
* Expired authentication.

Do not expose backend stack traces to users.

---

# Security

Security is a core requirement of Acadova.

Always apply:

* Authentication.
* Authorization.
* Principle of Least Privilege.
* Server-side validation.
* Secure password storage.
* Secure token handling.
* Appropriate session security.
* Generic authentication failure messages.
* Protection against unauthorized data access.

Never:

* Store passwords in plain text.
* Return password hashes to clients.
* Hardcode secrets.
* Commit real credentials.
* Trust client-provided roles.
* Allow unrestricted administrator registration.
* Expose private user information unnecessarily.
* Grant administrator privileges by default.
* Rely on frontend validation as the only validation layer.

Use environment variables for secrets and private configuration.

---

# Authentication

Authentication answers:

```text
Who is this user?
```

Authorization answers:

```text
What is this user allowed to do?
```

Keep these responsibilities separate.

When JWT is used:

* Keep tokens minimal.
* Never place passwords in tokens.
* Never place unnecessary sensitive information in tokens.
* Keep JWT secrets outside source code.
* Validate token integrity and expiration.
* Reject invalid or expired tokens.

The React frontend may manage authentication state for user experience, but the backend remains the source of truth for authorization.

---

# Authorization

Acadova has three primary roles:

```text
learner
tutor
admin
```

Apply least privilege.

### Learner

Should only access learner-appropriate actions and authorized personal data.

### Tutor

Should only access tutor-appropriate actions and authorized personal data.

### Admin

May access administrative features and platform analytics.

Never rely only on frontend route protection.

Every protected backend operation must enforce authorization server-side.

---

# Data Access

Never expose more data than the client needs.

When querying MongoDB:

* Select only necessary fields when appropriate.
* Avoid returning internal fields unnecessarily.
* Never return password hashes.
* Avoid exposing unnecessary private account information.
* Verify that the authenticated user owns or is authorized to access the requested resource.

Always ask:

```text
Can this user access this specific document?
```

not only:

```text
Is this user logged in?
```

---

# Express.js

Follow the existing Express.js architecture.

Prefer:

```text
routes
    ↓
middleware
    ↓
controllers
    ↓
models
```

Keep responsibilities separated.

Use middleware for reusable concerns such as:

* Authentication.
* Authorization.
* Validation.
* Rate limiting.
* Request processing.

Controllers should coordinate application logic rather than becoming large collections of unrelated responsibilities.

Use appropriate HTTP status codes.

Examples:

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error
```

Do not return `200 OK` for every situation.

---

# Express Middleware Ordering

Be careful with middleware ordering.

Generally maintain the logical order:

```text
Application initialization
↓
Security middleware
↓
Body parsing
↓
Logging
↓
Authentication/authorization where required
↓
Routes
↓
404 handling
↓
Error handling
```

Do not modify middleware order without understanding its effect.

---

# MongoDB and Mongoose

Use MongoDB/Mongoose consistently with the current architecture.

Prefer clear models and relationships.

For referenced documents:

* Use references appropriately.
* Avoid unnecessary population.
* Avoid excessive database queries.
* Validate important fields.
* Add indexes only when justified by real query patterns.

Do not force relational-database patterns into MongoDB when they do not fit.

At the same time, do not sacrifice necessary consistency merely for schema flexibility.

---

# Acadova Domain Rules

Core domain entities include:

```text
Users
Skills
Sessions
Ratings
Credit Transactions
```

Important relationships include:

```text
Session
 ├── learner
 ├── tutor
 └── subject

Rating
 ├── session
 ├── fromUser
 └── toUser

CreditTransaction
 ├── fromUser
 ├── toUser
 └── session
```

Business rules must be enforced server-side.

Examples:

* Ratings must be within 1-5.
* Ratings should be tied to valid completed sessions.
* Credits must not become negative through invalid operations.
* Users must not directly manipulate their own credit balance.
* Users must not modify another user's private data.
* Session state transitions must be validated.
* Admin-only operations must be protected.

---

# MapReduce Implementation

The project uses MapReduce as a practical learning and analytics feature.

The conceptual flow must remain clear:

```text
MAP
↓
GROUP / SHUFFLE
↓
REDUCE
```

For subject demand analytics:

### Map

Convert each relevant session/request into:

```text
(subject, 1)
```

### Group

Group identical subjects:

```text
Java: [1, 1, 1]
Database: [1, 1]
Python: [1]
```

### Reduce

Sum the values:

```text
Java: 3
Database: 2
Python: 1
```

Keep this implementation understandable for a student presentation.

Do not introduce Hadoop, Spark, Kafka, or distributed infrastructure simply to demonstrate MapReduce.

---

# Analytics

Analytics should support the project's measurable variables:

* Session completion volume.
* Credit transaction activity.
* Peer rating scores.
* Subject demand frequency.

Administrative analytics must be protected.

Do not expose admin analytics to ordinary users.

The React admin dashboard should display actual backend-generated analytics.

---

# API Design

Follow REST conventions.

Use the actual project's route structure.

Examples may include:

```text
POST /api/auth/register
POST /api/auth/login

GET /api/analytics/subjects
GET /api/analytics/sessions
GET /api/analytics/ratings

POST /api/sessions
GET /api/sessions
PATCH /api/sessions/:id
```

These are examples only.

Do not create duplicate endpoints if equivalent routes already exist.

---

# Validation

Validate all important user-controlled input on the server.

Examples:

* Email format.
* Password requirements.
* Role values.
* Rating range.
* Credit amounts.
* Object IDs.
* Session statuses.
* Required fields.

Frontend validation improves UX but never replaces backend validation.

---

# Error Handling

Handle errors explicitly.

Do not silently ignore exceptions.

Do not return stack traces, database credentials, JWT secrets, or internal implementation details to clients.

Follow existing API response conventions when they already exist.

Example:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Example:

```json
{
  "success": false,
  "message": "Invalid request"
}
```

---

# MapReduce and Frontend Analytics

The React frontend should present MapReduce-generated analytics in a simple, understandable way.

For example:

```text
Most Requested Subjects

Java          15
Database      10
Python         8
Networking     5
```

The interface may use:

* Cards.
* Tables.
* Simple charts.
* Rankings.

Do not add a large charting library unless necessary.

---

# Frontend Data Rules

Do not hardcode fake users, sessions, ratings, credits, or analytics when the backend can provide real data.

Do not copy demonstration data from the reference website.

For development-only placeholders, clearly identify them as temporary and remove them when real API data becomes available.

---

# React and Backend Boundaries

Frontend responsibilities:

* Display data.
* Collect user input.
* Provide navigation.
* Manage UI state.
* Handle user interaction.
* Provide validation feedback.
* Manage frontend authentication state.

Backend responsibilities:

* Authentication.
* Authorization.
* Business rules.
* Validation.
* Database operations.
* Credit calculations.
* Session state changes.
* Analytics generation.
* Security enforcement.

Do not move sensitive business logic into the React frontend.

---

# Frontend Responsive Design

The React application must work on:

* Desktop.
* Laptop.
* Tablet.
* Mobile.

On smaller screens:

* Collapse navigation appropriately.
* Stack dashboard cards.
* Keep forms usable.
* Keep buttons touch-friendly.
* Make tables responsive or horizontally scrollable.

Do not simply shrink the desktop layout.

---

# Frontend Accessibility

Follow basic accessibility practices:

* Proper labels for inputs.
* Semantic HTML where practical.
* Keyboard-friendly controls.
* Visible focus states.
* Clear button text.
* Sufficient text contrast.
* Do not rely only on color to communicate status.

---

# Refactoring

Refactor only when there is a clear benefit.

Good reasons include:

* A file is excessively large.
* The same logic appears repeatedly.
* A function has too many responsibilities.
* Security logic is duplicated.
* A React component is handling too many unrelated responsibilities.
* Existing structure makes a feature difficult to maintain.
* A clear bug is caused by the current structure.

Do not refactor working code merely to make it look different.

When refactoring, preserve existing behavior unless behavior changes are explicitly required.

---

# File Size and Complexity

Watch for oversized files.

If a file becomes excessively large or contains unrelated responsibilities, consider splitting it logically.

However, do not create excessive micro-files.

The goal is:

```text
Small enough to understand.
Large enough to remain practical.
```

---

# Documentation

Documentation should explain decisions and usage rather than repeat source code.

Keep documentation concise.

Use kebab-case Markdown filenames.

Examples:

```text
api-documentation.md
security-guidelines.md
database-notes.md
frontend-guidelines.md
activity-log.md
```

Update documentation when major changes make it inaccurate.

Do not generate unnecessary documentation for trivial changes.

---

# Git and Commits

Do not automatically create commits unless explicitly instructed.

Do not automatically commit:

```text
docs/activity-log.md
```

or other documentation/activity logs.

Do not rewrite git history.

Do not force-push.

Do not delete branches or tags unless explicitly requested.

---

# Testing

After major code changes, test affected functionality.

At minimum, verify:

### Backend

* Server starts.
* Database connection works.
* Routes work.
* Authentication works.
* Authorization works.
* Validation works.
* Analytics work.
* MapReduce output works.

### Frontend

* React application builds.
* Landing page loads.
* Login works.
* Registration works.
* Authentication state works.
* Protected routes work.
* Role-based navigation works.
* API requests work.
* Loading states work.
* Error states work.
* Mobile layout is usable.

### Full Stack

Verify:

```text
React
   ↓
Express API
   ↓
Controller
   ↓
Mongoose
   ↓
MongoDB Atlas
```

Do not claim something works unless it has actually been tested or reasonably verified.

If something cannot be tested, state:

```text
NOT TESTED
```

and explain why.

---

# Development Environment

Use the project's actual scripts.

Before running commands, inspect the relevant `package.json`.

Do not assume:

```text
npm start
npm run dev
npm test
```

exist without confirming them.

When debugging environment problems:

1. Identify the actual error.
2. Check project configuration.
3. Check dependency versions.
4. Check environment variables.
5. Make the smallest practical fix.

Do not make unrelated configuration changes to hide errors.

---

# Environment Variables

Sensitive configuration must remain outside source code.

Examples may include:

```text
MONGODB_URI=
JWT_SECRET=
PORT=
NODE_ENV=
```

Use `.env` where appropriate.

Never commit real secrets.

Maintain `.env.example` without real credentials when useful.

---

# Output and Communication

When reporting work:

1. Briefly summarize what changed.
2. Mention important files modified.
3. Mention tests and verification performed.
4. Mention unresolved issues.
5. Mention anything requiring user approval.

Keep reports concise.

Do not claim successful implementation without verification.

---

# Priority Order

When making decisions, prioritize:

1. Security.
2. Correctness.
3. Existing project conventions.
4. User experience.
5. Simplicity.
6. Maintainability.
7. Performance where materially important.
8. Convenience.

Do not sacrifice security or correctness merely to reduce implementation time.

---

# Final Rule

Before every meaningful change, ask:

```text
Does this solve the actual problem?
Does it fit the existing codebase?
Does it fit the MERN architecture?
Is it secure?
Does it match the Acadova UI/UX direction?
Is it simpler than the alternatives?
Am I changing anything unnecessarily?
```

Prefer the smallest secure, maintainable solution that fits the existing **Acadova MERN architecture**.

The final application should feel like a cohesive Acadova product:

```text
React Frontend
      ↓
Express API
      ↓
Node.js
      ↓
Mongoose
      ↓
MongoDB Atlas
```

while applying the project's lessons in:

* MapReduce.
* Authentication.
* Authorization.
* Password security.
* JWT.
* Session security.
* Least privilege.
* REST API design.
* NoSQL database design.
* Practical analytics.
