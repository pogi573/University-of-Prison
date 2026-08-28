const loginView = document.getElementById("loginView");
const welcomeView = document.getElementById("welcomeView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const tokenKey = "school_session_token";
const apiBase = window.location.port === "3000" ? "" : "http://localhost:3000";
let students = [];
let editingStudentId = null;
let currentUser = null;
let announcements = [];

function setMessage(element, text, error = false) {
    element.textContent = text;
    element.classList.toggle("error", error);
}

function showDashboard(user) {
    currentUser = user;
    loginView.classList.add("hidden");
    dashboardView.classList.add("hidden");
    welcomeView.classList.remove("hidden");
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
    const role = user.role[0].toUpperCase() + user.role.slice(1);
    document.getElementById("welcomeName").textContent = name;
    document.getElementById("welcomeRole").textContent = `${role} portal`;
    window.setTimeout(() => {
        welcomeView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
        showSection("profileSection");
        document.getElementById("dashboardTitle").textContent = `${role} dashboard`;
        document.getElementById("userBadge").textContent = `${name} · ${user.email}`;
        configureRoleNavigation(user);
        updateProfile(user);
        configureAnnouncementPage(user);
        loadAnnouncements();
        loadDashboard();
    }, 1800);
}

function configureAnnouncementPage(user) {
    document.getElementById("teacherAnnouncementForm").classList.toggle("hidden", !["admin", "teacher"].includes(user.role));
}

function renderAnnouncements() {
    const list = document.getElementById("announcementList");
    list.replaceChildren();
    if (!announcements.length) {
        const empty = document.createElement("p");
        empty.className = "message";
        empty.textContent = "No announcements yet.";
        list.appendChild(empty);
        return;
    }
    announcements.forEach((announcement) => {
        const item = document.createElement("article");
        item.className = "posted-announcement";
        const date = new Date(announcement.announcement_date || announcement.created_at);
        item.innerHTML = `<div class="posted-announcement-date"><strong>${date.getDate()}</strong><span>${date.toLocaleString("en-US", { month: "short" }).toUpperCase()}</span></div><div><span class="activity-type">${announcement.author}</span><h3></h3><p></p><small>${date.toLocaleString()}</small></div>`;
        item.querySelector("h3").textContent = announcement.title;
        item.querySelector("p").textContent = announcement.message;
        list.appendChild(item);
    });
}

async function loadAnnouncements() {
    try {
        const data = await api("/api/announcements");
        announcements = data.announcements;
        renderAnnouncements();
    } catch (error) {
        setMessage(document.getElementById("announcementList"), error.message, true);
    }
}

function configureRoleNavigation(user) {
    document.querySelectorAll(".nav-button").forEach((button) => {
        button.classList.toggle("role-admin-only", button.dataset.section === "overviewSection" || button.dataset.section === "aboutSection");
        button.classList.toggle("role-teacher-only", button.dataset.section === "classesSection" || button.dataset.section === "activitiesSection");
    });
    document.querySelector('[data-section="aboutSection"]').classList.remove("hidden");
    document.getElementById("dashboardTitle").textContent = user.role === "student" ? "Student portal" : `${user.role[0].toUpperCase()}${user.role.slice(1)} dashboard`;
}

function updateProfile(user, student = null) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
    const role = user.role[0].toUpperCase() + user.role.slice(1);
    document.getElementById("profileName").textContent = name;
    document.getElementById("profileRole").textContent = `${role} account`;
    document.getElementById("profileUsername").textContent = user.username;
    document.getElementById("profileEmail").textContent = user.email;
    document.getElementById("profileAccountType").textContent = role;
    document.getElementById("profileId").textContent = student ? student.student_id : `UP-${String(user.id).padStart(3, "0")}`;
    document.getElementById("profileIdLabel").textContent = student ? "Student ID" : "Account ID";
    document.getElementById("profileAvatar").textContent = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    document.getElementById("profileDescription").textContent = user.role === "admin" ? "You can manage student records and monitor the university directory." : user.role === "teacher" ? "You have access to your teaching workspace, class catalog, and campus activities." : "Your student workspace includes your classes, campus activities, and profile information.";
}

function showSection(sectionId) {
    document.querySelectorAll(".nav-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.section === sectionId);
    });
    document.querySelectorAll(".dashboard-section").forEach((section) => {
        section.classList.toggle("hidden", section.id !== sectionId);
    });
}

function renderStudents() {
    const query = document.getElementById("studentSearch").value.trim().toLowerCase();
    const visibleStudents = students.filter((student) => `${student.student_id} ${student.first_name} ${student.last_name}`.toLowerCase().includes(query));
    const table = document.getElementById("studentTable");
    table.replaceChildren();
    if (!visibleStudents.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.className = "empty";
        cell.textContent = query ? "No matching students." : "No students found.";
        row.appendChild(cell);
        table.appendChild(row);
        return;
    }
    visibleStudents.forEach((student) => {
        const row = document.createElement("tr");
        [student.student_id, `${student.first_name} ${student.last_name}`, student.gender || "-", student.phone || "-"].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        if (document.getElementById("addStudentButton").classList.contains("hidden") === false) {
            const actions = document.createElement("td");
            actions.className = "row-actions";
            const editButton = document.createElement("button");
            editButton.className = "text-button";
            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => openStudentDialog(student));
            const deleteButton = document.createElement("button");
            deleteButton.className = "text-button danger";
            deleteButton.type = "button";
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => deleteStudent(student));
            actions.append(editButton, deleteButton);
            row.appendChild(actions);
        }
        table.appendChild(row);
    });
}

async function api(path, options = {}) {
    const token = sessionStorage.getItem(tokenKey);
    let response;
    try {
        response = await fetch(`${apiBase}${path}`, {
            ...options,
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
        });
    } catch (error) {
        throw new Error("Cannot connect to the server. Run npm start first.");
    }
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : {};
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(loginMessage, "Signing in...");
    const form = new FormData(loginForm);
    try {
        const data = await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
        sessionStorage.setItem(tokenKey, data.token);
        showDashboard(data.user);
    } catch (error) {
        setMessage(loginMessage, error.message, true);
    }
});

async function loadDashboard() {
    try {
        const data = await api("/api/dashboard");
        document.getElementById("studentCount").textContent = data.counts.students;
        document.getElementById("teacherCount").textContent = data.counts.teachers;
        document.getElementById("userCount").textContent = data.counts.users;
        students = data.students;
        if (currentUser?.role === "student") updateProfile(currentUser, students[0]);
        document.getElementById("addStudentButton").classList.toggle("hidden", !data.canManageStudents);
        document.querySelector("#studentTable").closest("table").querySelector("thead tr").lastElementChild.classList.toggle("hidden", !data.canManageStudents);
        renderStudents();
    } catch (error) {
        setMessage(document.getElementById("tableMessage"), error.message, true);
    }
}

document.getElementById("logoutButton").addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST" }); } catch (error) { console.error(error); }
    sessionStorage.removeItem(tokenKey);
    dashboardView.classList.add("hidden");
    welcomeView.classList.add("hidden");
    loginView.classList.remove("hidden");
    loginForm.reset();
});

document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
        showSection(button.dataset.section);
    });
});

document.getElementById("teacherAnnouncementForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector("button[type=submit]");
    submitButton.disabled = true;
    setMessage(document.getElementById("announcementMessageStatus"), "Posting...");
    try {
        await api("/api/announcements", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        form.reset();
        setMessage(document.getElementById("announcementMessageStatus"), "Announcement posted successfully.");
        await loadAnnouncements();
    } catch (error) {
        setMessage(document.getElementById("announcementMessageStatus"), error.message, true);
    } finally {
        submitButton.disabled = false;
    }
});

function openStudentDialog(student = null) {
    editingStudentId = student ? student.id : null;
    document.getElementById("studentForm").reset();
    document.getElementById("dialogEyebrow").textContent = student ? "EDIT RECORD" : "NEW RECORD";
    document.getElementById("dialogTitle").textContent = student ? "Edit student" : "Add student";
    document.getElementById("usernameField").classList.toggle("hidden", Boolean(student));
    document.getElementById("passwordField").classList.toggle("hidden", Boolean(student));
    if (student) {
        Object.entries(student).forEach(([key, value]) => {
            const field = document.querySelector(`[name="${key}"]`);
            if (field) field.value = value || "";
        });
    }
    document.getElementById("formMessage").textContent = "";
    document.getElementById("studentDialog").showModal();
}

async function deleteStudent(student) {
    if (!window.confirm(`Delete ${student.first_name} ${student.last_name}?`)) return;
    try {
        await api(`/api/students/${student.id}`, { method: "DELETE" });
        setMessage(document.getElementById("tableMessage"), "Student deleted successfully.");
        await loadDashboard();
    } catch (error) {
        setMessage(document.getElementById("tableMessage"), error.message, true);
    }
}

document.getElementById("addStudentButton").addEventListener("click", () => openStudentDialog());
document.getElementById("studentSearch").addEventListener("input", renderStudents);
document.getElementById("closeDialogButton").addEventListener("click", () => document.getElementById("studentDialog").close());
document.getElementById("cancelDialogButton").addEventListener("click", () => document.getElementById("studentDialog").close());
document.getElementById("studentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveButton = document.getElementById("saveStudentButton");
    saveButton.disabled = true;
    setMessage(document.getElementById("formMessage"), "Saving...");
    try {
        const payload = Object.fromEntries(new FormData(event.currentTarget));
        await api(editingStudentId ? `/api/students/${editingStudentId}` : "/api/students", {
            method: editingStudentId ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });
        document.getElementById("studentDialog").close();
        setMessage(document.getElementById("tableMessage"), editingStudentId ? "Student updated successfully." : "Student added successfully.");
        await loadDashboard();
    } catch (error) {
        setMessage(document.getElementById("formMessage"), error.message, true);
    } finally {
        saveButton.disabled = false;
    }
});

(async function restoreSession() {
    if (!sessionStorage.getItem(tokenKey)) return;
    try { const data = await api("/api/me"); showDashboard(data.user); }
    catch (error) { sessionStorage.removeItem(tokenKey); }
})();
