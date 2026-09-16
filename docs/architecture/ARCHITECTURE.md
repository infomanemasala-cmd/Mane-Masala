# Mane Masala — Approved Architecture

- Application: Next.js + React + TypeScript
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- File storage: Supabase Storage
- Source control: GitHub
- Hosting: Vercel
- Design: Figma
- Responsive target: mobile/tablet first, responsive desktop
- Business source of truth: Mane Masala application + Supabase

Current repository: `infomanemasala-cmd/Mane-Masala`, default branch `main`.
Supabase project: `fogdwzpfudbktncajesk` (Mumbai/ap-south-1; PostgreSQL 17 as previously verified).

Critical business operations should use controlled server/database functions where designed. Do not guess RPC signatures or directly manipulate stock/financial records from the browser when a controlled business operation exists.
