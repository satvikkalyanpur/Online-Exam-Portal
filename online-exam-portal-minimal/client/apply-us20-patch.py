from pathlib import Path
import re
import sys

ROOT = Path.cwd()
BASE = ROOT
APP = BASE / 'client/src/App.tsx'
INDEX = BASE / 'server/src/index.ts'
CSS = BASE / 'client/src/styles.css'
SCHEMA = BASE / 'database/schema.prisma'

required = [APP, INDEX, CSS, SCHEMA]
missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
if missing:
    sys.exit('Preflight failed: run this script from the repository root. Missing: ' + ', '.join(missing))

# Prepare every edit in memory first. Nothing is written unless all checks pass.
app = APP.read_text(encoding='utf-8-sig')
index = INDEX.read_text(encoding='utf-8-sig')
css = CSS.read_text(encoding='utf-8-sig')
schema = SCHEMA.read_text(encoding='utf-8-sig')

if "import BackupRecovery from './components/BackupRecovery';" not in app:
    anchor = "import QuestionBank from './components/QuestionBank';"
    if anchor not in app:
        sys.exit('Preflight failed: App.tsx did not match the expected import anchor; no files changed.')
    app = app.replace(anchor, anchor + "\nimport BackupRecovery from './components/BackupRecovery';", 1)

if "type View = 'student' | 'teacher' | 'backup';" not in app:
    if "type View = 'student' | 'teacher';" not in app:
        sys.exit('Preflight failed: App.tsx has an unfamiliar View type; no files changed.')
    app = app.replace("type View = 'student' | 'teacher';", "type View = 'student' | 'teacher' | 'backup';", 1)

if 'Admin: Backup &amp; Recovery' not in app:
    nav_marker = '''          >
            Teacher: Question Bank
          </button>
        </nav>'''
    nav_replacement = '''          >
            Teacher: Question Bank
          </button>
          <button
            className={`tab ${view === 'backup' ? 'tab-active' : ''}`}
            aria-pressed={view === 'backup'}
            onClick={() => setView('backup')}
          >
            Admin: Backup &amp; Recovery
          </button>
        </nav>'''
    if nav_marker not in app:
        sys.exit('Preflight failed: App.tsx navigation anchor not found; no files changed.')
    app = app.replace(nav_marker, nav_replacement, 1)

if '<BackupRecovery />' not in app:
    render_marker = '''      {view === 'teacher' ? (
        <QuestionBank questions={bank} onDelete={deleteQuestion} />'''
    render_replacement = '''      {view === 'backup' ? (
        <BackupRecovery />
      ) : view === 'teacher' ? (
        <QuestionBank questions={bank} onDelete={deleteQuestion} />'''
    if render_marker not in app:
        sys.exit('Preflight failed: App.tsx view-switch anchor not found; no files changed.')
    app = app.replace(render_marker, render_replacement, 1)

if "import { backupRouter } from './backupRoutes.js';" not in index:
    marker = "import { router } from './routes.js';"
    if marker not in index:
        sys.exit('Preflight failed: index.ts import anchor not found; no files changed.')
    index = index.replace(marker, marker + "\nimport { backupRouter } from './backupRoutes.js';", 1)
if "app.use('/api/admin/data', backupRouter);" not in index:
    parser_line = 'app.use(express.json());'
    mount_line = "app.use('/api', router);"
    if parser_line not in index or mount_line not in index:
        sys.exit('Preflight failed: index.ts middleware/router anchors not found; no files changed.')
    index = index.replace(parser_line, "app.use('/api/admin/data', express.json({ limit: '25mb' }));\n" + parser_line, 1)
    index = index.replace(mount_line, mount_line + "\napp.use('/api/admin/data', backupRouter);", 1)

if 'provider = "mysql"' in schema:
    schema = schema.replace('provider = "mysql"', 'provider = "postgresql"', 1)
elif 'provider = "postgresql"' not in schema:
    sys.exit('Preflight failed: unsupported provider in schema.prisma; no files changed.')
total_marks_match = re.search(r'^(\s*totalMarks\s+Int(?:\s+@default\(\d+\))?\s*)$', schema, re.MULTILINE)
if not total_marks_match:
    sys.exit('Preflight failed: Exam.totalMarks field was not found in a supported form; no files changed.')
current_total_marks_line = total_marks_match.group(1)
if '@default(' not in current_total_marks_line:
    updated_total_marks_line = current_total_marks_line.rstrip() + ' @default(1)'
    schema = schema[:total_marks_match.start(1)] + updated_total_marks_line + schema[total_marks_match.end(1):]

css_addition = r'''

/* ---------- US20: administrator backup and recovery ---------- */
.backup-panel { max-width: 900px; }
.backup-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.backup-heading h2 { margin: 4px 0 8px; }
.backup-heading .intro { max-width: 650px; }
.backup-lock { font-size: 30px; }
.backup-scope { padding: 16px; margin: 18px 0; border: 1px solid #dce4ee; border-radius: 10px; background: #f8fafc; }
.backup-scope h3 { margin: 0 0 8px; }
.backup-scope p { margin: 6px 0; }
.backup-login { display: grid; gap: 9px; max-width: 440px; margin: 20px 0; }
.backup-login h3, .backup-login p { margin-bottom: 0; }
.backup-login input, .backup-action-card input[type='file'] { width: 100%; min-width: 0; padding: 10px; border: 1px solid #c3cfdd; border-radius: 8px; background: white; }
.backup-login .submit-button { margin-top: 8px; justify-self: start; }
.backup-session { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 0; }
.backup-session p { margin: 0; }
.backup-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 20px 0; }
.backup-action-card { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-width: 0; padding: 20px; border: 1px solid #dce4ee; border-radius: 12px; background: #fff; }
.backup-action-card h3, .backup-action-card p { margin: 0; }
.backup-action-card p { color: #526276; line-height: 1.55; }
.backup-action-card .submit-button, .backup-action-card .danger-solid { margin-top: auto; }
.backup-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 10px; background: #e8f1ff; color: #174a91; font-size: 25px; font-weight: 700; }
.file-label { font-size: 14px; font-weight: 650; }
.selected-file { overflow-wrap: anywhere; font-size: 13px; }
.backup-error { margin: 16px 0; padding: 12px 16px; border-radius: 8px; background: #fff0f0; color: #b42318; overflow-wrap: anywhere; }
.backup-safety-note { margin-top: 24px; padding-top: 16px; border-top: 1px solid #dce4ee; color: #526276; line-height: 1.55; }
@media (max-width: 650px) { .backup-actions { grid-template-columns: 1fr; } .backup-heading { align-items: flex-start; } }
'''
if 'US20: administrator backup and recovery' not in css:
    css = css.rstrip() + css_addition + '\n'

overlay = Path(__file__).resolve().parent / 'online-exam-portal-minimal'
new_files = [
    'server/src/backup.ts',
    'server/src/backupRoutes.ts',
    'client/src/components/BackupRecovery.tsx',
    'database/migrations/20261029120000_us20_exam_question_schema/migration.sql',
]
prepared = []
for rel in new_files:
    src = overlay / rel
    dst = BASE / rel
    if not src.exists():
        sys.exit(f'Preflight failed: bundle file is missing: {src}; no files changed.')
    content = src.read_bytes()
    if dst.exists() and dst.read_bytes() != content:
        sys.exit(f'Preflight failed: {dst.relative_to(ROOT)} already exists with different contents. Review it manually; no files changed.')
    prepared.append((dst, content))

# Write only after preflight has succeeded. Existing conflicting feature files are never overwritten.
APP.write_text(app, encoding='utf-8')
INDEX.write_text(index, encoding='utf-8')
SCHEMA.write_text(schema, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
for dst, content in prepared:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        dst.write_bytes(content)

print('US20 patch applied after preflight. Review git diff and run the build; no Git commit or push was performed.')
