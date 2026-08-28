const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json({ success: false, message: "Request body must be valid JSON." });
    }
    next(error);
});

const sessions = new Map();

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "school_management",
    waitForConnections: true,
    connectionLimit: 10
});

app.get("/api/test", async (req, res) => {
    try {
        const [result] = await db.query(
            "SELECT 1 AS test"
        );

        res.json({
            success: true,
            message: "Node.js and MySQL are connected!",
            result
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

function getToken(req) {
    const header = req.get("authorization") || "";
    return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function requireAuth(req, res, next) {
    const token = getToken(req);
    const user = token ? sessions.get(token) : null;

    if (!user) {
        return res.status(401).json({ success: false, message: "Please log in first." });
    }

    req.user = user;
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "You do not have permission for this action." });
        }
        next();
    };
}

function validateStudent(input) {
    const student = {
        student_id: String(input.student_id || "").trim(),
        username: String(input.username || "").trim(),
        email: String(input.email || "").trim(),
        password: String(input.password || ""),
        first_name: String(input.first_name || "").trim(),
        last_name: String(input.last_name || "").trim(),
        gender: String(input.gender || "").trim(),
        phone: String(input.phone || "").trim(),
        activities: String(input.activities || "").trim()
    };

    if (!student.student_id || !student.username || !student.email || !student.first_name || !student.last_name) {
        return { error: "Student ID, username, email, first name, and last name are required." };
    }
    if (!/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(student.email)) {
        return { error: "Enter a valid email address." };
    }
    if (student.password && student.password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }
    if (student.student_id.length > 50 || student.username.length > 50 || student.first_name.length > 100 || student.last_name.length > 100) {
        return { error: "One or more fields are too long." };
    }
    return { student };
}

app.post("/api/login", async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: "Username, password, and role are required." });
    }

    try {
        const [users] = await db.execute(
                    `SELECT users.id, users.username, users.email, users.password, users.role, users.status,
                        students.first_name AS student_first_name, students.last_name AS student_last_name,
                        teachers.first_name AS teacher_first_name, teachers.last_name AS teacher_last_name
                     FROM users LEFT JOIN students ON students.user_id = users.id
                     LEFT JOIN teachers ON teachers.user_id = users.id
                 WHERE users.username = ? AND users.role = ? LIMIT 1`,
            [username.trim(), role]
        );
        const user = users[0];

        if (!user || user.status !== "active" || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: "Invalid login details." });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const safeUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            first_name: user.student_first_name || user.teacher_first_name || "",
            last_name: user.student_last_name || user.teacher_last_name || ""
        };
        sessions.set(token, safeUser);

        res.json({ success: true, token, user: safeUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Login failed. Check the database connection." });
    }
});

app.post("/api/logout", requireAuth, (req, res) => {
    sessions.delete(getToken(req));
    res.json({ success: true });
});

app.get("/api/me", requireAuth, (req, res) => {
    res.json({ success: true, user: req.user });
});

app.get("/api/announcements", requireAuth, async (req, res) => {
    try {
        const [announcements] = await db.query(
            `SELECT announcements.id, announcements.title, announcements.message, announcements.announcement_date, announcements.created_at,
                    COALESCE(CONCAT(teachers.first_name, ' ', teachers.last_name), users.username) AS author
             FROM announcements JOIN users ON users.id = announcements.user_id
             LEFT JOIN teachers ON teachers.user_id = users.id
             ORDER BY announcements.created_at DESC`
        );
        res.json({ success: true, announcements });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not load announcements." });
    }
});

app.post("/api/announcements", requireAuth, requireRole("admin", "teacher"), async (req, res) => {
    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    const announcementDate = String(req.body.announcement_date || "").trim();
    if (!title || !message || !announcementDate) return res.status(400).json({ success: false, message: "Title, message, and date are required." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(announcementDate)) return res.status(400).json({ success: false, message: "Enter a valid announcement date." });
    if (title.length > 150 || message.length > 2000) return res.status(400).json({ success: false, message: "Announcement is too long." });
    try {
        await db.execute("INSERT INTO announcements (user_id, title, message, announcement_date) VALUES (?, ?, ?, ?)", [req.user.id, title, message, announcementDate]);
        res.status(201).json({ success: true, message: "Announcement posted successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not post announcement." });
    }
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
        let counts = { students: 0, teachers: 0, users: 0 };
        let students;
        if (req.user.role === "admin") {
            const [[studentCount]] = await db.query("SELECT COUNT(*) AS total FROM students");
            const [[teacherCount]] = await db.query("SELECT COUNT(*) AS total FROM teachers");
            const [[userCount]] = await db.query("SELECT COUNT(*) AS total FROM users");
            counts = { students: studentCount.total, teachers: teacherCount.total, users: userCount.total };
            [students] = await db.query(
                `SELECT students.id, student_id, first_name, last_name, gender, phone, activities, email
                 FROM students JOIN users ON users.id = students.user_id ORDER BY students.id DESC`
            );
        } else if (req.user.role === "student") {
            [students] = await db.query(
                `SELECT students.id, student_id, first_name, last_name, gender, phone, activities, users.email
                 FROM students JOIN users ON users.id = students.user_id WHERE users.id = ?`,
                [req.user.id]
            );
        } else {
            [students] = await db.query(
                `SELECT students.id, student_id, first_name, last_name, gender, phone, activities, users.email
                 FROM students JOIN users ON users.id = students.user_id ORDER BY students.id DESC`
            );
        }

        res.json({
            success: true,
            counts,
            students,
            canManageStudents: req.user.role === "admin"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not load dashboard data." });
    }
});

app.post("/api/students", requireAuth, requireRole("admin"), async (req, res) => {
    const validation = validateStudent(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const { student } = validation;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const passwordHash = await bcrypt.hash(student.password || "Student@123", 10);
        const [user] = await connection.execute(
            `INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, 'student', 'active')`,
            [student.username, student.email, passwordHash]
        );
        await connection.execute(
            `INSERT INTO students (user_id, student_id, first_name, last_name, gender, phone, activities) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user.insertId, student.student_id, student.first_name, student.last_name, student.gender || null, student.phone || null, student.activities || null]
        );
        await connection.commit();
        res.status(201).json({ success: true, message: "Student added successfully." });
    } catch (error) {
        await connection.rollback();
        const duplicate = error.code === "ER_DUP_ENTRY";
        res.status(duplicate ? 409 : 500).json({ success: false, message: duplicate ? "Student ID, username, or email already exists." : "Could not add student." });
    } finally {
        connection.release();
    }
});

app.put("/api/students/:id", requireAuth, requireRole("admin"), async (req, res) => {
    const validation = validateStudent({ ...req.body, username: "ok", email: "valid@example.com" });
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const { student } = validation;
    try {
        const [result] = await db.execute(
            `UPDATE students SET student_id = ?, first_name = ?, last_name = ?, gender = ?, phone = ?, activities = ? WHERE id = ?`,
            [student.student_id, student.first_name, student.last_name, student.gender || null, student.phone || null, student.activities || null, req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: "Student not found." });
        await db.execute("UPDATE users SET email = ? WHERE id = (SELECT user_id FROM students WHERE id = ?)", [student.email, req.params.id]);
        res.json({ success: true, message: "Student updated successfully." });
    } catch (error) {
        const duplicate = error.code === "ER_DUP_ENTRY";
        res.status(duplicate ? 409 : 500).json({ success: false, message: duplicate ? "Student ID or email already exists." : "Could not update student." });
    }
});

app.delete("/api/students/:id", requireAuth, requireRole("admin"), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [students] = await connection.execute("SELECT user_id FROM students WHERE id = ?", [req.params.id]);
        if (!students[0]) return res.status(404).json({ success: false, message: "Student not found." });
        await connection.execute("DELETE FROM users WHERE id = ?", [students[0].user_id]);
        await connection.commit();
        res.json({ success: true, message: "Student deleted successfully." });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: "Could not delete student." });
    } finally {
        connection.release();
    }
});

app.get("/api/students", requireAuth, requireRole("admin"), async (req, res) => {
    try {
        const [students] = await db.query(
            `SELECT students.id, student_id, first_name, last_name, gender, birth_date, address, phone, activities, users.email
             FROM students JOIN users ON users.id = students.user_id ORDER BY students.id DESC`
        );
        res.json({ success: true, students });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not retrieve students." });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Untitled-1.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    try {
        await db.query("SELECT 1");
        console.log("MySQL connection ready.");
    } catch (error) {
        console.error(`MySQL connection failed: ${error.message}`);
        console.error("Check MySQL, .env credentials, and run the SQL schema before logging in.");
    }
});