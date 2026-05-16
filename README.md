# Campus Notification System

A full-stack notification platform built for the AffordMed Hiring Evaluation. This system manages real-time updates for Placements, Events, and Results with a focus on priority-based delivery and high-performance architecture.

## Tech Stack
- **Frontend**: React + Material UI (Running on port 3000)
- **Backend**: Express.js (Running on port 5000)
- **Shared**: Custom Logging Middleware

## Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
npm start
```
*Make sure to configure the `AFFORDMED_TOKEN` in `backend/.env`.*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The UI will be available at `http://localhost:3000`.*

## Key Features
- **Priority Inbox**: Automatically ranks notifications based on type (Placement > Result > Event) and recency.
- **Smart Proxying**: A custom Express backend handles all API requests securely, keeping tokens away from the client side.
- **Efficient Pagination**: Integrated controls at both top and bottom of the UI with smooth "scroll-to-top" behavior.
- **Real-time Ready**: Designed with SSE (Server-Sent Events) in mind for instant student updates.
- **Unified Logging**: All frontend and backend actions are tracked through the mandatory logging middleware.

## Project Structure
- `/frontend`: React application with Material UI styling.
- `/backend`: Express API server and notification processing logic.
- `/logging_middleware`: Shared validation and logging package.
- `notification_system_design.md`: Detailed documentation for all stages (1-7).
