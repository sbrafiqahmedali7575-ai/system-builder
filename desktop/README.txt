SYSTEM BUILDER DESKTOP — WINDOWS 10/11 x64

INSTALL / OPEN
1. Extract the entire ZIP to a permanent folder, for example Documents\System Builder.
2. Open System Builder.exe inside that folder. Do not run the EXE inside the ZIP.
3. Optionally right-click the EXE and create a Desktop shortcut.
No Node.js, database server, browser installation or internet connection is required.
This personal build is unsigned. Windows may show an unknown-publisher warning.

INITIAL DATA
Includes your six uploaded exports from 3 October 2026, approximately 7:04 AM IST:
64 days, 63 tasks, 6 habits, 24 habit logs, 1 user and 1 countdown.
The current source was retrieved at commit 012a910ad023eec341a39552f164b601b6972203.
Changes made online after those exports are NOT included. Before making this app
primary, export the six tables again from the online app and use Data > Import
in this desktop app. Import uses primary-key upserts; it does not remove absent rows.
The first launch initializes today's due habits using the existing app rules.
Historical browser-only book annotations and preferences are not in the six exports.

OFFLINE BEHAVIOR
The existing screens and domain calculations are retained. Login, AI chat and the
server-backed SQL chatbot are removed. All table reads/writes use local files.
The renderer is blocked from making HTTP/WebSocket calls. There is no automatic
Firestore synchronization, cloud login, cloud migration, or email service.
The app allows a single running instance to prevent competing local writers.

BACKUP
Use the cloud-upload Backup icon in the header, then Back up to Firestore.
Internet is needed for this operation. Desktop records update the six existing
Firestore collections with no date cutoff, even after months or years offline.
Every backup sends the complete current local snapshot, regardless of record dates
or the last backup time. Matching cloud documents are replaced by desktop values;
removed fields are removed in the cloud too. Local deletion markers never expire.
Local deletions are propagated. Unrelated remote-only
records are not deleted. Use this desktop app as your primary editor to avoid
conflicting updates from the website.
The last-success time changes only after every write is confirmed. If a backup
fails, local data is safe and retrying sends the current snapshot again.
Book notes, bookmarks, reading preferences and timer settings made in this desktop
app are included in the user profile's desktopPreferences field when you back up.
Cloud upload uses the project's existing Firestore access rules; this build does
not alter security rules or embed administrator credentials.

UPDATING THE APP
Exit System Builder, extract the new ZIP into a new app folder, and open its EXE.
Your existing local database and preferences are reused automatically from AppData.
Do not delete the AppData folder. Updates do not reimport the bundled seed data.

LOCAL FILES / RESTORE
Table data is stored at %APPDATA%\System Builder Desktop\system-builder.json.
Every successful write retains the previous table file as system-builder.json.previous.
Chromium profile files in the same folder contain local preferences and reader state.
Moving/replacing the extracted app folder does not erase these files.
The Backup panel can save a separate JSON backup file without internet.
To restore that JSON: exit the app completely, copy the current data folder somewhere
safe, and replace system-builder.json with the saved backup renamed to that filename.
For a complete computer transfer, copy the entire %APPDATA%\System Builder Desktop
folder while the app is closed. Corrupt data is reported, never silently reset.

VALIDATION LIMITS
Type checking, production build, local database tests, backup request/failure tests,
and headless browser flows were run. The Windows EXE must still be launch-tested
on your Windows device. Live Firestore writes were not executed during testing.
