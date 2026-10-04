const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyCaseCode } = require('../utils/caseCode');
const verifyApiKey = require('../middleware/auth');

router.get('/reports', verifyApiKey, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const reports = db.prepare(`
      SELECT id, case_code_hash, category, description, evidence_url, status, created_at
      FROM reports
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const reportsWithoutHash = reports.map(({ case_code_hash, ...rest }) => rest);

    res.json(reportsWithoutHash);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.get('/reports/:caseCode', verifyApiKey, async (req, res) => {
  const { caseCode } = req.params;

  if (!caseCode || caseCode.length < 8) {
    return res.status(400).json({ error: 'Invalid case code' });
  }

  try {
    const allReports = db.prepare(`
      SELECT id, case_code_hash, category, description, evidence_url, status, created_at
      FROM reports
    `).all();

    let matchedReport = null;
    for (const report of allReports) {
      const isMatch = await verifyCaseCode(caseCode, report.case_code_hash);
      if (isMatch) {
        matchedReport = report;
        break;
      }
    }

    if (!matchedReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const { case_code_hash, ...reportWithoutHash } = matchedReport;

    const updates = db.prepare(`
      SELECT note, updated_at FROM status_updates
      WHERE report_id = ?
      ORDER BY updated_at ASC
    `).all(matchedReport.id);

    res.json({
      ...reportWithoutHash,
      updates: updates.map(u => ({ note: u.note, updatedAt: u.updatedAt }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

router.put('/reports/:caseCode/status', verifyApiKey, async (req, res) => {
  const { caseCode } = req.params;
  const { status, note } = req.body;

  if (!caseCode || caseCode.length < 8) {
    return res.status(400).json({ error: 'Invalid case code' });
  }
  if (!status || typeof status !== 'string') {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const allReports = db.prepare(`
      SELECT id, case_code_hash FROM reports
    `).all();

    let matchedReport = null;
    for (const report of allReports) {
      const isMatch = await verifyCaseCode(caseCode, report.case_code_hash);
      if (isMatch) {
        matchedReport = report;
        break;
      }
    }

    if (!matchedReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const stmt = db.prepare(`
      UPDATE reports SET status = ? WHERE id = ?
    `);
    stmt.run(status, matchedReport.id);

    if (note && typeof note === 'string' && note.trim().length > 0) {
      const updatedAt = new Date().toISOString();
      const noteStmt = db.prepare(`
        INSERT INTO status_updates (report_id, note, updated_at)
        VALUES (?, ?, ?)
      `);
      noteStmt.run(matchedReport.id, note.trim(), updatedAt);
    }

    res.json({ message: 'Report status updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

module.exports = router;