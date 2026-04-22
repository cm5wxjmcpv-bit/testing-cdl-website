// ==============================
// TRAINING SITE CONFIG
// ==============================

// Google Apps Script API
const APP_SCRIPT_URL =
"https://script.google.com/macros/s/AKfycby-xfirOFVh_RAS3CdkM6TQsR9oR5rRuo-hzrqcmyhG8ktRZjE2MDFWXRhwQxSkUtj8Pw/exec";

// backward compatibility
const SHEETS_API_URL = APP_SCRIPT_URL;


// ==============================
// DEMO USERS
// ==============================

const USERS = [
  {
    username: "student1",
    password: "1234",
    role: "student"
  },
  {
    username: "student2",
    password: "1234",
    role: "student"
  }
];


// ==============================
// MODULES
// ==============================

const MODULES = [
  {
    id: 1,
    title: "Module 1 — Introduction",
    youtubeId: "-qXt8htJ9h4"
  },
  {
    id: 2,
    title: "Module 2 — Safety & Inspection",
    youtubeId: "RS4K5FCL988"
  },
  {
    id: 3,
    title: "Module 3 — Basic Operations",
    youtubeId: "TLeq0WikSmU"
  },
  {
    id: 4,
    title: "Module 4 — Advanced Driving",
    youtubeId: "cMML4tQdVvY"
  }
];


// percent of video required before completion
const REQUIRED_WATCH_PERCENT = 0.9;
