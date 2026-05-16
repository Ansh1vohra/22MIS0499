# Notification System Design & Evaluation

This document outlines the architecture and implementation stages for the Campus Notification Platform.

---

# Stage 1: API Design & Real-Time Strategy

For a campus platform where students need instant updates on Placements, Events, and Results, I've designed a set of clean REST endpoints. Since users are pre-authorized, we skip login/registration and focus on the data.

### Core Endpoints
- **POST `/notifications`**: Creates a notification (supports targeting specific students or "all").
- **GET `/notifications`**: Fetches the student's inbox (supports pagination and type filters).
- **PATCH `/notifications/:id/read`**: Marks an item as viewed.
- **GET `/notifications/stream`**: A real-time SSE (Server-Sent Events) connection.

### Why SSE for Real-Time?
I chose **Server-Sent Events (SSE)** over WebSockets because it's much simpler for this use case. Students only need to receive updates from the server; they don't need a heavy bidirectional connection. SSE is native to browsers, handles reconnections automatically, and works over standard HTTP.

---

# Stage 2: Storage & Scaling

I suggest using **MongoDB** for storage. Notifications vary by type (a Placement needs company details, a Result needs exam IDs), and MongoDB’s flexible schema handles this better than a rigid SQL table.

### Key Collections
1. **Notifications**: Stores the "master" message.
2. **StudentInboxes**: A mapping table that tracks which student has seen which notification. This prevents duplicating the actual message text for 50,000 students.

### Scaling for the Future
As the data grows, I'd implement **Sharding** (splitting data across servers by StudentID) and use **TTL Indexes** to automatically clear out very old notifications that students no longer care about.

---

# Stage 3: Database Optimization

### Fixing Slow Queries
The original query `SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt ASC` is slow because it has to scan millions of rows. 

**The Fix:** Create a composite index:
```sql
CREATE INDEX idx_student_unread ON notifications (studentID, isRead, createdAt);
```
This lets the database jump straight to the student's unread items without a full table scan.

**On "Indexing Everything":** This is bad advice. Every index slows down your "Write" speed. We should only index columns that are actually used in filters or sorting.

---

# Stage 4: High Traffic Handling

When 50,000 students all check their phones at once, the database will sweat. I'd solve this with:
1. **Cursor Pagination**: Don't load the whole inbox. Load the first 10, then the next 10 as they scroll.
2. **Caching**: Store the "Top 10" notifications in Redis. Most students only look at the first page anyway.
3. **Unread Counters**: Store a single number in the database for "Unread Count" instead of counting rows every time the page loads.

---

# Stage 5: "Notify All" Reliability

The original "loop and send" approach is dangerous. If it crashes at student #25,000, you don't know who got the email and who didn't.

### The Redesign
1. **Queue the Job**: The "Notify All" button should just add a task to a background queue and return "Success" immediately.
2. **Worker Pattern**: Separate "Saving to DB" from "Sending Email". If the Email service is down, the DB write shouldn't fail.
3. **Idempotency**: Use a unique key for every delivery. If a worker retries, it won't send the same email twice.

---

# Stage 6: Priority Logic

To find the "Top 10" most important items, I use a weight-based score:
- **Placement (3) > Result (2) > Event (1)**
- **Score = (Weight * 10^15) + Timestamp**

This ensures all Placements come first (ordered by time), followed by all Results, etc. For performance with millions of notifications, we maintain this "Top 10" list in a small **Min-Heap** so we never have to sort the entire database.

---

# Stage 7: Frontend & Integration

I implemented a responsive React application using **Material UI**.

### Key Decisions
- **Express Proxy**: Built a local backend to handle tokens securely. The frontend never sees the secrets; the backend adds them before forwarding to the remote API.
- **UX Polish**: Added integrated pagination in the filter bar and a smooth "scroll-to-top" behavior for a premium feel.
- **State Management**: Used a Suitcase/Local storage strategy to distinguish between "New" and "Viewed" notifications without needing a per-student database.
- **Error Handling**: Implemented a "Safe Logging" wrapper in the backend so logging failures never crash the actual application.
