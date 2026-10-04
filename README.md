# WhistleDrop Backend

A small Node.js/Express API where people can report problems anonymously.
Uses SQLite for storage.

When you submit a report you get a case code back. Come back with that code
later and you can read your report or add notes to it, each one timestamped.
Moderators can see every report and change its status, but they need an API key.

## Running it

You need Node installed.

    npm install

Make a `.env` file:

    PORT=4000
    API_KEY=pick-something-random

Then `npm start` (or `node src/server.js`).

## Routes

- `POST /reports` - submit a report (anyone)
- `GET /reports/:caseCode` - look up your report
- `POST /reports/:caseCode/note` - add a note to it
- `GET /moderator/reports` - see all reports, needs an `x-api-key` header

Quick test:

    curl -X POST http://localhost:4000/reports \
      -H "Content-Type: application/json" \
      -d '{"category":"Harassment","description":"Inappropriate comments in workspace"}'

Use the case code from the response for the note route.

## Code layout

- `src/server.js` - starts the server
- `src/routes/reports.js` and `moderator.js` - the routes above
- `src/middleware/auth.js` - checks the API key
- `src/utils/caseCode.js` - makes and checks case codes
- `src/db.js` - sets up the database

## Notes

I only store a hash of each case code, not the code itself. That way, if
someone gets hold of the database, they still can't open anyone's report.

The note feature was my own addition. I figured people would want to add
updates after reporting, like "HR got back to me".

Auth is just a single API key in `.env`. Fine for a project like this, but
I wouldn't use it as it is in production.
