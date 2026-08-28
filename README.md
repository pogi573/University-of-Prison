# University of Prison

## Run locally

MySQL must be running on port 3306. The project includes a local MySQL data directory in `.mysql-data` when it is initialized on this machine.

```powershell
cd "c:\Users\User\OneDrive\Full WebPag with data base\index.html"
npm.cmd install
npm.cmd run db:init
npm.cmd run seed
npm.cmd start
```

Open `http://localhost:3000/` in Chrome. Do not open the HTML with `file://`.

For this development setup, the default MySQL configuration is `root` with an empty password. Update `.env` if your MySQL account uses a password.

## Demo accounts

- Admin: `admin` / `Admin@123`
- Teacher: `teacher` / `Teacher@123`
- Student: `student` / `Student@123`

Admins can add, edit, search, and delete students. Teachers and students have read-only, role-scoped dashboard access.

## One-click local start

Run `run.bat` from this folder. It starts the project-local MySQL instance and the Express server.
