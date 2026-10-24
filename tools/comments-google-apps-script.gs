/* =============================================================================
   WildQuant comments — Google Apps Script that turns a Google Sheet into the
   comment store for the site (the Feedback box and the Comments page).

   ONE-TIME SETUP (about 10 minutes)
   1. Create a new Google Sheet (any name, e.g. "WildQuant comments").
      Keep its sharing "Restricted": this script reads and writes it for you,
      so visitors never need access. (It adds the header row by itself.)
   2. In the sheet: Extensions → Apps Script. Delete what's there, paste this
      whole file, and click Save.
   3. Deploy → New deployment → type "Web app".
        Execute as: Me            Who has access: Anyone
      Click Deploy, allow the permissions, and copy the "Web app URL"
      (it ends in /exec).
   4. Open js/comments.js in the site and paste that URL between the quotes:
        const SHEET_URL = "https://script.google.com/macros/s/…/exec";
      Commit and push. Done.

   MODERATION: only you can edit the sheet. To remove a comment, delete its
   row. To hide every comment for a while, set SHOW_COMMENTS to false below
   and deploy again (Deploy → Manage deployments → Edit → New version).
   ============================================================================= */

const SHOW_COMMENTS = true;     // false = accept comments but don't show them on the site
const MAX_LENGTH = 2000;        // longest comment accepted
const MAX_PER_HOUR = 30;        // simple flood guard for the whole site

function doPost(e) {
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || "{}");
    const text = String(data.comment || "").trim().slice(0, MAX_LENGTH);
    if (!text) return json({ ok: false, error: "Empty comment." });
    // flood guard: count comments in the last hour
    const props = PropertiesService.getScriptProperties(), hour = Math.floor(Date.now() / 3600000);
    const key = "count_" + hour, n = Number(props.getProperty(key) || 0);
    if (n >= MAX_PER_HOUR) return json({ ok: false, error: "Too many comments right now. Please try again later." });
    props.setProperty(key, String(n + 1));
    // a leading = + - @ would make the sheet treat the comment as a formula
    const safe = /^[=+\-@]/.test(text) ? "'" + text : text;
    sheet().appendRow([new Date(), safe]);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: "Could not save the comment." });
  }
}

function doGet(e) {
  if (!SHOW_COMMENTS) return json({ comments: [] });
  const rows = sheet().getDataRange().getValues().slice(1);
  const comments = rows
    .filter((r) => r[1] !== "" && r[1] !== null)
    .map((r) => ({ time: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), comment: String(r[1]).replace(/^'/, "") }))
    .reverse()          // newest first
    .slice(0, 500);
  return json({ comments });
}

// the first sheet of the spreadsheet; on first use it gets its header row (time | comment)
function sheet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(["time", "comment"]);
  return sh;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
