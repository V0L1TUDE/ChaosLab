// Temporary in-memory data "store" — a plain array, not a database.
//
// This exists so the API and the admin dashboard have something real to
// read from instead of hardcoded HTML. In Phase 4 this file gets replaced
// by actual SQLite queries; every value here (title, version, date, ...)
// maps directly onto what will become a "presentations" table.
//
// Because this is just a JS array living in server memory, it resets
// every time the server restarts — nothing here is really "saved" yet.

const presentations = [
  {
    title: "Planning Presentation",
    version: "v1",
    date: "2026-08-10",
    authors: "ChaosLab Team",
    status: "published",
    url: "/ChaosLab/presentations/planning-v1/",
  },
  {
    title: "Planning Presentation",
    version: "v2",
    date: null,
    authors: "ChaosLab Team",
    status: "not_published",
    url: null,
  },
];

module.exports = { presentations };
