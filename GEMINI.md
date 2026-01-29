# GEMINI.md: Project Tender Flow

This document provides a comprehensive overview of the Tender Flow project, its architecture, and development practices.

## Project Overview

Tender Flow is a full-stack web application designed for managing construction project tenders. It allows users to manage projects, contacts, and project-related data, with features like a project dashboard, contact management, and data export. The application is built with a modern technology stack, including:

*   **Frontend:** A single-page application (SPA) built with [React](https://react.dev/) and [Vite](https://vitejs.dev/). It uses [Tailwind CSS](https://tailwindcss.com/) for styling and [Recharts](https://recharts.org/) for charts.
*   **Backend:** A [Node.js](https://nodejs.org/) server using the [Express](https://expressjs.com/) framework to serve the frontend and handle some API requests. It also proxies requests to other backend services.
*   **Database:** [Supabase](https://supabase.com/), a backend-as-a-service platform that provides a PostgreSQL database, authentication, and more.
*   **Desktop:** An [Electron](https://www.electronjs.org/) application that wraps the web app for a native desktop experience on macOS and Windows.
*   **Testing:** [Vitest](https://vitest.dev/) is used for running tests.

The application's source code is structured into several directories, including `src`, `components`, `hooks`, `services`, `server`, and `desktop`. The frontend is primarily located in the `src` directory, with reusable UI components in `components` and data-fetching logic in `hooks`.

## Building and Running

### Prerequisites

*   Node.js and npm

### Running the Application

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Environment Variables:**
    Create a `.env.local` file in the root of the project and add the following, replacing `your-gemini-api-key` with your actual Gemini API key:
    ```
    GEMINI_API_KEY=your-gemini-api-key
    ```

3.  **Run the Development Server:**
    This command starts the Vite development server for the web application.
    ```bash
    npm run dev
    ```

4.  **Run the Backend Server:**
    This command starts the Express server.
    ```bash
    npm start
    ```

5.  **Run the Desktop Application:**
    To run the Electron application in development mode:
    ```bash
    npm run desktop:dev
    ```

### Building the Application

*   **Build the Web Application:**
    ```bash
    npm run build
    ```
    This will create a `dist` directory with the production-ready static assets.

*   **Build the Desktop Application:**
    To build the Electron application for macOS or Windows:
    ```bash
    # For macOS
    npm run desktop:build:mac

    # For Windows
    npm run desktop:build:win
    ```

### Running Tests

*   **Run All Tests:**
    ```bash
    npm test
    ```

*   **Run Tests in Watch Mode:**
    ```bash
    npm run test:run
    ```

*   **Generate Test Coverage:**
    ```bash
    npm run test:coverage
    ```

## Development Conventions

*   **Code Style:** The project uses Prettier and ESLint for code formatting and linting, although no explicit configuration files for these are present in the root. The code follows standard React and TypeScript best practices.
*   **State Management:** The application uses a combination of React's built-in state management (`useState`, `useContext`) and `react-query` for managing server state. The `useAppData` hook is the central point for data fetching and state management.
*   **Component-Based Architecture:** The UI is built with a component-based architecture, with a clear separation of concerns between components, hooks, and services.
*   **File Naming:** Files are named using PascalCase for components (e.g., `ProjectManager.tsx`) and camelCase for other files (e.g., `useAppData.ts`).
*   **Styling:** The project uses Tailwind CSS for styling, with custom styles defined in `index.css` and `tailwind.config.js`.
*   **Internationalization:** The UI contains text in Czech, suggesting that the application is targeted at a Czech-speaking audience.

This `GEMINI.md` file should provide a good starting point for any developer looking to understand and contribute to the Tender Flow project.
