# My NestJS Application

This is a production-ready NestJS application with various services and features.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url> my_app
    cd my_app
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create `.env` file:**
    Copy `.env.example` to `.env` and update the values.
    ```bash
    cp .env.example .env
    ```

4.  **Run migrations:**
    This will create the database schema and seed initial roles.
    ```bash
    npm run migration:run
    ```

## Running the Application

*   **Development mode:**
    ```bash
    npm run start:dev
    ```
    The application will watch for file changes and restart automatically.

*   **Production mode:**
    ```bash
    npm run build
    npm run start:prod
    ```

The application will be available at `http://localhost:3000/api/v1`.

## API Endpoints

*   **Health Check:** `GET /api/v1/health`
*   **Auth:**
    *   `POST /api/v1/auth/register`
    *   `POST /api/v1/auth/login`
    *   `POST /api/v1/auth/refresh`
    *   `POST /api/v1/auth/logout`
    *   `GET /api/v1/auth/profile` (Requires JWT)
*   **Users:**
    *   `GET /api/v1/users` (Requires JWT, RBAC)
    *   `GET /api/v1/users/:id` (Requires JWT, RBAC)
    *   `PATCH /api/v1/users/:id` (Requires JWT, RBAC)
    *   `DELETE /api/v1/users/:id` (Requires JWT, RBAC)
*   **Uploads:**
    *   `POST /api/v1/uploads` (Requires JWT)
*   **Notifications:**
    *   `POST /api/v1/notifications/send` (Requires JWT, RBAC)
    *   `GET /api/v1/notifications` (Requires JWT)
    *   `PATCH /api/v1/notifications/:id/read` (Requires JWT)

## Database Migrations

*   **Generate a new migration:**
    ```bash
    npm run migration:generate src/migrations/NewMigrationName
    ```
*   **Run pending migrations:**
    ```bash
    npm run migration:run
    ```

## Logging

Logs are written to `./logs/combined.log` and `./logs/error.log` in JSON format in production, and colorized to console in development.
