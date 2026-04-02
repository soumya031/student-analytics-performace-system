# Metabase Setup

This repository now includes a local Metabase setup for the teacher-side reference dashboard.

## Start

1. Copy `.env.example` to `.env`.
2. Run:

```powershell
docker compose up -d
```

from the [`metabase`](c:/Users/soura/student-analytics-performace-system/metabase) folder.

## Connect MongoDB

In Metabase, add a database connection using:

- Database type: `MongoDB`
- Host: your MongoDB host
- Database name: `student_analytics`

If you run Mongo locally with the backend defaults, use your local MongoDB instance and the database name above.

## Frontend Link

Set `REACT_APP_METABASE_URL=http://localhost:3001` in the frontend environment so the teacher analytics page can open Metabase directly.
