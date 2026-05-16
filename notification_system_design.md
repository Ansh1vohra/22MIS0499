# Stage 1

## Notification Platform API Design

The campus notification platform supports in-app notifications for placement updates, events, and results. Users are assumed to be pre-authorised, so the APIs do not include registration or login flows. The API still accepts an authorization header so that it can be deployed behind an existing identity provider or gateway.

## Core Actions

- Create a notification for one student, selected students, or all students.
- Fetch notifications for a student with pagination and optional filters.
- Fetch unread notifications for a student.
- Fetch priority notifications for a student.
- Mark one notification as read.
- Mark all notifications as read.
- Delete or archive a notification from a student's inbox.
- Subscribe to real-time notification updates.

## Common Headers

All API requests should use these headers unless stated otherwise.

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
X-Request-ID: <uuid>
```

The `X-Request-ID` header is used for tracing and should be included in Logging Middleware calls.

## Common Notification Object

```json
{
  "id": "9d6fd4dc-0f7f-46b8-98a5-f5cc8b0c85aa",
  "studentId": 1042,
  "type": "Placement",
  "title": "Placement Drive",
  "message": "CSX Corporation hiring registration is now open.",
  "priority": 95,
  "isRead": false,
  "createdAt": "2026-04-22T17:51:18.000Z",
  "readAt": null,
  "metadata": {
    "company": "CSX Corporation",
    "deadline": "2026-04-25T18:00:00.000Z"
  }
}
```

Allowed notification types:

```json
["Event", "Result", "Placement"]
```

## Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "notificationType must be Event, Result, or Placement",
    "requestId": "3ba787cb-08fb-4c5a-83b1-b9bd73bb44dc"
  }
}
```

## API Endpoints

### 1. Create Notification

Creates a notification for one or many students. If `target.type` is `all`, the backend should fan out the notification asynchronously instead of blocking the request until every student record is inserted.

```http
POST /api/v1/notifications
```

Request:

```json
{
  "type": "Placement",
  "title": "Placement Drive",
  "message": "CSX Corporation hiring registration is now open.",
  "target": {
    "type": "students",
    "studentIds": [1042, 1043, 1044]
  },
  "metadata": {
    "company": "CSX Corporation",
    "deadline": "2026-04-25T18:00:00.000Z"
  }
}
```

Response `202 Accepted`:

```json
{
  "jobId": "6edfdc73-8c25-4f5f-9f47-595d26609a21",
  "status": "queued",
  "message": "Notification delivery has been queued"
}
```

### 2. List Notifications

Fetches notifications for a student. Results are paginated and can be filtered by type and read state.

```http
GET /api/v1/students/{studentId}/notifications?page=1&limit=20&type=Placement&isRead=false
```

Response `200 OK`:

```json
{
  "data": [
    {
      "id": "9d6fd4dc-0f7f-46b8-98a5-f5cc8b0c85aa",
      "studentId": 1042,
      "type": "Placement",
      "title": "Placement Drive",
      "message": "CSX Corporation hiring registration is now open.",
      "priority": 95,
      "isRead": false,
      "createdAt": "2026-04-22T17:51:18.000Z",
      "readAt": null,
      "metadata": {
        "company": "CSX Corporation"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "hasNextPage": true
  }
}
```

### 3. Get Unread Count

Fetches the current unread count for the student's notification badge.

```http
GET /api/v1/students/{studentId}/notifications/unread-count
```

Response `200 OK`:

```json
{
  "studentId": 1042,
  "unreadCount": 12,
  "countsByType": {
    "Placement": 3,
    "Result": 4,
    "Event": 5
  }
}
```

### 4. Get Priority Notifications

Fetches the top priority unread notifications. Priority is computed from notification type weight and recency.

```http
GET /api/v1/students/{studentId}/notifications/priority?limit=10&type=Placement
```

Response `200 OK`:

```json
{
  "data": [
    {
      "id": "9d6fd4dc-0f7f-46b8-98a5-f5cc8b0c85aa",
      "studentId": 1042,
      "type": "Placement",
      "title": "Placement Drive",
      "message": "CSX Corporation hiring registration is now open.",
      "priority": 95,
      "isRead": false,
      "createdAt": "2026-04-22T17:51:18.000Z"
    }
  ],
  "limit": 10,
  "priorityRule": "typeWeight + recencyScore"
}
```

### 5. Mark Notification As Read

Marks a single notification as read for a student.

```http
PATCH /api/v1/students/{studentId}/notifications/{notificationId}/read
```

Request:

```json
{
  "isRead": true
}
```

Response `200 OK`:

```json
{
  "id": "9d6fd4dc-0f7f-46b8-98a5-f5cc8b0c85aa",
  "studentId": 1042,
  "isRead": true,
  "readAt": "2026-04-22T18:10:45.000Z"
}
```

### 6. Mark All Notifications As Read

Marks every unread notification for a student as read.

```http
PATCH /api/v1/students/{studentId}/notifications/read-all
```

Request:

```json
{
  "before": "2026-04-22T18:10:45.000Z"
}
```

Response `200 OK`:

```json
{
  "studentId": 1042,
  "updatedCount": 12,
  "readAt": "2026-04-22T18:10:45.000Z"
}
```

### 7. Archive Notification

Archives a notification from the student's visible inbox without deleting the source notification record.

```http
DELETE /api/v1/students/{studentId}/notifications/{notificationId}
```

Response `200 OK`:

```json
{
  "id": "9d6fd4dc-0f7f-46b8-98a5-f5cc8b0c85aa",
  "studentId": 1042,
  "archived": true,
  "archivedAt": "2026-04-22T18:12:00.000Z"
}
```

## Real-Time Notification Mechanism

Use Server-Sent Events for real-time in-app notifications.

```http
GET /api/v1/students/{studentId}/notifications/stream
```

Headers:

```http
Authorization: Bearer <access_token>
Accept: text/event-stream
Cache-Control: no-cache
X-Request-ID: <uuid>
```

Example event:

```text
event: notification.created
id: 9d6fd4dc-0f7f-46b8-98a5-f5cc8b0c85aa
data: {"id":"9d6fd4dc-0f7f-46b8-98a5-f5cc8b0c85aa","type":"Placement","title":"Placement Drive","message":"CSX Corporation hiring registration is now open.","createdAt":"2026-04-22T17:51:18.000Z"}
```

SSE is suitable because students only need server-to-client updates. It is simpler than WebSockets, works over standard HTTP, reconnects automatically, and avoids maintaining a custom bidirectional protocol. If future requirements need client-to-server real-time actions, the stream can be replaced with WebSockets without changing the REST API contracts.

## Logging Middleware Usage

Every API handler should call the reusable Logging Middleware with descriptive messages. Examples:

```js
await Log("backend", "info", "handler", "fetching notifications for student 1042");
await Log("backend", "warn", "service", "priority notification limit exceeded, using max limit 50");
await Log("backend", "error", "db", "failed to update notification read status");
```

The frontend should also log important lifecycle events:

```js
await Log("frontend", "info", "api", "notifications loaded successfully");
await Log("frontend", "error", "component", "failed to render notification list");
```

# Stage 2

## Persistent Storage Choice

I would use MongoDB for the notification platform. Notifications are naturally document-oriented because each notification has a stable core shape but may also contain type-specific metadata, such as company details for placements, venue details for events, or exam details for results. MongoDB also supports high write throughput, flexible schemas, compound indexes, TTL indexes, and horizontal scaling through sharding, which are useful for a campus notification system with frequent inserts and read-heavy inbox pages.

The main tradeoff is that MongoDB does not enforce relational constraints as strongly as SQL databases. To manage that, the application should validate request payloads strictly and use indexes that match the main API query patterns.

## Collections

### students

Stores student profile data needed for targeting and lookup.

```js
{
  _id: ObjectId("6628f0119f32d7df5f4f4a00"),
  studentId: 1042,
  name: "Ram Krishna",
  email: "ramkrishna@abc.edu",
  department: "CSE",
  batch: "2026",
  createdAt: ISODate("2026-04-22T17:00:00.000Z"),
  updatedAt: ISODate("2026-04-22T17:00:00.000Z")
}
```

Indexes:

```js
db.students.createIndex({ studentId: 1 }, { unique: true });
db.students.createIndex({ email: 1 }, { unique: true });
db.students.createIndex({ department: 1, batch: 1 });
```

### notifications

Stores the source notification created by an admin, HR user, or system process.

```js
{
  _id: ObjectId("6628f11f9f32d7df5f4f4a10"),
  type: "Placement",
  title: "Placement Drive",
  message: "CSX Corporation hiring registration is now open.",
  priorityWeight: 100,
  metadata: {
    company: "CSX Corporation",
    deadline: ISODate("2026-04-25T18:00:00.000Z")
  },
  target: {
    type: "students",
    studentIds: [1042, 1043, 1044]
  },
  createdBy: "placement-cell",
  createdAt: ISODate("2026-04-22T17:51:18.000Z"),
  updatedAt: ISODate("2026-04-22T17:51:18.000Z")
}
```

Indexes:

```js
db.notifications.createIndex({ type: 1, createdAt: -1 });
db.notifications.createIndex({ createdAt: -1 });
```

### student_notifications

Stores each student's inbox state for a notification. Separating this from `notifications` avoids duplicating the full message body for every student while still allowing per-student read/archive state.

```js
{
  _id: ObjectId("6628f1c59f32d7df5f4f4b00"),
  studentId: 1042,
  notificationId: ObjectId("6628f11f9f32d7df5f4f4a10"),
  type: "Placement",
  isRead: false,
  readAt: null,
  archived: false,
  archivedAt: null,
  deliveredAt: ISODate("2026-04-22T17:51:19.000Z"),
  createdAt: ISODate("2026-04-22T17:51:18.000Z")
}
```

Indexes:

```js
db.student_notifications.createIndex(
  { studentId: 1, archived: 1, createdAt: -1 }
);

db.student_notifications.createIndex(
  { studentId: 1, isRead: 1, archived: 1, createdAt: -1 }
);

db.student_notifications.createIndex(
  { studentId: 1, type: 1, isRead: 1, archived: 1, createdAt: -1 }
);

db.student_notifications.createIndex(
  { notificationId: 1, studentId: 1 },
  { unique: true }
);
```

### notification_jobs

Tracks async fan-out jobs for actions like "Notify All".

```js
{
  _id: ObjectId("6628f21f9f32d7df5f4f4c00"),
  notificationId: ObjectId("6628f11f9f32d7df5f4f4a10"),
  status: "queued",
  targetCount: 50000,
  processedCount: 0,
  failedCount: 0,
  createdAt: ISODate("2026-04-22T17:51:18.000Z"),
  updatedAt: ISODate("2026-04-22T17:51:18.000Z")
}
```

Indexes:

```js
db.notification_jobs.createIndex({ status: 1, createdAt: 1 });
db.notification_jobs.createIndex({ notificationId: 1 });
```

## Queries Based On Stage 1 APIs

### Create Notification

```js
const notification = {
  type: "Placement",
  title: "Placement Drive",
  message: "CSX Corporation hiring registration is now open.",
  priorityWeight: 100,
  metadata: { company: "CSX Corporation" },
  target: { type: "students", studentIds: [1042, 1043, 1044] },
  createdBy: "placement-cell",
  createdAt: new Date(),
  updatedAt: new Date()
};

const result = db.notifications.insertOne(notification);

db.notification_jobs.insertOne({
  notificationId: result.insertedId,
  status: "queued",
  targetCount: 3,
  processedCount: 0,
  failedCount: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### Fan Out Notification To Student Inboxes

```js
db.student_notifications.insertMany(
  [1042, 1043, 1044].map((studentId) => ({
    studentId,
    notificationId: result.insertedId,
    type: "Placement",
    isRead: false,
    readAt: null,
    archived: false,
    archivedAt: null,
    deliveredAt: new Date(),
    createdAt: notification.createdAt
  })),
  { ordered: false }
);
```

### List Notifications

```js
db.student_notifications.aggregate([
  {
    $match: {
      studentId: 1042,
      archived: false,
      type: "Placement",
      isRead: false
    }
  },
  { $sort: { createdAt: -1 } },
  { $skip: 0 },
  { $limit: 20 },
  {
    $lookup: {
      from: "notifications",
      localField: "notificationId",
      foreignField: "_id",
      as: "notification"
    }
  },
  { $unwind: "$notification" },
  {
    $project: {
      _id: 1,
      studentId: 1,
      type: 1,
      isRead: 1,
      readAt: 1,
      createdAt: 1,
      title: "$notification.title",
      message: "$notification.message",
      metadata: "$notification.metadata"
    }
  }
]);
```

### Get Unread Count

```js
db.student_notifications.countDocuments({
  studentId: 1042,
  isRead: false,
  archived: false
});
```

### Get Unread Count By Type

```js
db.student_notifications.aggregate([
  {
    $match: {
      studentId: 1042,
      isRead: false,
      archived: false
    }
  },
  {
    $group: {
      _id: "$type",
      count: { $sum: 1 }
    }
  }
]);
```

### Get Priority Notifications

```js
db.student_notifications.aggregate([
  {
    $match: {
      studentId: 1042,
      isRead: false,
      archived: false
    }
  },
  {
    $addFields: {
      typeWeight: {
        $switch: {
          branches: [
            { case: { $eq: ["$type", "Placement"] }, then: 100 },
            { case: { $eq: ["$type", "Result"] }, then: 60 },
            { case: { $eq: ["$type", "Event"] }, then: 30 }
          ],
          default: 0
        }
      }
    }
  },
  {
    $sort: {
      typeWeight: -1,
      createdAt: -1
    }
  },
  { $limit: 10 },
  {
    $lookup: {
      from: "notifications",
      localField: "notificationId",
      foreignField: "_id",
      as: "notification"
    }
  },
  { $unwind: "$notification" }
]);
```

### Mark One Notification As Read

```js
db.student_notifications.updateOne(
  {
    studentId: 1042,
    notificationId: ObjectId("6628f11f9f32d7df5f4f4a10"),
    archived: false
  },
  {
    $set: {
      isRead: true,
      readAt: new Date()
    }
  }
);
```

### Mark All Notifications As Read

```js
db.student_notifications.updateMany(
  {
    studentId: 1042,
    isRead: false,
    archived: false,
    createdAt: { $lte: new Date("2026-04-22T18:10:45.000Z") }
  },
  {
    $set: {
      isRead: true,
      readAt: new Date()
    }
  }
);
```

### Archive Notification

```js
db.student_notifications.updateOne(
  {
    studentId: 1042,
    notificationId: ObjectId("6628f11f9f32d7df5f4f4a10")
  },
  {
    $set: {
      archived: true,
      archivedAt: new Date()
    }
  }
);
```

## Problems As Data Volume Increases

- Slow inbox reads: Without compound indexes, MongoDB would scan too many inbox rows for filters like `studentId`, `isRead`, `type`, and `createdAt`.
- Expensive offset pagination: Large `skip` values become slower because the database still walks skipped records. Cursor pagination using `createdAt` and `_id` should be used for deep scrolling.
- Fan-out pressure: A "Notify All" action can create tens of thousands of `student_notifications` documents. This should be handled asynchronously through jobs and bulk writes.
- Hot partitions: If the system grows beyond one college or a few large batches, `student_notifications` can become very large. Sharding by `studentId` or a hashed `studentId` keeps reads distributed.
- Unbounded storage growth: Old read notifications can fill storage. Use archiving plus optional TTL policies for low-value historical records.
- Large metadata fields: Storing large metadata directly inside every inbox document would waste space. The design stores full notification content once in `notifications` and per-student state in `student_notifications`.

## Scaling Strategies

- Use compound indexes that match the exact read paths: student inbox, unread inbox, type filters, and priority queries.
- Use cursor pagination for production list APIs, for example `createdAt < lastSeenCreatedAt`.
- Process bulk delivery with background workers and `insertMany` batches instead of synchronous loops.
- Cache unread counts in Redis or a `student_notification_counters` collection if count queries become a hotspot.
- Archive old notifications to cheaper storage after a retention period.
- Add sharding on `student_notifications` once data grows beyond what a single replica set can handle.
- Keep MongoDB in a replica set to support high availability and read scaling.

# Stage 3

## Query Accuracy

Given query:

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

The query is logically accurate only if the `notifications` table stores one row per student notification, including each student's `isRead` state. If the table stores only the source notification message, then the query is not accurate because read/unread state is per student and should live in a join table such as `student_notifications`.

Assuming the table does store per-student notification rows, the query returns all unread notifications for student `1042` ordered from oldest to newest.

## Why The Query Is Slow

With 5,000,000 notification rows, the query is slow if there is no index matching the filter and sort. The database may need to scan a large part of the table to find rows where `studentID = 1042` and `isRead = false`, then sort the matching rows by `createdAt`.

`SELECT *` can also add cost because it forces the database to fetch every column, even when the UI may only need notification ID, type, message, and timestamp.

## Recommended Change

Create a composite index that matches the equality filters first and the sort column last:

```sql
CREATE INDEX idx_notifications_student_read_created
ON notifications (studentID, isRead, createdAt);
```

Then fetch only the columns required by the API:

```sql
SELECT notificationID, studentID, notificationType, message, createdAt, isRead
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt ASC
LIMIT 50;
```

The index order works because `studentID` and `isRead` are equality predicates, and `createdAt` satisfies the `ORDER BY` without a separate sort.

## Likely Computation Cost

Without the composite index, the query can approach `O(N)` scanning over millions of rows, plus `O(M log M)` sorting for the matched rows, where `N` is total notifications and `M` is matched unread notifications.

With the composite index, lookup is approximately `O(log N + M)`. The database uses the index to jump to the student's unread range and reads rows already ordered by `createdAt`. With a `LIMIT`, the practical cost becomes close to `O(log N + K)`, where `K` is the requested page size.

## Should We Add Indexes On Every Column?

No. Adding indexes on every column is not effective.

Indexes improve specific read patterns, but they also have costs:

- Every insert, update, and delete must update all related indexes.
- Extra indexes consume disk and memory.
- Low-selectivity columns like `isRead` alone may not help much because they split data into only true/false groups.
- Too many indexes can confuse query planning and slow down writes.

Indexes should be designed around actual query patterns. For this API, useful indexes are compound indexes such as:

```sql
CREATE INDEX idx_notifications_student_read_created
ON notifications (studentID, isRead, createdAt);

CREATE INDEX idx_notifications_type_created_student
ON notifications (notificationType, createdAt, studentID);
```

## Query For Students Who Got Placement Notifications In The Last 7 Days

If the `notifications` table stores one row per student notification:

```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= CURRENT_TIMESTAMP - INTERVAL '7 days';
```

For MySQL syntax:

```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL 7 DAY;
```

If the schema is normalized with separate `notifications` and `student_notifications` tables:

```sql
SELECT DISTINCT sn.studentID
FROM student_notifications sn
JOIN notifications n
  ON n.notificationID = sn.notificationID
WHERE n.notificationType = 'Placement'
  AND n.createdAt >= CURRENT_TIMESTAMP - INTERVAL '7 days';
```

Recommended index for the normalized query:

```sql
CREATE INDEX idx_notifications_type_created_id
ON notifications (notificationType, createdAt, notificationID);

CREATE INDEX idx_student_notifications_notification_student
ON student_notifications (notificationID, studentID);
```

# Stage 4

## Problem

Fetching the full notification list on every page load creates repeated database reads for the same student data. As the number of students and notifications grows, this overwhelms the database, increases latency, and creates a poor user experience.

The solution should reduce unnecessary reads, make each read cheaper, and update the UI incrementally instead of reloading everything.

## Recommended Solution

Use a combination of cursor pagination, caching, unread counters, and real-time updates through Server-Sent Events.

## 1. Cursor Pagination Instead Of Full Fetches

The notification API should return only a small page of recent notifications, not the complete inbox.

```http
GET /api/v1/students/{studentId}/notifications?limit=20&cursor=2026-04-22T17:51:18.000Z
```

Query pattern:

```js
db.student_notifications.find({
  studentId: 1042,
  archived: false,
  createdAt: { $lt: new Date("2026-04-22T17:51:18.000Z") }
})
.sort({ createdAt: -1 })
.limit(20);
```

Tradeoffs:

- Pros: Smaller payloads, faster API responses, better mobile performance, no expensive deep `skip`.
- Cons: Slightly more frontend state management because the client must track the next cursor.

## 2. Cache Recent Notification Pages

Use Redis or an in-memory cache for the first page of each student's inbox:

```txt
student:{studentId}:notifications:first-page
student:{studentId}:unread-count
student:{studentId}:priority:{limit}:{type}
```

Cache invalidation should happen when:

- A new notification is delivered to the student.
- The student marks one notification as read.
- The student marks all as read.
- The student archives a notification.

Tradeoffs:

- Pros: Avoids repeated DB reads on refresh and route changes, significantly improves latency for common inbox loads.
- Cons: Requires correct invalidation. Stale caches can show outdated unread counts or old notification state if not handled carefully.

## 3. Store Precomputed Unread Counts

Maintain a `student_notification_counters` collection or Redis hash for unread counts.

```js
{
  studentId: 1042,
  totalUnread: 12,
  byType: {
    Placement: 3,
    Result: 4,
    Event: 5
  },
  updatedAt: ISODate("2026-04-22T18:10:45.000Z")
}
```

When a notification is delivered, increment the relevant counters. When a notification is marked read, decrement them atomically.

Tradeoffs:

- Pros: Notification badges become `O(1)` reads instead of repeated count queries.
- Cons: Counter consistency must be protected with atomic updates and idempotency checks, especially during retries.

## 4. Use SSE For New Notifications

Instead of fetching all notifications every time the page opens, the client should:

- Load the first page once.
- Open an SSE connection.
- Add new incoming notifications to the top of the list.
- Update unread count from event payloads.

Event example:

```text
event: notification.created
data: {"studentId":1042,"unreadCount":13,"notification":{"id":"9d6fd4dc-0f7f-46b8-98a5-f5cc8b0c85aa","type":"Placement","message":"CSX Corporation hiring","createdAt":"2026-04-22T17:51:18.000Z"}}
```

Tradeoffs:

- Pros: Near real-time updates, fewer full refreshes, better user experience.
- Cons: Requires connection management and fallback behavior for browsers or networks where long-lived connections fail.

## 5. Conditional Requests

For clients that cannot use SSE, support conditional requests using `ETag` or `Last-Modified`.

```http
GET /api/v1/students/{studentId}/notifications?limit=20
If-None-Match: "student-1042-notifications-v42"
```

If nothing changed:

```http
304 Not Modified
```

Tradeoffs:

- Pros: Reduces response payload when data has not changed.
- Cons: The request still reaches the API layer, so it is less efficient than serving from client cache or receiving SSE events.

## 6. Client-Side Cache

The frontend should cache notification pages in state and local storage or IndexedDB. On page reload, it can show cached notifications immediately, then revalidate in the background.

Tradeoffs:

- Pros: Fast perceived performance and better offline/poor-network behavior.
- Cons: The UI must clearly reconcile stale local data with fresh server data.

## 7. Background Fan-Out And Bulk Writes

For large notifications like "Notify All", the API should queue the work and return quickly. A worker should write inbox rows in batches and publish real-time events.

```txt
POST /api/v1/notifications -> create source notification -> enqueue fan-out job -> worker bulk inserts student_notifications
```

Tradeoffs:

- Pros: Keeps API responsive and prevents request timeouts.
- Cons: Notifications become eventually consistent. Some students may receive them a few seconds later depending on queue load.

## Final Architecture

- MongoDB stores durable notification and inbox state.
- Redis caches first-page inbox responses, priority inbox responses, and unread counters.
- SSE pushes new notifications and count updates to connected clients.
- Cursor pagination keeps list queries small and predictable.
- Background workers handle bulk fan-out.
- Logging Middleware records cache hits/misses, DB latency, SSE delivery failures, and job processing status.

Example logs:

```js
await Log("backend", "info", "cache", "notification first page served from cache");
await Log("backend", "warn", "service", "SSE delivery failed, client will revalidate on next request");
await Log("backend", "error", "db", "student notification query exceeded latency threshold");
```

# Stage 5

## Shortcomings In The Proposed Implementation

Original pseudocode:

```txt
function notify_all(student_ids: array, message: string):
for student_id in student_ids:
send_email(student_id, message)
save_to_db(student_id, message)
push_to_app(student_id, message)
```

Problems:

- It processes 50,000 students sequentially, so one slow email API call slows the entire operation.
- If the process crashes midway, there is no reliable record of which students completed each step.
- Email, DB write, and in-app push are coupled even though they have different reliability and latency characteristics.
- A single student's failure can block later students.
- There is no retry strategy for temporary email provider failures.
- There is no idempotency key, so retries can create duplicate emails or duplicate in-app notifications.
- There is no batch insert for database writes.
- There is no delivery status tracking.
- The HR request may time out before all work is complete.
- There is no structured logging for batch progress, failures, or retry exhaustion.

## What To Do If Email Failed For 200 Students

The system should not restart the whole `Notify All` job blindly. It should identify the 200 failed email delivery records, mark them as retryable, and enqueue only those students for retry.

Each student notification should have independent delivery state:

```js
{
  studentId: 1042,
  notificationId: ObjectId("6628f11f9f32d7df5f4f4a10"),
  inAppStatus: "delivered",
  emailStatus: "failed",
  emailAttempts: 1,
  lastError: "email provider timeout",
  nextRetryAt: ISODate("2026-04-22T18:15:00.000Z")
}
```

The retry worker should use exponential backoff and a maximum attempt count. If all retries fail, the status should become `failed_permanently`, and the failure should be visible in the job summary.

## Reliable Redesign

Use asynchronous workers and a durable queue. Redis with BullMQ is one option, but the design is queue-agnostic and could also use RabbitMQ, SQS, Kafka, or a database-backed job queue.

Flow:

- API receives the HR request.
- API creates one source notification record.
- API creates a notification job with status `queued`.
- API returns `202 Accepted` immediately.
- Worker reads the job and resolves target students.
- Worker writes `student_notifications` in batches using idempotent upserts.
- Worker enqueues email jobs in batches.
- Worker publishes real-time in-app events through SSE.
- Email worker sends emails with retry and backoff.
- Job status is updated as batches complete.

## Should Saving To DB And Sending Email Happen Together?

No, they should not happen together in one blocking operation.

Saving the in-app notification is an internal durable operation. Sending email depends on an external provider, network latency, rate limits, provider downtime, and transient failures. Coupling them means the in-app notification can fail or become slow just because the email API is slow.

The better approach is:

- Save the source notification and student inbox records durably first.
- Treat email as a separate delivery channel with its own status.
- Retry email independently.
- Make every operation idempotent so retrying does not create duplicates.

This gives eventual consistency: the in-app notification is available quickly, while email delivery may complete seconds or minutes later.

## Revised Pseudocode

```txt
function notify_all(message, notification_type, metadata):
    request_id = generate_uuid()
    log("backend", "info", "handler", "notify all request received")

    notification_id = db.notifications.insert({
        type: notification_type,
        message: message,
        metadata: metadata,
        created_at: now()
    })

    job_id = db.notification_jobs.insert({
        notification_id: notification_id,
        status: "queued",
        target_count: 0,
        processed_count: 0,
        failed_count: 0,
        request_id: request_id,
        created_at: now()
    })

    queue.enqueue("notification_fanout", {
        job_id: job_id,
        notification_id: notification_id
    })

    return {
        status: 202,
        job_id: job_id,
        message: "notification fan-out queued"
    }
```

```txt
worker notification_fanout(job):
    log("backend", "info", "service", "notification fan-out started")

    students_cursor = db.students.find_active_students_in_batches(batch_size=1000)

    for students_batch in students_cursor:
        inbox_rows = []
        email_jobs = []

        for student in students_batch:
            idempotency_key = job.notification_id + ":" + student.student_id

            inbox_rows.append({
                student_id: student.student_id,
                notification_id: job.notification_id,
                is_read: false,
                archived: false,
                in_app_status: "pending",
                email_status: "queued",
                idempotency_key: idempotency_key,
                created_at: now()
            })

            email_jobs.append({
                student_id: student.student_id,
                notification_id: job.notification_id,
                email: student.email,
                idempotency_key: idempotency_key
            })

        db.student_notifications.bulk_upsert(
            inbox_rows,
            unique_key="idempotency_key"
        )

        queue.enqueue_many("send_notification_email", email_jobs)

        sse.publish_many(students_batch, {
            event: "notification.created",
            notification_id: job.notification_id
        })

        db.notification_jobs.increment(job.job_id, {
            processed_count: len(students_batch)
        })

        log("backend", "info", "service", "notification batch processed")

    db.notification_jobs.update(job.job_id, {
        status: "completed",
        completed_at: now()
    })
```

```txt
worker send_notification_email(email_job):
    record = db.student_notifications.find_by_idempotency_key(
        email_job.idempotency_key
    )

    if record.email_status == "sent":
        return

    try:
        email_provider.send(
            to=email_job.email,
            notification_id=email_job.notification_id,
            idempotency_key=email_job.idempotency_key
        )

        db.student_notifications.update(record.id, {
            email_status: "sent",
            email_sent_at: now(),
            last_error: null
        })

        log("backend", "info", "service", "notification email sent")

    catch error:
        attempts = record.email_attempts + 1

        if attempts < 5:
            db.student_notifications.update(record.id, {
                email_status: "retrying",
                email_attempts: attempts,
                last_error: error.message,
                next_retry_at: now() + backoff(attempts)
            })

            queue.enqueue_later(
                "send_notification_email",
                email_job,
                delay=backoff(attempts)
            )

            log("backend", "warn", "service", "notification email queued for retry")

        else:
            db.student_notifications.update(record.id, {
                email_status: "failed_permanently",
                email_attempts: attempts,
                last_error: error.message
            })

            db.notification_jobs.increment(record.job_id, {
                failed_count: 1
            })

            log("backend", "error", "service", "notification email failed permanently")
```

## Reliability Guarantees

- Idempotency prevents duplicate inbox records and duplicate email sends during retries.
- Batch writes reduce database overhead.
- Queue workers allow controlled concurrency and rate limiting.
- Failed email sends are isolated from in-app notification delivery.
- The HR user receives a fast `202 Accepted` response and can track the job status later.
- Detailed logs make it possible to audit progress and debug failures.

# Stage 6

## Priority Inbox Implementation

The implementation is provided in:

```txt
backend/priorityNotifications.js
```

The script fetches notifications from the protected Notification API and computes the top 10 priority notifications. It uses the reusable Logging Middleware for important lifecycle events.

Run:

```bash
cd backend
npm run stage6
```

Required environment variable in `backend/.env`:

```txt
AFFORDMED_ACCESS_TOKEN=<access_token>
```

`LOG_AUTH_TOKEN` is also supported.

## Priority Rule

Priority is calculated from notification type and recency.

Type weights:

```txt
Placement = 3
Result = 2
Event = 1
```

Final score:

```txt
priorityScore = typeWeight * 1_000_000_000_000_000 + timestampInMilliseconds
```

This ensures placement notifications are ranked above result notifications, result notifications are ranked above event notifications, and newer notifications rank higher within the same type.

## Output

The script prints:

- A table containing rank, type, message, timestamp, and type weight.
- A JSON object containing the top 10 priority notifications and their computed score.

## Efficient Top 10 Maintenance

If new notifications keep arriving, the application should not sort the entire notification list every time. Instead, maintain a min-heap of size `10`.

Algorithm:

- Compute the priority score for each incoming notification.
- If the heap has fewer than 10 items, insert the notification.
- If the heap has 10 items and the new notification score is greater than the smallest item, remove the smallest item and insert the new notification.
- If the new notification score is lower than the smallest item, ignore it.

Complexity:

```txt
Initial build: O(n log 10), effectively O(n)
New notification update: O(log 10), effectively O(1)
Memory: O(10)
```

For a production system with per-student priority inboxes, the heap can be maintained in memory for active sessions and persisted or rebuilt from MongoDB/Redis when the user reconnects.
