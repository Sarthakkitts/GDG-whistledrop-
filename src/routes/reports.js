const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateCaseCode, hashCaseCode, verifyCaseCode } = require('../utils/caseCode');

const VALID_CATEGORIES = ['Security', 'Harassment', 'Corruption', 'Technical', 'Other'];


router.post('/', async (req, res) => {
  const { category, description, evidenceUrl } = req.body;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid or missing category' });
  }
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const caseCode = generateCaseCode();
  const caseCodeHash = await hashCaseCode(caseCode);
  const createdAt = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO reports (case_code_hash, category, description, evidence_url, status, created_at)
      VALUES (?, ?, ?, ?, 'SUBMITTED', ?)
    `);
    stmt.run(caseCodeHash, category, description.trim(), evidenceUrl || null, createdAt);


    res.status(201).json({
      message: 'Report submitted successfully',
      caseCode,
      status: 'SUBMITTED'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});
router.get('/:caseCode', async (req, res) => {
  const { caseCode } = req.params;

  if (!caseCode || caseCode.length < 8) {
    return res.status(400).json({ error: 'Invalid case code' });
  }

  try {
    const allReports = db.prepare(`
      SELECT id, case_code_hash, category, status, created_at FROM reports
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

    const updates = db.prepare(`
      SELECT note, updated_at FROM status_updates WHERE report_id = ? ORDER BY updated_at ASC
    `).all(matchedReport.id);

    res.json({
      category: matchedReport.category,
      status: matchedReport.status,
      createdAt: matchedReport.created_at,
      updates: updates.map(u => ({ note: u.note, updatedAt: u.updated_at }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report status' });
  }
});


router.post('/:caseCode/note', async (req, res) => {
  const { caseCode } = req.params;
  const { note } = req.body;

  if (!caseCode || caseCode.length < 8) {
    return res.status(400).json({ error: 'Invalid case code' });
  }
  if (!note || typeof note !== 'string' || note.trim().length === 0) {
    return res.status(400).json({ error: 'Note is required' });
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

    const updatedAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO status_updates (report_id, note, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(matchedReport.id, note.trim(), updatedAt);

    res.status(201).json({
      message: 'Note added successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add note' });
  }
});


module.exports = router;