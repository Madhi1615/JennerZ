# Faculty Assessment Management System

**Assessment, Rubric & CO Analysis Portal**

A complete, production-ready web application for managing 15 assessment tools across 40 students, including CO mapping, CO weightage, customizable rubrics, rubric-wise mark entry, automatic calculations, CO/student analysis, reports, CSV export, JSON backup, and browser-local data storage.

No backend, no database, no build step required — pure HTML5, CSS3 and vanilla JavaScript (ES6+). All data is stored in the browser's `localStorage`.

---

## Features

- Subject Setup (name, code, academic year, faculty, configurable pass mark)
- CO Weightage editor (CO1–CO5, must total exactly 100, decimals supported)
- Student roster management (up to 40 students, unique register numbers, CSV import, search)
- 15 configurable assessment tools with CO mapping and a rubric builder (rubric totals must equal exactly 100)
- Rubric-wise mark entry with automatic totals, validation, and autosave
- Dashboard with class-wide statistics and charts
- CO Analysis with weighted contribution and overall weighted CO score
- Student Analysis with per-assessment breakdown and performance chart
- CSV exports (assessment marks, all-assessment summary, class analysis, CO analysis)
- JSON backup and restore
- Print-friendly assessment and CO reports
- Light / dark mode
- Fully responsive (desktop, tablet, mobile with hamburger navigation)
- Sample/demo data loader for quick testing

## File Structure

```text
.
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── storage.js        (state model, persistence, toasts, modals)
│   ├── students.js        (student roster)
│   ├── assessments.js     (assessment + rubric configuration)
│   ├── marks.js            (rubric mark entry)
│   ├── analysis.js         (calculations, dashboard, CO & student analysis, charts)
│   ├── export.js           (CSV, JSON backup, print reports, sample data)
│   └── app.js               (navigation, subject setup, settings, reports page, init)
├── .github/workflows/deploy-pages.yml  (GitHub Pages deployment)
└── README.md
```

## Running Locally

No installation needed. Just open `index.html` directly in a modern browser (Chrome, Edge, Firefox, Safari):

1. Download or clone the project folder.
2. Double-click `index.html`, or drag it into a browser window.
3. The app loads immediately. All data you enter is saved automatically to that browser's local storage.

> Note: Chart.js is loaded from a CDN for the dashboard/analysis charts. If there is no internet connection, every other feature still works — the chart areas will simply show a message instead of a graph.

## Uploading to GitHub

1. Create a new repository on GitHub (e.g. `faculty-assessment-system`).
2. Upload `index.html`.
3. Upload the `css/style.css` file (keep the `css` folder).
4. Upload all files inside `js/` (keep the `js` folder).
5. Upload `README.md`.
6. Commit the changes.

## Deploying with GitHub Pages

This repository includes `.github/workflows/deploy-pages.yml`, which publishes the site automatically on every push to `main`.

1. In your repository, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions** (one-time setup).
3. Push to `main` (or run the workflow manually from the **Actions** tab). The workflow builds and deploys automatically.
4. GitHub will generate a URL such as `https://<username>.github.io/<repo>/`. It also appears on the **Actions** tab run summary and under **Settings → Pages**.

## Deploying on Render (Static Site)

1. In Render, choose **New → Static Site**.
2. Connect the GitHub repository.
3. Build command: `None` (leave empty).
4. Publish directory: `.` (the repository root).
5. Deploy. Render will serve `index.html` directly.

## Data & Privacy

All subject, student, assessment and mark data is stored **only** in the browser's local storage on the device being used — nothing is sent to a server. Because local storage can be cleared (e.g. by clearing browsing data), use **Reports & Backup → Export JSON Backup** regularly, and keep the file somewhere safe. Use **Import JSON Backup** to restore it on the same or a different device/browser.

## Testing Checklist

The application has been designed to support the following workflow:

1. Create a subject and set the pass mark.
2. Enter CO weightage (e.g. 20/20/20/20/20) and confirm it shows **100 / 100 ✓**.
3. Add up to 40 students (individually or via CSV import).
4. Configure an assessment: set its name, CO, and rubric criteria totaling exactly 100.
5. Enter rubric-wise marks for students; totals and PASS/FAIL status update automatically.
6. Mark a student absent and confirm they are excluded from pass/fail/average calculations.
7. Review the Dashboard, CO Analysis and Student Analysis pages.
8. Export CSV reports and open them in Excel/Sheets.
9. Export a JSON backup, clear all data, then import the backup and confirm everything returns.
10. Refresh the browser and confirm all data persists.
