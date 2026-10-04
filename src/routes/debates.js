const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/reports/:caseCode/debates', async (req, res) => {
  const { caseCode } = req.params;

  if (!caseCode || caseCode.length < 8) {
    return res.status(400).json({ error: 'Invalid case code' });
  }

  try {
    const allReports = db.prepare(`
      SELECT id, case_code_hash FROM reports
    `).all();

    let matchedReport = null;
    for (const report of allReports) {
      const caseCodeUtils = require('../utils/caseCode');
      const isMatch = await caseCodeUtils.verifyCaseCode(caseCode, report.case_code_hash);
      if (isMatch) {
        matchedReport = report;
        break;
      }
    }

    if (!matchedReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const debates = db.prepare(`
      SELECT d.id, d.topic, d.status, d.created_at, d.updated_at,
             COUNT(c.id) as comment_count
      FROM debates d
      LEFT JOIN debate_comments c ON d.id = c.debate_id
      WHERE d.report_id = ?
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `).all(matchedReport.id);

    res.json(debates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch debates' });
  }
});

router.post('/reports/:caseCode/debates', async (req, res) => {
  const { caseCode } = req.params;
  const { topic } = req.body;

  if (!caseCode || caseCode.length < 8) {
    return res.status(400).json({ error: 'Invalid case code' });
  }
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    const allReports = db.prepare(`
      SELECT id, case_code_hash FROM reports
    `).all();

    let matchedReport = null;
    for (const report of allReports) {
      const caseCodeUtils = require('../utils/caseCode');
      const isMatch = await caseCodeUtils.verifyCaseCode(caseCode, report.case_code_hash);
      if (isMatch) {
        matchedReport = report;
        break;
      }
    }

    if (!matchedReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO debates (report_id, topic, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(matchedReport.id, topic.trim(), 'open', createdAt, createdAt);

    res.status(201).json({
      message: 'Debate created successfully',
      debateId: info.lastInsertRowid
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create debate' });
  }
});

router.get('/debates/:debateId', async (req, res) => {
  const { debateId } = req.params;

  if (!debateId || isNaN(parseInt(debateId))) {
    return res.status(400).json({ error: 'Invalid debate ID' });
  }

  try {
    const debate = db.prepare(`
      SELECT d.id, d.report_id, d.topic, d.status, d.created_at, d.updated_at
      FROM debates d
      WHERE d.id = ?
    `).get(debateId);

    if (!debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    const comments = db.prepare(`
      SELECT id, author, content, created_at, updated_at
      FROM debate_comments
      WHERE debate_id = ?
      ORDER BY created_at ASC
    `).all(debateId);

    res.json({
      ...debate,
      comments: comments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch debate' });
  }
});

router.post('/debates/:debateId/comments', async (req, res) => {
  const { debateId } = req.params;
  const { author, content } = req.body;

  if (!debateId || isNaN(parseInt(debateId))) {
    return res.status(400).json({ error: 'Invalid debate ID' });
  }
  if (!author || typeof author !== 'string' || author.trim().length === 0) {
    return res.status(400).json({ error: 'Author is required' });
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const debate = db.prepare(`
      SELECT id FROM debates WHERE id = ?
    `).get(debateId);

    if (!debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO debate_comments (debate_id, author, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(debateId, author.trim(), content.trim(), createdAt, createdAt);

    res.status(201).json({
      message: 'Comment added successfully',
      commentId: info.lastInsertRowid
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.patch('/debates/:debateId/status', async (req, res) => {
  const { debateId } = req.params;
  const { status } = req.body;

  if (!debateId || isNaN(parseInt(debateId))) {
    return res.status(400).json({ error: 'Invalid debate ID' });
  }
  if (!status || !['open', 'closed', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Status must be open, closed, or resolved' });
  }

  try {
    const updatedAt = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE debates
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(status, updatedAt, debateId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    res.json({
      message: 'Debate status updated successfully',
      status: status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update debate status' });
  }
});

module.exports = router;