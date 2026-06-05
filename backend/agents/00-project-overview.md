# Project Overview

This project is a backend for a mobile-first application.

## Product Context

The app is intended for family/couple meeting workflows: weekly meetings, shared topics, agreements, tasks, reminders, and history.

The backend should prioritize:

- data correctness
- privacy
- predictable API behavior
- safe auth and authorization
- maintainability
- mobile-friendly API responses

## Tech Stack

- Node.js
- Fastify
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- npm

## General Priorities

When making changes, prefer:

1. correctness over cleverness
2. explicit logic over hidden magic
3. small focused files over large mixed files
4. safe database changes over fast risky changes
5. stable API contracts over breaking changes

## Non-Goals

Do not add unnecessary complexity such as:

- custom framework abstractions without need
- premature microservices
- unnecessary background jobs
- complex caching before measuring performance
- large generic utility layers
