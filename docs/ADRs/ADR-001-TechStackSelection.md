# ADR-001: Tech Stack Selection

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-11-25
- Decision maker: @jrrs1982

## Context

I am building this webapp as a personal project, i doing it to learn and improve my software development skills/process. I want to follow the steps set out in the [Playbook](../Playbook.md) that i have created, which i hope will help me select the best tech stack for this project.

This project will have a frontend and backend as well as a database and i would like the project to be dockerized to ensure that it can run on any machine.

I will want unit tests, end to end tests, and integration tests. I will want to use a database that is easy to use and scale, as well as an ORM. I will want to use a frontend framework that is easy to use and scale. I will want to use a backend framework that is easy to use and scale.

## Decision

### General

- pnpm: provides a fast and efficient package manager that is easy to use and scale
- TypeScript: for type safety
- Docker and the modern docker compose: for containerization
- zod: for runtime validation of data
- zod-env: for environment variable validation
- Biome: an alterative to eslint and prettier, for code quality
- Swagger: for automatically generating API documentation
- Next.js middleware: for rate limiting
- bcrypt: for password hashing

### Frontend

- React: for building the user interface and handling state
- Next.js App Router: full stack development framework
- Styled Components: for isolated styling of components
- Redux Toolkit (Immer): for state management

### Backend

- Next API Routes: for the API routes
- Next.js Server Components: for server-side request logic

### Database

- PostgreSQL: works well with Prisma and is easy to scale

### ORM

- Prisma: provides a type-safe database client and a schema language, with connection pooling and built in migrations

### CI/CD

- GitHub Actions: provides a free CI/CD pipeline that can be used to build, test and deploy the application

### Monitoring

- TBC: This is not going to be a part of the MVP

### Logging

- TBC: I may log a few things to console, but this is not going to be a part of the MVP

### Security

- [NextAuth.js](https://next-auth.js.org/): supports multiple providers and is easy to use

### Authentication

- [NextAuth.js](https://next-auth.js.org/): supports multiple providers and is easy to use

### Authorization

- Next.js: provides a middleware system that can be used to protect routes

### Testing

- Jest: for unit tests - it is the standard test runner
- React Testing Library: for component tests - it is the standard testing library for React
- Playwright: for e2e tests - recommended by Vercel for Next.js, excellent Docker support, faster CI runs

## Considered Alternatives

- npm: i am most familiar with npm and i have used it for many years, but i have heard that pnpm is faster and more efficient, hence I am trying it out in this project.
- Vite: i really like the idea of using Vite, and the developer experience it provides, but this app is a full stack app where there will be a backend and database, so i don't think Vite is the right choice.
- Typeorm: I am currently fixing issues with the implementation of Typeorm at work, and i don't want to use it in this project.
- Tailwind: I have never been a fan of Tailwind as it feels like i am writing CSS in a different language, but i have heard that it is a popular choice for styling React applications.
- ESLint + Husky: i have used ESLint and Husky in most of my projects, but i have heard that Biome is a good alternative so would like to give it a go.
- Dotenv: i have used dotenv in a number of projects, but i believe it is not required in Next.js
- Emotion: i use emotion at work, but have not strong feelings towards it, so i am open to trying styled components.
- Zustand: i use redux toolkit at work and like it, i performed a deep dive into state management systems for the company a few year ago and my opinion hasn't changed, I would like to try zustand, but I am happy to stick with redux toolkit as i know it to be a safe bet.
- Cypress: I have used Cypress in a number of my projects, but Playwright offers better Docker support, faster parallel execution, and is recommended by Vercel for Next.js projects.

### Consequences (optional)

- Good: I have enjoyed creating this document and thinking about the tech stack in advance in a structured way. It has helped me decide what i want in the tech stack (and why) and i feel more confident in my choice, and i expect it will make the development process smoother.
