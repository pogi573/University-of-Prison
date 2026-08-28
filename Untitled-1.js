const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function createUsers() {

    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {

        // =========================
        // ADMIN
        // =========================

        const adminPassword =
            await bcrypt.hash("Admin@123", 10);

        const [admin] = await db.execute(
            `INSERT INTO users
            (username, email, password, role, status)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
            [
                "admin",
                "admin@school.com",
                adminPassword,
                "admin",
                "active"
            ]
        );

        console.log("Admin account created.");

        // =========================
        // TEACHER
        // =========================

        const teacherPassword = await bcrypt.hash("Teacher@123", 10);
        const teachers = [
            ["teacher", "teacher@school.com", "TCH-001", "Juan", "Dela Cruz", "Male"],
            ["instructor2", "instructor2@school.com", "TCH-002", "Maria", "Santos", "Female"],
            ["instructor3", "instructor3@school.com", "TCH-003", "Carlo", "Reyes", "Male"],
            ["instructor4", "instructor4@school.com", "TCH-004", "Ana", "Garcia", "Female"],
            ["instructor5", "instructor5@school.com", "TCH-005", "Mark", "Bautista", "Male"],
            ["instructor6", "instructor6@school.com", "TCH-006", "Liza", "Navarro", "Female"]
        ];

        for (const [username, email, teacherId, firstName, lastName, gender] of teachers) {
            const [teacher] = await db.execute(
                `INSERT INTO users (username, email, password, role, status)
                 VALUES (?, ?, ?, 'teacher', 'active')
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
                [username, email, teacherPassword]
            );
            await db.execute(
                `INSERT INTO teachers (user_id, teacher_id, first_name, last_name, gender)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), first_name = VALUES(first_name), last_name = VALUES(last_name), gender = VALUES(gender)`,
                [teacher.insertId, teacherId, firstName, lastName, gender]
            );
        }

        console.log("Six instructor accounts created.");

        // =========================
        // STUDENT
        // =========================

        const studentPassword =
            await bcrypt.hash("Student@123", 10);

        const [student] = await db.execute(
            `INSERT INTO users
            (username, email, password, role, status)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
            [
                "student",
                "student@school.com",
                studentPassword,
                "student",
                "active"
            ]
        );

        await db.execute(
            `INSERT INTO students
            (user_id, student_id, first_name, last_name, gender)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
            [
                student.insertId,
                "STU-001",
                "Maria",
                "Student",
                "Female"
            ]
        );

        console.log("Student account created.");

        const announcements = [
            ["Midterm examination schedule", "The midterm examination schedule is now available. Please review your subjects and prepare ahead of time.", "2026-09-05"],
            ["Library hours extended", "The university library will stay open until 8:00 PM during examination week.", "2026-09-17"],
            ["Student ID renewal", "Students with damaged or expired IDs may visit the registrar for renewal this week.", "2026-09-29"],
            ["Network laboratory maintenance", "The network laboratory will be unavailable on Friday morning for scheduled equipment maintenance.", "2026-10-08"],
            ["Scholarship orientation", "Students interested in scholarship opportunities may attend the orientation at the Lecture Hall.", "2026-10-19"]
        ];
        for (const [title, message, announcementDate] of announcements) {
            await db.execute(
                `INSERT INTO announcements (user_id, title, message, announcement_date)
                 SELECT ?, ?, ?, ? FROM DUAL
                 WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = ? LIMIT 1)`,
                [teacher.insertId, title, message, announcementDate, title]
            );
        }

    } catch (error) {

        console.error(
            "Error:",
            error.message
        );
        process.exitCode = 1;

    } finally {

        await db.end();

    }
}

createUsers();