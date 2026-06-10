# New Project Playbook

This document outlines a structured process for building a web application, covering all phases from strategic planning to post-launch iteration.

I consider the items marked with a "*" to be important to my process and should not be skipped.

## 1. Define the project

Establish why the product exists, who it serves and what success looks like.

- [x] *Problem definition and [SuccessMetrics.md](SuccessMetrics.md)
- [x] *User personas and research [UserPersonas.md](UserPersonas.md)
- [x] *Core user journey's and flows [UserJourney.md](UserJourneys/UserJourney.md)
- [x] *Stakeholder mapping and constraints (ownership, budget, timeline, compliance, etc.) [StakeholderMapping.md](StakeholderMapping.md)
- [x] *Data privacy and legal requirements (GDPR etc.) [DataPrivacyStatement.md](DataPrivacyStatement.md)
- [x] *Checkpoint: Before moving onto design, ensure the problem definition is clear and at least one real user has validated it is a real problem.

## 2. Design the product

Translate the product intent into validated designs and system models.

- [x] *Sitemap and information requirements
- [x] *UX wireframes (low to high fidelity)
- [x] [Design system (DESIGN.md)](../DESIGN.md)
- [x] [Accessibility standards](AccessibilityStandards.md)
- [x] *Technical architecture and [stack selection](ADRs/ADR-001-TechStackSelection.md)
- [x] Data model and API contracts ([Entity Relationship diagrams and schema](DataModels/DataModels.md))
- [x] [Security architecture](ADRs/ADR-002-SecurityArchitecture.md) and threat modelling
- [ ] Non-functional requirements (performance, reliability, scalability)
- [ ] Basic prototypes / mock-ups
- [x] *Checkpoint: Before moving onto build, ensure the design is clear and there are no unknowns with the tech stack, design or data model.

## 3. Build Foundation

Lay the technical groundwork for a reliable, scalable, and testable platform. When writing epics, tie everything to value delivery, i.e. "We can deploy and test code in an isolated environment within 10 minutes".

- [x] *Repository setup and branching strategy
- [x] *Project setup in JIRA / task management system
- [x] *Dockerized development environment with parity
- [x] *Dockerized testing environment with parity
- [x] Staging / Pre-production environment with parity — Vercel Preview Deployments give every PR its own URL with the same build pipeline as production
- [x] *Database migrations and seed data management
- [x] Infrastructure as Code (Terraform/CloudFormation) — N/A: hosting (Vercel) and database (Supabase) are fully managed; no infrastructure to declare
- [x] *[Secrets and configuration management](ADRs/ADR-004-SecretManagement.md)
- [x] *CI pipeline (lint, format, type check and unit tests guards)
- [x] CI pipeline (E2E and integration tests)
- [x] CI pipeline (Code test coverage logging, for PR and main branch)
- [x] CD pipeline (blue-green deployment strategy) — Vercel performs atomic deploys: the new build only becomes live after it succeeds, and the previous build is retained for instant rollback
- [x] *CD pipeline (Automated deployment and method to rollback changes) — Vercel's Git integration auto-deploys `master` once CI passes; one-click rollback from the Vercel dashboard
- [x] *Checkpoint: Before moving onto feature development, ensure the foundations are in place to support the iterative and ongoing development of features.

## 4. Develop MVP Features

Build functionality in small, releasable vertical feature slices. When writing epics, tie everything to value delivery, i.e. "The user can save a product to their shopping basket".

- [x] *Backend services, endpoints, and business logic — server actions + route handlers across budget, balance, transactions, settings, auth
- [x] *Frontend components, state management, and routing — App Router pages + ~60 components (state is server-driven + local React state; Redux Toolkit installed but not yet wired)
- [x] *Authentication and user management (roles, sessions) — Supabase Auth (email/password + Google OAuth), sessions via `@supabase/ssr`, middleware route protection
- [ ] Security scanning and dependency management (Snyk, dependabot, etc.)
- [ ] Performance testing and optimization during development (Lighthouse, WebPageTest, etc.)

## 5. Validate

Prove the system is correct, performant, and secure.

- [ ] Load testing and performance profiling
- [ ] Security testing (penetration testing, OWASP validation)
- [ ] Non functional requirements validation (Service Level Agreements, Recovery Time Objective / Recovery Point Objective, Error budgets)
- [ ] CI pipeline (Regression tests running on a schedule)
- [ ] Common Vulnerabilities and Exposures (CVE) scanning with critical vulnerability blocking
- [ ] Observability implementation (logging, metrics, tracing to i.e. Datadog)
- [ ] Backup and disaster recovery testing

## 6. Deploy & Operate

Deliver safely to production and establish operational readiness.

- [ ] Production observability and telemetry
- [ ] Monitoring dashboards and alerting thresholds
- [ ] Feature flags and release checklist
- [ ] Post-deploy health verification (24-72h)
- [ ] Runbooks and on-call support procedures
- [ ] Validated CI/CD pipeline in production
- [ ] Confirmed disaster recovery capability
- [ ] Checkpoint: If you have not been iterating and deploying features as you go, you have not completed this phase.

## 7. Maintain & Evolve

Keep the product reliable, current, and continuously improving.

- [ ] Developer documentation and onboarding materials
- [ ] Post-mortem reviews and process improvements
- [ ] Dependency updates and technical debt management
- [ ] Data export and end-of-life planning
- [ ] Ongoing performance optimization
- [ ] Addition of features past the MVP
- [ ] Continuous security scanning and remediation
