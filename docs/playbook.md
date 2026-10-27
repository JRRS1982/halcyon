# New Project Playbook

**What:** Structured checklist for launching a web app — from problem definition through post-launch iteration.  
**Key points:**
- Items marked `*` are non-negotiable; the rest depend on context
- Covers: define → design → build foundation → MVP features → validate → deploy and operate → maintain
- `[x]` means done for Halcyon today; `[ ]` means not done
- A personal process guide, not a team workflow

A structured process for building a web application, from strategic planning to post-launch iteration. Items marked `*` are important to my process and must not be skipped.

## 1. Define the project

Establish why the product exists, who it serves and what success looks like.

- [x] *Problem definition and [success metrics](success-metrics.md)
- [x] *User personas and research [user personas](user-personas.md)
- [x] *Core user journeys and flows ([`user-journeys/`](user-journeys/))
- [x] *Stakeholder mapping and constraints (ownership, budget, timeline, compliance, etc.) [stakeholder mapping](stakeholder-mapping.md)
- [x] *Data privacy and legal requirements (GDPR etc.) [data privacy statement](data-privacy-statement.md)
- [x] *Checkpoint: Before moving onto design, ensure the problem definition is clear and at least one real user has validated it is a real problem.

## 2. Design the product

Translate the product intent into validated designs and system models.

- [x] *[Sitemap](sitemap.md) and information requirements
- [x] *UX wireframes (low to high fidelity)
- [x] [Design system (DESIGN.md)](../DESIGN.md)
- [x] [Accessibility standards](accessibility-standards.md)
- [x] *Technical architecture and [stack selection](adrs/adr-001-tech-stack-selection.md)
- [x] Data model and API contracts ([entity relationship diagrams and schema](data-models/data-models.md))
- [x] [Security architecture](adrs/adr-002-security-architecture.md) and threat modelling
- [ ] Non-functional requirements (performance, reliability, scalability)
- [ ] Basic prototypes / mock-ups
- [x] *Checkpoint: Before moving onto build, ensure the design is clear and there are no unknowns with the tech stack, design or data model.

## 3. Build Foundation

Lay the technical groundwork for a reliable, scalable, and testable platform. When writing epics, tie everything to value delivery, i.e. "We can deploy and test code in an isolated environment within 10 minutes".

- [x] *Repository setup and branching strategy
- [x] *Project setup in GitHub Issues
- [x] *Dockerized development environment with parity
- [x] *Dockerized testing environment with parity
- [x] Staging / Pre-production environment with parity — Vercel Preview Deployments give every PR its own URL with the same build pipeline as production
- [x] *Database migrations and seed data management
- [x] Infrastructure as Code (Terraform/CloudFormation) — N/A: hosting (Vercel) and database (Supabase) are fully managed; no infrastructure to declare
- [x] *[Secrets and configuration management](adrs/adr-004-secret-management.md)
- [x] *CI pipeline (lint, format, type check and unit tests guards)
- [x] CI pipeline (E2E and integration tests)
- [x] CI pipeline (Code test coverage logging, for PR and main branch)
- [x] CD pipeline (blue-green deployment strategy) — Vercel deploys atomically: a new build goes live only after it succeeds, and the previous build stays available for instant rollback
- [x] *CD pipeline (Automated deployment and method to rollback changes) — Vercel's Git integration deploys on push to `master` and promotes to production only once its Deployment Checks pass (`lint-and-test`, `integration-tests`, `e2e-tests`, `migrate-prod`); one-click rollback from the Vercel dashboard. See [CI/CD](engineering/ci-cd.md)
- [x] *Checkpoint: Before moving onto feature development, ensure the foundations are in place to support the iterative and ongoing development of features.

## 4. Develop MVP Features

Build functionality in small, releasable vertical feature slices. When writing epics, tie everything to value delivery, i.e. "The user can save a product to their shopping basket".

- [x] *Backend services, endpoints, and business logic — server actions + route handlers across budget, balance, transactions, settings, auth
- [x] *Frontend components, state management, and routing — App Router pages and shared components (state is server-driven plus local React state; there is no global store)
- [x] *Authentication and user management (roles, sessions) — Supabase Auth (email/password + Google OAuth), sessions via `@supabase/ssr`, route protection in the proxy (`src/proxy.ts`)
- [x] Security scanning and dependency management — Dependabot (`.github/dependabot.yml`), a `security-audit` CI job running `pnpm audit --audit-level high`, and GitGuardian secret scanning on every PR
- [ ] Performance testing and optimization during development (Lighthouse, WebPageTest, etc.)

## 5. Validate

Prove the system is correct, performant, and secure.

- [ ] Load testing and performance profiling
- [ ] Security testing (penetration testing, OWASP validation)
- [ ] Non functional requirements validation (Service Level Agreements, Recovery Time Objective / Recovery Point Objective, Error budgets)
- [ ] CI pipeline (Regression tests running on a schedule)
- [x] Common Vulnerabilities and Exposures (CVE) scanning with critical vulnerability blocking — the `security-audit` job goes red on high and critical advisories; it is deliberately not a required check, so it flags a new advisory without blocking merges
- [ ] Observability implementation (logging, metrics, tracing to i.e. Datadog)
- [ ] Backup and disaster recovery testing

## 6. Deploy & Operate

Deliver safely to production and establish operational readiness.

- [ ] Production observability and telemetry
- [ ] Monitoring dashboards and alerting thresholds
- [ ] Feature flags and release checklist
- [x] Post-deploy health verification (24-72h) — `smoke.yml` after every production deploy, `health.yml` daily
- [ ] Runbooks and on-call support procedures
- [ ] Validated CI/CD pipeline in production
- [ ] Confirmed disaster recovery capability
- [ ] Checkpoint: If you have not been iterating and deploying features as you go, you have not completed this phase.

## 7. Maintain & Evolve

Keep the product reliable, current, and continuously improving.

- [ ] Developer documentation and onboarding materials
- [ ] Post-mortem reviews and process improvements
- [x] Dependency updates and technical debt management — Dependabot, plus the `security-audit` CI job
- [ ] Data export and end-of-life planning
- [ ] Ongoing performance optimization
- [ ] Addition of features past the MVP
- [ ] Continuous security scanning and remediation
