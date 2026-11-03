# ClassUp Teacher Screen

GitHub Pages entry: teacher.html. Designed for a 16:9 classroom display. Course/group selector, top five, seven-row paginated leaderboard, score visibility toggle, 12-second rotation, fullscreen and keyboard controls. Data stays in memory and is cleared by reload. Demo data is explicitly marked.

Teacher.gs is a separate Apps Script project. Enable Advanced Sheets v4 and spreadsheets.readonly. Deploy execute-as-owner with access **Only myself**. Never deploy this service to Anyone: teacherRead deliberately returns room-wide scores to the authorized teacher.

Set teacher-config.js to the private deployment URL. The connector popup uses google.script.run for Sheet access and postMessage only to https://mgtspuc.github.io. A JSON download/import fallback is available for browsers that isolate popup windows. No score records or credentials are committed to GitHub. Registration F supplies aliases with E as fallback; AO supplies totals, AR supplies existing ranks. Missing ranks are computed per course/group, including ties at fifth position.

Decorative student emoji are placeholders, not the students' saved avatar designs. Existing student portal code and deployment are not modified.

