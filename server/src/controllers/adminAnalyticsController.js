// server/src/controllers/adminAnalyticsController.js
const metrics = require('../services/metricsService');
const { resolveRange, previousSemester } = require('../services/calendarService');
const { Semester } = require('../models');
const { success, error } = require('../utils/apiResponse');

/**
 * ═════════════════════════════════════════════════════════════════
 * Institution analytics for the admin console, and the same numbers as
 * a PDF report for management.
 *
 * Range: ?semesterId= or ?from=&to= (YYYY-MM-DD); with neither, the
 * current semester, or all time when no semester is defined.
 *
 * "Versus last semester" lines the two weekly series up by week
 * number from each semester's start, so week 3 compares with week 3.
 * ═════════════════════════════════════════════════════════════════
 */

async function collect(query) {
  const range = await resolveRange(query);
  const [overall, departments, grid, trend, classes, lecturers, atRisk] = await Promise.all([
    metrics.overall(range),
    metrics.byDepartment(range),
    metrics.weekdayHour(range),
    metrics.weeklyTrend(range),
    metrics.perClass(range),
    metrics.lecturerReliability(range),
    metrics.atRisk(range, { limit: 1000 }),
  ]);

  let comparison = null;
  if (range.semester) {
    const prev = await previousSemester(range.semester).catch(() => null);
    if (prev) {
      const prevRange = await resolveRange({ semesterId: prev.id });
      const [prevOverall, prevTrend] = await Promise.all([metrics.overall(prevRange), metrics.weeklyTrend(prevRange)]);
      comparison = { label: prev.name, overall: prevOverall, trend: prevTrend.map((w, i) => ({ ...w, index: i + 1 })) };
    }
  }

  // Lecturer rows combine timetable reliability with class attendance.
  const byLecturer = new Map();
  for (const c of classes) {
    const agg = byLecturer.get(c.lecturerId) ?? { expected: 0, attended: 0, sessions: 0 };
    agg.expected += c.expected; agg.attended += c.attended; agg.sessions += c.sessions;
    byLecturer.set(c.lecturerId, agg);
  }
  const lecturerRows = lecturers.map(l => {
    const a = byLecturer.get(l.lecturerId);
    return { ...l, sessionsHeld: a?.sessions ?? 0, attendanceRate: a ? metrics.pct(a.attended, a.expected) : null };
  });

  return {
    range: { label: range.label, from: range.from, to: range.to, semesterId: range.semester?.id ?? null },
    overall: { ...overall, atRisk: metrics.distinctStudents(atRisk), atRiskEnrolments: atRisk.length },
    departments,
    grid,
    trend: trend.map((w, i) => ({ ...w, index: i + 1 })),
    comparison,
    classes: classes.sort((a, b) => a.rate - b.rate),
    lecturers: lecturerRows,
  };
}

exports.get = async (req, res) => {
  try {
    const [data, semesters] = await Promise.all([
      collect(req.query),
      Semester.findAll({ order: [['starts_on', 'DESC']] }).catch(() => []),
    ]);
    return res.json(success({ ...data, semesters }));
  } catch (err) {
    console.error('[Analytics] failed:', err.message);
    return res.status(500).json(error('Could not load analytics'));
  }
};

// ── PDF report ────────────────────────────────────────────────────
const INK = '#0B1B3F', MUTED = '#5B6477', LINE = '#DCE1EA', COBALT = '#2248FF', TEAL = '#14C9A6';

function table(doc, { x, y, widths, head, rows }) {
  const rowH = 20;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
  let cx = x;
  head.forEach((h, i) => { doc.text(h.toUpperCase(), cx, y, { width: widths[i], align: i ? 'right' : 'left' }); cx += widths[i]; });
  y += 14;
  doc.moveTo(x, y).lineTo(x + widths.reduce((a, b) => a + b, 0), y).strokeColor(LINE).lineWidth(1).stroke();
  y += 5;
  doc.font('Helvetica').fontSize(9.5).fillColor(INK);
  for (const r of rows) {
    if (y > doc.page.height - 70) { doc.addPage(); y = 50; }
    cx = x;
    r.forEach((cell, i) => { doc.text(String(cell), cx, y, { width: widths[i], align: i ? 'right' : 'left', ellipsis: true, lineBreak: false }); cx += widths[i]; });
    y += rowH;
  }
  return y;
}

exports.pdf = async (req, res) => {
  try {
    const data = await collect(req.query);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=attendx-institution-report.pdf');
    doc.pipe(res);

    const W = doc.page.width - 100;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COBALT).text('ATTENDX  /  INSTITUTION REPORT', 50, 50);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(`Attendance, ${data.range.label}`, 50, 68);
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
      .text(`Generated ${new Date().toUTCString().slice(0, 22)} UTC. Closed sessions only; present, late and excused count as attended.`, 50, 98);

    // Key numbers
    const kpis = [
      ['Attendance rate', `${data.overall.rate}%`],
      ['Sessions held', data.overall.sessions],
      ['Expected seats', data.overall.expected],
      ['Students at risk', data.overall.atRisk],
    ];
    const kw = W / kpis.length;
    kpis.forEach(([label, value], i) => {
      const x = 50 + i * kw;
      doc.rect(x, 124, kw - 10, 62).strokeColor(LINE).lineWidth(1).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x + 10, 134, { width: kw - 30 });
      doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(String(value), x + 10, 150, { width: kw - 30 });
    });
    if (data.comparison) {
      const delta = Math.round((data.overall.rate - data.comparison.overall.rate) * 10) / 10;
      doc.font('Helvetica').fontSize(9).fillColor(delta >= 0 ? TEAL : '#C42536')
        .text(`${delta >= 0 ? '+' : ''}${delta} points on ${data.comparison.label} (${data.comparison.overall.rate}%)`, 50, 194);
    }

    // Weekly trend as bars
    let y = 222;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Weekly attendance', 50, y);
    y += 20;
    const weeks = data.trend.slice(-16);
    if (weeks.length) {
      const bw = Math.min(28, W / weeks.length - 4);
      weeks.forEach((w, i) => {
        const h = Math.max(2, (w.rate / 100) * 80);
        const x = 50 + i * (bw + 4);
        doc.rect(x, y + 80 - h, bw, h).fillColor(i === weeks.length - 1 ? COBALT : '#AFC0FF').fill();
        doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text(`${Math.round(w.rate)}`, x, y + 84, { width: bw, align: 'center' });
      });
      y += 104;
    } else {
      doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text('No closed sessions in this range yet.', 50, y);
      y += 24;
    }

    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('By department', 50, y);
    y = table(doc, {
      x: 50, y: y + 20, widths: [W - 270, 80, 90, 100],
      head: ['Department', 'Classes', 'Sessions', 'Attendance'],
      rows: data.departments.map(d => [d.department, d.classes, d.sessions, `${d.rate}%`]),
    }) + 16;

    if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Lecturers against the timetable', 50, y);
    y = table(doc, {
      x: 50, y: y + 20, widths: [W - 330, 70, 70, 70, 60, 60],
      head: ['Lecturer', 'Slots', 'Held', 'Missed', 'Late', 'Rate'],
      rows: data.lecturers.map(l => [l.name, l.slots, l.held, l.missed, l.lateStarts, l.attendanceRate == null ? '-' : `${l.attendanceRate}%`]),
    }) + 16;

    if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Classes with the lowest attendance', 50, y);
    table(doc, {
      x: 50, y: y + 20, widths: [W - 250, 120, 60, 70],
      head: ['Class', 'Lecturer', 'Sessions', 'Rate'],
      rows: data.classes.slice(0, 10).map(c => [`${c.code}  ${c.name}`, c.lecturerName ?? '-', c.sessions, `${c.rate}%`]),
    });

    doc.end();
  } catch (err) {
    console.error('[Analytics] pdf:', err.message);
    if (!res.headersSent) return res.status(500).json(error('Could not build the report'));
  }
};
