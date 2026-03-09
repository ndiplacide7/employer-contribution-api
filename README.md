# Employer Contribution Management API

A production-ready NestJS API for managing employer contributions including pension, medical insurance, and maternity leave.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Architecture Decisions](#architecture-decisions)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Assumptions Made](#assumptions-made)
- [Future Improvements](#future-improvements)
- [License](#license)

## Features

### Core Features

- ✅ **Authentication & Authorization**: JWT-based authentication with role-based access control (Employer/Admin)
- ✅ **Employer Management**: CRUD operations for employer profiles with unique TIN validation
- ✅ **Employee Registration**: Employee management with unique national ID
- ✅ **Declaration Workflow**:
  - Create draft declarations
  - Auto-calculate contributions (Pension 6%, Medical 7.5%, Maternity 0.3%)
  - Submit declarations with status transitions
  - Validate/reject declarations (Admin only)
  - Duplicate period prevention
  - Unique payment number generation
- ✅ **Contribution Summary**: Aggregate contributions by month with date range filtering
- ✅ **Pagination**: All list endpoints support limit/offset pagination
- ✅ **Validation**: Comprehensive DTO validation using class-validator
- ✅ **Swagger Documentation**: Interactive API documentation at `/api/docs`

### Bonus Features

- ✅ **Structured Logging**: Winston logger with request context and file logging
- ✅ **Rate Limiting**: Throttling on auth endpoints to prevent abuse
- ✅ **Database Indexing**: Optimized queries with strategic indexes
- ✅ **Docker Support**: Complete docker-compose setup
- ✅ **CI Pipeline**: GitHub Actions for automated testing and builds
- ✅ **Seed Script**: Demo data generation for testing

## Tech Stack

- **Framework**: NestJS 9.x
- **Language**: TypeScript 4.7
- **Database**: PostgreSQL 15
- **ORM**: TypeORM 0.3
- **Authentication**: Passport JWT
- **Validation**: class-validator & class-transformer
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston
- **Rate Limiting**: @nestjs/throttler
- **Containerization**: Docker & Docker Compose

## Prerequisites

- Node.js 18+
- PostgreSQL 15+ (or Docker)
- npm or yarn

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd employer-contribution-api
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=employer_contribution

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=24h

PORT=3000
NODE_ENV=development
```

## Running the Application

### Option 1: Using Docker (Recommended)

```bash
# Start all services (app + database)
docker-compose up

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

The API will be available at `http://localhost:3000`

### Option 2: Local Development

```bash
# Ensure PostgreSQL is running locally

# Run migrations
npm run migration:run

# Seed demo data
npm run seed

# Start the application
npm run start:dev
```

## API Documentation

Once the application is running, access the Swagger documentation at:

**http://localhost:3000/api/docs**

### Demo Accounts

After running the seed script, use these accounts:

| Role     | Email                    | Password      |
|----------|--------------------------|---------------|
| Admin    | admin@example.com        | Admin123!     |
| Employer | employer1@example.com    | Employer123!  |
| Employer | employer2@example.com    | Employer123!  |
| Employer | employer3@example.com    | Employer123!  |

### Key Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token

#### Employers
- `POST /employers` - Create employer profile
- `GET /employers` - List all employers (Admin only)
- `GET /employers/:id` - Get employer details
- `PATCH /employers/:id` - Update employer
- `DELETE /employers/:id` - Delete employer (Admin only)

#### Employees
- `POST /employees` - Register employee
- `GET /employees` - List employees (filtered by employer)
- `GET /employees/:id` - Get employee details
- `PATCH /employees/:id` - Update employee
- `DELETE /employees/:id` - Delete employee

#### Declarations
- `POST /declarations` - Create declaration (draft)
- `GET /declarations` - List declarations
- `GET /declarations/:id` - Get declaration details
- `PATCH /declarations/:id/submit` - Submit declaration
- `PATCH /declarations/:id/validate` - Validate declaration (Admin)
- `PATCH /declarations/:id/reject` - Reject declaration (Admin)
- `GET /declarations/summary` - Get contribution summary by month
- `DELETE /declarations/:id` - Delete declaration (drafts only)

## Architecture Decisions

### 1. **Modular Architecture**
Each domain (Auth, Employers, Employees, Declarations) is separated into its own module with controllers, services, DTOs, and entities. This promotes:
- Clear separation of concerns
- Easy testing and maintenance
- Scalability

### 2. **Database Design**
- **Unique Constraints**: TIN for employers, national ID for employees, employer+period for declarations
- **Cascading Deletes**: Removing an employer cascades to employees and declarations
- **Soft Computed Fields**: Contribution amounts auto-calculated via entity hooks
- **Indexes**: Strategic indexes on frequently queried fields (email, TIN, nationalId, employerId, period)

### 3. **Security**
- **JWT Authentication**: Stateless authentication with role-based access
- **Password Hashing**: Bcrypt with salt rounds
- **Role Guards**: Employers can only access their own data; admins have full access
- **Rate Limiting**: Prevents brute-force attacks
- **Input Validation**: All DTOs validated with class-validator

### 4. **Business Logic**
- **Auto-calculation**: Contribution amounts calculated automatically based on gross salary
- **State Machine**: Declaration status transitions enforced (draft → submitted → validated/rejected)
- **Immutability**: Submitted/validated declarations cannot be edited
- **Duplicate Prevention**: Unique constraint prevents multiple declarations per period

### 5. **Error Handling**
- Consistent error responses across all endpoints
- Appropriate HTTP status codes
- Descriptive error messages

## Database Schema

### Key Relationships

```
User (1) ──→ (1) Employer ──→ (many) Employee
                    │
                    └──→ (many) Declaration ──→ (many) ContributionLine ──→ (1) Employee
```

### Indexes Strategy

| Entity       | Index                          | Reason                                    |
|--------------|--------------------------------|-------------------------------------------|
| User         | email                          | Authentication lookups                    |
| Employer     | tin                            | Unique constraint validation              |
| Employee     | nationalId, employerId         | Lookups and filtered queries              |
| Declaration  | employerId, period, composite  | Duplicate prevention and filtered queries |

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## Assumptions Made

1. **User-Employer Relationship**: Each employer user has one employer profile. The system creates users first, then employer profiles.

2. **Contribution Rates**: Fixed at 6% (pension), 7.5% (medical), 0.3% (maternity). In production, these might be configurable.

3. **Period Format**: YYYYMM format (e.g., 202401 for January 2024). No validation for future periods.

4. **Payment Number**: Auto-generated using timestamp + random number. In production, this might follow a specific format or use a sequence.

5. **Declaration Editing**: Only draft declarations can be edited. Submitted/validated declarations are immutable for audit purposes.

6. **Employee Salary**: Stored at employee level but can be overridden per declaration period.

7. **Validation/Rejection**: Admin-only operations. In production, this might involve more complex workflows.

8. **Data Retention**: No soft deletes implemented. In production, audit logs and soft deletes would be essential.

## Future Improvements

### With More Time

1. **Advanced Features**
   - Bulk upload for employees (CSV/Excel)
   - Declaration amendments workflow
   - Payment processing integration
   - Email notifications for status changes
   - PDF report generation
   - Audit trail for all changes

2. **Performance**
   - Redis caching for frequently accessed data
   - Database read replicas
   - Query optimization with explain analyze
   - Connection pooling configuration
   - Background job processing (Bull/BullMQ)

3. **Security**
   - Two-factor authentication
   - API key management for integrations
   - Security headers (Helmet)
   - CSRF protection
   - Input sanitization against XSS
   - Rate limiting per user/IP

4. **Monitoring & Observability**
   - APM integration (New Relic/Datadog)
   - Metrics collection (Prometheus)
   - Distributed tracing
   - Health check endpoints
   - Performance monitoring

5. **Testing**
   - Comprehensive unit test coverage (>80%)
   - Integration tests for database operations
   - E2E tests for critical user flows
   - Load testing
   - Security testing (OWASP)

6. **DevOps**
   - Kubernetes deployment manifests
   - Terraform for infrastructure
   - Multi-stage deployment (dev/staging/prod)
   - Database backup strategy
   - Disaster recovery plan

7. **Code Quality**
   - SonarQube integration
   - Dependency vulnerability scanning
   - Automated code reviews
   - Performance profiling

8. **Documentation**
   - Architecture diagrams
   - Sequence diagrams for workflows
   - API versioning strategy
   - Runbook for operations

## Project Structure

```
src/
├── auth/                    # Authentication & authorization
│   ├── decorators/         # Custom decorators
│   ├── dto/               # Data transfer objects
│   ├── guards/            # Auth & role guards
│   └── jwt.strategy.ts    # JWT strategy
├── common/                 # Shared utilities
│   ├── dto/               # Common DTOs (pagination)
│   └── enums/             # Enums (status, roles)
├── config/                 # Configuration
│   └── database.config.ts # Database configuration
├── database/              # Database-related
│   ├── migrations/        # TypeORM migrations
│   └── seeds/            # Seed scripts
├── declarations/          # Declaration module
├── employees/             # Employee module
├── employers/             # Employer module
├── entities/              # TypeORM entities
└── main.ts               # Application entry point
```

## License

This project is licensed under the UNLICENSED license.

---

**Built with ❤️ using NestJS**
