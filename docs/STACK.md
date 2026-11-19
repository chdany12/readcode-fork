# Stack

What ReadCode is built with today (2026-11-19), and what isn't there yet.

## Language and types

- **TypeScript** everywhere: web app, pipeline, shared types.
- **Zod** schemas in `shared/types.ts` define the example format, plans and taxonomy; both the pipeline and the web app use them.

## Web app (`web/`)

- **Next.js 16** (App Router, Turbopack, `cacheComponents`), version 16.4.6.
- **React 19**: server components by default; client components for interactive parts (filters, exercise viewer, role cards).
- **shadcn/ui** (on Base UI) with **Tailwind CSS v4** through PostCSS. Theme tokens live in `app/globals.css`; dark mode is the default.
- **Monaco editor** shows code in the exercise viewer.
- **Fonts**: Geist and Geist Mono for the UI, JetBrains Mono for the logo and nav (`lib/fonts.ts`).
- **Icons**: lucide-react.
- **Data**: server-side helpers in `lib/` read JSON and source files from disk (`examples/`, `postings/`, `pipeline/taxonomy/`).

There is no separate backend service: the backend is Next.js itself (server components, and server actions when needed).

## Pipeline (`pipeline/`)

- **Node.js scripts in TypeScript**, run directly (`node pipeline/src/<script>.ts`): classifier, plan building, example generation.
- **Anthropic SDK** for model calls. So far, Claude Code subagents have done this work instead of the API.
- **Output is files committed to git**: examples, plans, weights.

## Data (`postings/`)

- `postings/jobs.json`: the job postings, scraped once and partly pasted by hand; the source of truth.
- `postings/plans/`: classifier weights and plans per posting.

## Not present yet

- Database
- Authentication and accounts
- Background jobs
- Tests
- Deployment and hosting

## Planned next (proposal, not built)

- **Postgres** (hosted on Neon or Supabase) with **Drizzle** ORM and migrations, inside the Next.js app.
- **Better Auth** (or Auth.js) for accounts, stored in the same database.
- Stable data (users, plans, attempts) in regular columns; changing data (taxonomy weights, plan targets, answers) in versioned `jsonb`.
- Grading moves to the server (server actions), so the answer key is no longer sent to the browser.
