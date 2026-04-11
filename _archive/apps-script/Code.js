// ============================================================
// 🐕 WIGGLE CONTROL TOWER V3.9 — Google Apps Script
// ============================================================
// Version: 3.9
// Date: March 22, 2026
//
// Complete rebuild: 6-tab architecture, streamlined menu,
// capacity tracking, Supabase-first name mappings.
//
// HOW TO UPDATE:
// 1. Open Apps Script (Extensions → Apps Script)
// 2. Ctrl+A (select all) → Delete
// 3. Paste this ENTIRE file
// 4. Ctrl+S (save)
// 5. Done! Use 🐕 Wiggle menu in spreadsheet.
// ============================================================


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONFIG = {
  acuity: {
    userId: '36833686',
    apiKey: '98245375083321dac83d834b13edda1a',
  },
  supabase: {
    url: 'https://ifhniwjdrsswgemmqddn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmaG5pd2pkcnNzd2dlbW1xZGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTY1OTEsImV4cCI6MjA4Nzc5MjU5MX0.uMcr2oM77jJ26sVUXrQ8eGW7ZUwiniAAv3hgMv00Lxs',
  },
  email: {
    gen: 'gen-vg@outlook.com',
    rodrigo: 'rod_galvan@hotmail.com',
    wiggle: 'info@wiggledogwalks.com',
  },
  claude_api_key: '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',
  capacity: {
    warning: 20,
    critical: 25,
  },
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TABS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TABS = {
  DASHBOARD: "Gen's Dashboard",
  WEEKLY:    "Weekly Board",
  SCHEDULE:  "Schedule Ecosystem",
  DOGS:      "Dogs",
  BILLING:   "Billing",
  STAFF:     "Staff",
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COLORS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COLORS = {
  ORANGE:      '#e8762b',
  ORANGE_BG:   '#fef5ed',
  ORANGE_DARK: '#c45d1a',

  PLATEAU:     '#2c5f8a',
  PLATEAU_BG:  '#edf4fa',

  LAURIER:     '#2a7a4b',
  LAURIER_BG:  '#edf7f1',

  RED:         '#d94f3d',
  RED_BG:      '#fef2f0',

  YELLOW:      '#e6a817',
  YELLOW_BG:   '#fef9ed',

  GREEN:       '#3d9970',
  GREEN_BG:    '#f0faf5',

  BLUE:        '#4a90d9',
  BLUE_BG:     '#f0f5fc',

  PURPLE:      '#7c5cbf',
  PURPLE_BG:   '#f5f0fc',

  SURFACE:     '#ffffff',
  SURFACE_ALT: '#f5f3f0',

  HEADER_TEXT: '#ffffff',
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OWNER → DOG NAME MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Hardcoded fallback (Acuity owner first name → dog name)
var OWNER_TO_DOG = {
  'delphine': 'Nahla',
  'marie-pier': 'Louise',
  'quinn': 'Pepper',
  'rebecca': 'Sansa',
  'jeanne': 'Oslo',
  'lea': 'Lea epagneule',
  'léa': 'Lea epagneule',
};

/**
 * Loads owner→dog mappings from Supabase name_mappings table,
 * falling back to the hardcoded OWNER_TO_DOG map on failure.
 * Returns a merged map (Supabase entries override hardcoded ones).
 */
function getOwnerToDogMap() {
  var map = {};
  // Start with hardcoded fallback
  for (var key in OWNER_TO_DOG) {
    map[key] = OWNER_TO_DOG[key];
  }

  try {
    var response = UrlFetchApp.fetch(
      CONFIG.supabase.url + '/rest/v1/acuity_name_map?select=acuity_name,dog_name',
      {
        method: 'GET',
        headers: {
          'apikey': CONFIG.supabase.anonKey,
          'Authorization': 'Bearer ' + CONFIG.supabase.anonKey,
          'Content-Type': 'application/json',
        },
        muteHttpExceptions: true,
      }
    );

    if (response.getResponseCode() === 200) {
      var rows = JSON.parse(response.getContentText());
      for (var i = 0; i < rows.length; i++) {
        var ownerKey = rows[i].acuity_name.toLowerCase().trim();
        map[ownerKey] = rows[i].dog_name;
      }
    }
  } catch (e) {
    Logger.log('getOwnerToDogMap fallback to hardcoded: ' + e.message);
  }

  return map;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MENU
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function onOpen() {
  createWiggleMenu();
}

function createWiggleMenu() {
  SpreadsheetApp.getUi().createMenu('🐕 Wiggle')
    .addItem('☀️ Run Morning Check', 'runMorningCheck')
    .addItem('📤 Push Changes → App', 'pushChangesToApp')
    .addItem('🔄 Refresh Dashboard', 'refreshDashboard')
    .addItem('🗓️ Sync Acuity', 'syncAcuity')
    .addItem('🔄 Sync Dog Roster', 'syncRosterFromSupabase')
    .addItem('💰 Refresh Billing', 'refreshBilling')
    .addItem('🦉 New Owl Note', 'newOwlNote')
    .addItem('💰 Send Package Nudge', 'sendPackageNudge')
    .addSeparator()
    .addItem('📧 Send All Bills', 'sendAllBills')
    .addItem('📄 Export Report', 'exportReport')
    .addSeparator()
    .addItem('🦍 Ask The Beast', 'askTheBeast')
    .addItem('✅ Confirm Beast Action', 'confirmBeastAction')
    .addItem('❌ Cancel Beast Action', 'cancelBeastAction')
    .addSeparator()
    .addItem('📧 Send Monday Prep Email', 'sendMondayPrepEmail')
    .addItem('⚙️ Setup Triggers', 'setupTriggers')
    .addItem('🔧 Setup Tower (first-time only)', 'setupControlTower')
    .addToUi();
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETUP — First-time tower creation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setupControlTower() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    '🦍 Setup Tower Control V3.9?',
    'This will create 6 new tabs: Dashboard, Weekly Board, Schedule, Dogs, Billing, Staff.\n\nExisting data in these tabs will be overwritten.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  // Clean up leftover _temp_setup from a previous run
  try {
    var oldTemp = ss.getSheetByName('_temp_setup');
    if (oldTemp) ss.deleteSheet(oldTemp);
  } catch(e) { Logger.log('Could not delete old _temp_setup: ' + e); }

  // Insert temp sheet so we always have at least one
  var tempSheet = ss.insertSheet('_temp_setup');

  // Delete old V2.2 tabs and Sheet1
  var oldTabs = [
    "Today's Board",
    "Dog Schedule List",
    "Dog Roster",
    "Rules & Overrides",
    "Billing Alerts",
    "Vacation",
    "Owl Notes",
    "Audit Log",
    "Gen's Dashboard",
    "Sheet1",
  ];
  for (var i = 0; i < oldTabs.length; i++) {
    try {
      var oldSheet = ss.getSheetByName(oldTabs[i]);
      if (oldSheet) ss.deleteSheet(oldSheet);
    } catch(e) {}
  }

  // Create all 6 tabs — each wrapped so one failure doesn't block the rest
  var tabErrors = [];
  try { createDashboard(ss); } catch(e) { tabErrors.push('Dashboard: ' + e); Logger.log('Dashboard creation error: ' + e); }
  try { createWeeklyBoard(ss); } catch(e) { tabErrors.push('Weekly Board: ' + e); Logger.log('Weekly Board creation error: ' + e); }
  try { createScheduleEcosystem(ss); } catch(e) { tabErrors.push('Schedule: ' + e); Logger.log('Schedule creation error: ' + e); }
  try { createDogsTab(ss); } catch(e) { tabErrors.push('Dogs: ' + e); Logger.log('Dogs creation error: ' + e); }
  try { createBillingTab(ss); } catch(e) { tabErrors.push('Billing: ' + e); Logger.log('Billing creation error: ' + e); }
  try { createStaffTab(ss); } catch(e) { tabErrors.push('Staff: ' + e); Logger.log('Staff creation error: ' + e); }

  // Set Dashboard as first tab
  var dash = ss.getSheetByName(TABS.DASHBOARD);
  if (dash) {
    ss.setActiveSheet(dash);
    ss.moveActiveSheet(1);
  }

  // Remove temp sheet AFTER all tabs created and active sheet set
  try { ss.deleteSheet(tempSheet); } catch(e) { Logger.log('Could not delete temp sheet: ' + e); }

  // Sync data from external sources
  try { syncRosterFromSupabase(); } catch(e) { Logger.log('Roster sync skipped: ' + e); }
  try { refreshBilling(); } catch(e) { Logger.log('Billing sync skipped: ' + e); }

  // Create menu
  createWiggleMenu();

  var alertMsg = '🦍 Tower Control V3.9 is ready!\n\n' +
    '6 tabs created:\n' +
    '📊 Dashboard — your command center\n' +
    '📅 Weekly Board — the week at a glance\n' +
    '📋 Schedule — rules, vacations, notes\n' +
    '🐕 Dogs — master roster\n' +
    '💰 Billing — packages and renewals\n' +
    '👥 Staff — walkers and coverage\n\n';

  if (tabErrors.length > 0) {
    alertMsg += '⚠️ Some tabs had issues:\n' + tabErrors.join('\n') + '\n\n';
  }

  alertMsg += 'Next: Run ☀️ Morning Check from the 🐕 Wiggle menu!';
  ui.alert(alertMsg);
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRIGGERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setupTriggers() {
  // Remove existing triggers to avoid duplicates
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    ScriptApp.deleteTrigger(existing[i]);
  }

  // 9 AM daily — morning check
  ScriptApp.newTrigger('runMorningCheck')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(0)
    .create();

  // Sunday 8 PM — Monday prep email
  ScriptApp.newTrigger('sendMondayPrepEmail')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(20)
    .nearMinute(0)
    .create();

  // Friday 4 PM — billing email
  ScriptApp.newTrigger('sendFridayBillingEmail')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .nearMinute(0)
    .create();

  // Daily midnight — auto-clean
  ScriptApp.newTrigger('autoCleanExpired')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .nearMinute(0)
    .create();

  SpreadsheetApp.getUi().alert(
    '⚙️ Triggers configured:\n\n' +
    '• 9 AM daily — Morning Check\n' +
    '• Sunday 8 PM — Monday Prep Email\n' +
    '• Friday 4 PM — Billing Email\n' +
    '• Midnight daily — Auto-Clean'
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACUITY CONNECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetches appointments from Acuity for a given date.
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Array} Array of appointment objects (empty on error)
 */
function fetchAcuityAppointments(dateStr) {
  try {
    var credentials = Utilities.base64Encode(CONFIG.acuity.userId + ':' + CONFIG.acuity.apiKey);
    var response = UrlFetchApp.fetch(
      'https://acuityscheduling.com/api/v1/appointments?minDate=' + dateStr + '&maxDate=' + dateStr,
      {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + credentials,
        },
        muteHttpExceptions: true,
      }
    );

    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      Logger.log('Acuity fetch error for ' + dateStr + ': HTTP ' + response.getResponseCode());
      return [];
    }
  } catch (e) {
    Logger.log('fetchAcuityAppointments error: ' + e.message);
    return [];
  }
}


/**
 * Fetches Mon-Fri appointments for a given week.
 * @param {Date} mondayDate - Date object for the Monday of the week
 * @returns {Object} { monday: [...], tuesday: [...], wednesday: [...], thursday: [...], friday: [...] }
 */
function fetchAcuityWeek(mondayDate) {
  var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  var result = {};

  for (var i = 0; i < 5; i++) {
    var date = new Date(mondayDate);
    date.setDate(mondayDate.getDate() + i);
    var dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    result[dayNames[i]] = fetchAcuityAppointments(dateStr);
  }

  return result;
}


/**
 * Fetches package/certificate data from Acuity.
 * @returns {Array} Array of { clientName, remaining, packageName }
 */
function fetchAcuityCertificates() {
  try {
    var credentials = Utilities.base64Encode(CONFIG.acuity.userId + ':' + CONFIG.acuity.apiKey);
    var response = UrlFetchApp.fetch(
      'https://acuityscheduling.com/api/v1/certificates',
      {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + credentials,
        },
        muteHttpExceptions: true,
      }
    );

    if (response.getResponseCode() === 200) {
      var certs = JSON.parse(response.getContentText());
      // Log the first certificate's raw fields to find the correct remaining field
      if (certs.length > 0) {
        Logger.log('RAW CERT FIELDS: ' + JSON.stringify(Object.keys(certs[0])));
        Logger.log('RAW CERT[0]: ' + JSON.stringify(certs[0]).substring(0, 500));
      }
      return certs.map(function(cert) {
        return {
          id: cert.id || 0,
          clientName: cert.name || cert.certificate || '',
          remaining: cert.remainingCounts || cert.remaining || cert.remainingCount || cert.balance || cert.quantity || 0,
          packageName: cert.productName || cert.certificate || cert.name || '',
          soldDate: cert.datePurchased || cert.soldDate || cert.createdDate || '',
        };
      });
    } else {
      Logger.log('Acuity certificates error: HTTP ' + response.getResponseCode());
      return [];
    }
  } catch (e) {
    Logger.log('fetchAcuityCertificates error: ' + e.message);
    return [];
  }
}


/**
 * Maps an Acuity owner name to a dog name using Supabase + hardcoded fallback.
 * @param {string} firstName - Owner's first name from Acuity
 * @param {string} lastName - Owner's last name from Acuity
 * @returns {Object} { dogName: string, matched: boolean, source: 'supabase'|'hardcoded'|'unmatched' }
 */
function resolveAcuityName(firstName, lastName) {
  var first = (firstName || '').trim();
  var last = (lastName || '').trim();
  var firstLC = first.toLowerCase();

  // Filter out time markers that leak from Acuity data
  if (firstLC === 'am' || firstLC === 'pm') {
    return { dogName: first, matched: false, source: 'time_marker' };
  }

  var map = getOwnerToDogMap();

  // Build name variants to try against the map (most specific → least)
  var fullName = (first + (last ? ' ' + last : '')).trim();
  var tryKeys = [];
  tryKeys.push(fullName);                                  // "Amber Rose Johnson"
  // Two-word prefix (catches "Amber Rose" when lastName is separate)
  var words = fullName.split(/\s+/);
  if (words.length > 2) {
    tryKeys.push(words.slice(0, 2).join(' '));              // "Amber Rose"
  }
  tryKeys.push(first);                                     // "Amber" or "Marie-Pier"
  // Also try firstName + parenthetical if present in lastName, e.g. "Halloumi (Pauline)"
  if (last && last.indexOf('(') >= 0) {
    tryKeys.push(first + ' ' + last);                      // already in fullName, but ensure
  } else if (first.indexOf('(') >= 0) {
    tryKeys.push(first);                                   // "Halloumi (Pauline)" as firstName
  }

  // Step 1: Try each variant against the owner→dog map
  for (var t = 0; t < tryKeys.length; t++) {
    var k = tryKeys[t].toLowerCase().trim();
    if (k && map[k]) {
      var source = OWNER_TO_DOG[k] ? 'hardcoded' : 'supabase';
      if (OWNER_TO_DOG[k] && map[k] !== OWNER_TO_DOG[k]) {
        source = 'supabase';
      }
      return { dogName: map[k], matched: true, source: source };
    }
  }

  // Step 2: Check if ANY variant directly matches a dog name in the Dogs tab
  var dogNames = getDogNamesList_();
  for (var t2 = 0; t2 < tryKeys.length; t2++) {
    var k2 = tryKeys[t2].toLowerCase().trim();
    for (var d = 0; d < dogNames.length; d++) {
      if (dogNames[d].toLowerCase().trim() === k2) {
        return { dogName: dogNames[d], matched: true, source: 'direct' };
      }
    }
  }

  // Step 3: No match found — use firstName as display name
  return { dogName: first, matched: false, source: 'unmatched' };
}

/**
 * Returns an array of dog names from the Dogs tab column A (proper-cased).
 * Cached per script execution to avoid re-reading the sheet.
 */
var dogNamesListCache_ = null;
function getDogNamesList_() {
  if (dogNamesListCache_) return dogNamesListCache_;
  dogNamesListCache_ = [];
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dogsSheet = ss.getSheetByName(TABS.DOGS);
    if (!dogsSheet) return dogNamesListCache_;
    var data = dogsSheet.getDataRange().getValues();
    if (data.length < 2) return dogNamesListCache_;
    // Find the name column (column A by default, or header-based)
    var headers = data[0];
    var nameCol = 0;
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c]).toLowerCase().trim();
      if (h === 'dog_name' || h === 'dog name' || h === 'name') {
        nameCol = c;
        break;
      }
    }
    for (var r = 1; r < data.length; r++) {
      var name = String(data[r][nameCol] || '').trim();
      if (name) dogNamesListCache_.push(name);
    }
  } catch (e) {
    Logger.log('getDogNamesList_ error: ' + e.message);
  }
  return dogNamesListCache_;
}


/**
 * Maps Acuity appointment type IDs to sector names.
 * @param {number|string} typeId - The Acuity appointmentTypeID
 * @returns {string} Sector label
 */
function getAppointmentTypeLabel(typeId) {
  var id = String(typeId);
  switch (id) {
    case '80336576': return 'Plateau';
    case '80336804': return 'Laurier';
    case '81191222': return 'Private';
    default: return 'Unknown';
  }
}


/**
 * Syncs today's Acuity appointments — the "Sync Acuity" menu action.
 * Fetches, resolves names, groups by sector, sorts by time.
 * @returns {Object} Structured data with sectors, dogs, times, flags
 */
function syncAcuityToday() {
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var appointments = fetchAcuityAppointments(today);

  var sectors = {
    Plateau: [],
    Laurier: [],
    Private: [],
    Unknown: [],
  };

  var unmatchedNames = [];

  for (var i = 0; i < appointments.length; i++) {
    var appt = appointments[i];
    var resolved = resolveAcuityName(appt.firstName, appt.lastName);
    if (resolved.source === 'time_marker') continue; // Skip AM/PM artifacts
    var sector = getAppointmentTypeLabel(appt.appointmentTypeID);

    var entry = {
      dogName: resolved.dogName,
      ownerFirst: appt.firstName,
      ownerLast: appt.lastName,
      time: appt.datetime || appt.time || '',
      sector: sector,
      matched: resolved.matched,
      source: resolved.source,
      appointmentId: appt.id,
    };

    if (sectors[sector]) {
      sectors[sector].push(entry);
    } else {
      sectors.Unknown.push(entry);
    }

    if (!resolved.matched) {
      unmatchedNames.push(appt.firstName + ' ' + appt.lastName);
    }
  }

  // Sort each sector by appointment time
  for (var sectorName in sectors) {
    sectors[sectorName].sort(function(a, b) {
      return (a.time || '').localeCompare(b.time || '');
    });
  }

  Logger.log('Synced ' + appointments.length + ' appointments from Acuity');

  return {
    date: today,
    totalAppointments: appointments.length,
    sectors: sectors,
    unmatchedNames: unmatchedNames,
    hasUnmatched: unmatchedNames.length > 0,
  };
}


/**
 * Fetches and structures the full week's Acuity data.
 * Returns structured week data for the Weekly Board.
 * Does NOT write to any sheet — just returns clean data.
 * @returns {Object} Week data keyed by day, each day grouped by sector
 */
function syncAcuityWeek() {
  // Find Monday — on weekends, use NEXT Monday
  var now = new Date();
  var dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  var mondayOffset;
  if (dayOfWeek === 0) {
    mondayOffset = 1; // Sunday: next Monday
  } else if (dayOfWeek === 6) {
    mondayOffset = 2; // Saturday: next Monday
  } else {
    mondayOffset = 1 - dayOfWeek; // Weekday: this week's Monday
  }
  var monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  var weekData = fetchAcuityWeek(monday);
  var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  var structured = {};

  for (var d = 0; d < dayNames.length; d++) {
    var dayName = dayNames[d];
    var appointments = weekData[dayName] || [];

    var daySectors = {
      Plateau: [],
      Laurier: [],
      Private: [],
      Unknown: [],
    };

    var dayUnmatched = [];

    for (var i = 0; i < appointments.length; i++) {
      var appt = appointments[i];
      var resolved = resolveAcuityName(appt.firstName, appt.lastName);
      if (resolved.source === 'time_marker') continue; // Skip AM/PM artifacts
      var sector = getAppointmentTypeLabel(appt.appointmentTypeID);

      // Diagnostic logging for sector assignment
      Logger.log('Appt: ' + appt.firstName + ' ' + (appt.lastName || '') +
        ' | typeID: ' + appt.appointmentTypeID + ' (type: ' + typeof appt.appointmentTypeID + ')' +
        ' | sector: ' + sector +
        ' | dog: ' + resolved.dogName +
        ' | matched: ' + resolved.matched + ' (' + resolved.source + ')');

      var entry = {
        dogName: resolved.dogName,
        ownerFirst: appt.firstName,
        ownerLast: appt.lastName,
        time: appt.datetime || appt.time || '',
        sector: sector,
        matched: resolved.matched,
        source: resolved.source,
      };

      if (daySectors[sector]) {
        daySectors[sector].push(entry);
      } else {
        daySectors.Unknown.push(entry);
      }

      if (!resolved.matched) {
        dayUnmatched.push(appt.firstName + ' ' + appt.lastName);
      }
    }

    // Sort by time within each sector
    for (var sectorName in daySectors) {
      daySectors[sectorName].sort(function(a, b) {
        return (a.time || '').localeCompare(b.time || '');
      });
    }

    // Calculate the date for this day
    var dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + d);

    structured[dayName] = {
      date: Utilities.formatDate(dayDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      totalAppointments: appointments.length,
      sectors: daySectors,
      unmatchedNames: dayUnmatched,
    };
  }

  // Summary log: count dogs per sector per day
  for (var sl = 0; sl < dayNames.length; sl++) {
    var slDay = structured[dayNames[sl]];
    if (slDay) {
      Logger.log('Day ' + dayNames[sl] + ': Plateau=' + (slDay.sectors.Plateau || []).length +
        ' Laurier=' + (slDay.sectors.Laurier || []).length +
        ' Unknown=' + (slDay.sectors.Unknown || []).length +
        ' total=' + slDay.totalAppointments);
    }
  }

  Logger.log('Synced week starting ' + Utilities.formatDate(monday, Session.getScriptTimeZone(), 'yyyy-MM-dd'));

  return {
    weekStart: Utilities.formatDate(monday, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    days: structured,
  };
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUPABASE CONNECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generic Supabase REST API caller.
 * @param {string} endpoint - REST endpoint (e.g. 'dogs?select=*')
 * @param {string} method - HTTP method: 'GET', 'POST', 'PATCH', 'DELETE'
 * @param {Object} [body] - Optional JSON body for POST/PATCH
 * @returns {Object|Array|null} Parsed JSON response, or null on error
 */
function supabaseRequest(endpoint, method, body) {
  try {
    var url = CONFIG.supabase.url + '/rest/v1/' + endpoint;
    var options = {
      method: method,
      headers: {
        'apikey': CONFIG.supabase.anonKey,
        'Authorization': 'Bearer ' + CONFIG.supabase.anonKey,
      },
      muteHttpExceptions: true,
    };

    if ((method === 'POST' || method === 'PATCH') && body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Prefer'] = 'return=representation';
      options.payload = JSON.stringify(body);
    }

    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();

    if (code >= 200 && code < 300) {
      var text = response.getContentText();
      return text ? JSON.parse(text) : null;
    } else {
      Logger.log('supabaseRequest error: HTTP ' + code + ' for ' + method + ' ' + endpoint);
      Logger.log('Response: ' + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log('supabaseRequest exception: ' + e.message);
    return null;
  }
}


/**
 * Pulls all dogs from Supabase, ordered by name.
 * @returns {Array} Array of dog objects
 */
function fetchDogRoster() {
  var url = CONFIG.supabase.url + '/rest/v1/dogs?select=*&order=dog_name';
  Logger.log('fetchDogRoster URL: ' + url);
  var response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      'apikey': CONFIG.supabase.anonKey,
      'Authorization': 'Bearer ' + CONFIG.supabase.anonKey,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  });
  Logger.log('fetchDogRoster response code: ' + response.getResponseCode());
  Logger.log('fetchDogRoster response body (first 500 chars): ' + response.getContentText().substring(0, 500));
  var dogs = [];
  var code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    var text = response.getContentText();
    dogs = text ? JSON.parse(text) : [];
  }
  Logger.log('fetchDogRoster parsed count: ' + dogs.length);
  return dogs;
}


/**
 * Pulls name_mappings table from Supabase.
 * @returns {Object} Map of { ownerNameLowercase: dogName, ... }
 */
function fetchNameMappings() {
  var rows = supabaseRequest('name_mappings?select=*', 'GET') || [];
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var key = (rows[i].owner_name || '').toLowerCase().trim();
    map[key] = rows[i].dog_name;
  }
  return map;
}


/**
 * Pushes a single field update for one dog to Supabase.
 * @param {string} dogName - The dog's name (exact match)
 * @param {string} field - The column name to update
 * @param {*} value - The new value
 * @returns {boolean} True if successful
 */
function pushDogUpdate(dogName, field, value) {
  var endpoint = 'dogs?dog_name=eq.' + encodeURIComponent(dogName);
  var body = {};
  body[field] = value;
  var result = supabaseRequest(endpoint, 'PATCH', body);
  if (result !== null) {
    Logger.log('Updated ' + dogName + ' ' + field + ' → ' + value);
    return true;
  }
  return false;
}


/**
 * Pushes a single owl note to Supabase.
 * @param {string} target - Who the note is about (dog name or 'all')
 * @param {string} message - The note content
 * @param {string} author - Who wrote it
 * @param {string} expiresDate - Expiration date (ISO string)
 * @returns {boolean} True if successful
 */
function pushOwlNote(target, message, author, expiresDate) {
  var result = supabaseRequest('owl_notes', 'POST', {
    target: target,
    message: message,
    author: author,
    expires_at: expiresDate,
    status: 'active',
  });
  return result !== null;
}


/**
 * "Push Changes → App" menu action.
 * Reads modified rows from Dogs tab and active Owl Notes from Schedule Ecosystem,
 * pushes them to Supabase, then clears Modified checkboxes.
 */
function pushAllChanges() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var user = Session.getActiveUser().getEmail();
  var dogsPushed = 0;
  var owlsPushed = 0;

  // --- Push modified dogs ---
  var dogsSheet = ss.getSheetByName(TABS.DOGS);
  if (dogsSheet) {
    var dogsData = dogsSheet.getDataRange().getValues();
    var headers = dogsData[0];
    var modifiedCol = headers.length - 1; // Last column is "Modified" checkbox

    // Find column indices for dog fields
    var colMap = {};
    for (var c = 0; c < headers.length; c++) {
      colMap[String(headers[c]).toLowerCase().trim()] = c;
    }

    var dogNameCol = colMap['dog_name'] !== undefined ? colMap['dog_name'] :
                     colMap['dog name'] !== undefined ? colMap['dog name'] :
                     colMap['name'] !== undefined ? colMap['name'] : 0;

    // Field mappings: header name → Supabase column
    var fieldMap = {
      'breed': 'breed',
      'owner_first': 'owner_first',
      'owner first': 'owner_first',
      'owner_last': 'owner_last',
      'owner last': 'owner_last',
      'sector': 'sector',
      'address': 'address',
      'door_code': 'door_code',
      'door code': 'door_code',
      'notes': 'notes',
      'photo_url': 'photo_url',
      'photo url': 'photo_url',
      'emergency_contact': 'emergency_contact',
      'emergency contact': 'emergency_contact',
      'emergency_phone': 'emergency_phone',
      'emergency phone': 'emergency_phone',
    };

    for (var r = 1; r < dogsData.length; r++) {
      if (dogsData[r][modifiedCol] === true) {
        var dogName = dogsData[r][dogNameCol];
        if (!dogName) continue;

        for (var h = 0; h < headers.length; h++) {
          var headerKey = String(headers[h]).toLowerCase().trim();
          if (fieldMap[headerKey] && h !== dogNameCol && h !== modifiedCol) {
            pushDogUpdate(dogName, fieldMap[headerKey], dogsData[r][h]);
          }
        }

        dogsPushed++;
        // Clear the Modified checkbox
        dogsSheet.getRange(r + 1, modifiedCol + 1).setValue(false);
      }
    }
  }

  // --- Push active owl notes ---
  var scheduleSheet = ss.getSheetByName(TABS.SCHEDULE);
  if (scheduleSheet) {
    var schedData = scheduleSheet.getDataRange().getValues();
    var schedHeaders = schedData[0];

    var schedColMap = {};
    for (var sc = 0; sc < schedHeaders.length; sc++) {
      schedColMap[String(schedHeaders[sc]).toLowerCase().trim()] = sc;
    }

    var targetCol = schedColMap['target'] !== undefined ? schedColMap['target'] : -1;
    var messageCol = schedColMap['message'] !== undefined ? schedColMap['message'] : -1;
    var authorCol = schedColMap['author'] !== undefined ? schedColMap['author'] : -1;
    var expiresCol = schedColMap['expires'] !== undefined ? schedColMap['expires'] :
                     schedColMap['expires_at'] !== undefined ? schedColMap['expires_at'] : -1;
    var statusCol = schedColMap['status'] !== undefined ? schedColMap['status'] : -1;

    if (targetCol >= 0 && messageCol >= 0 && statusCol >= 0) {
      for (var sr = 1; sr < schedData.length; sr++) {
        var status = String(schedData[sr][statusCol]).toLowerCase().trim();
        if (status === 'active') {
          var target = schedData[sr][targetCol] || '';
          var message = schedData[sr][messageCol] || '';
          var author = authorCol >= 0 ? (schedData[sr][authorCol] || user) : user;
          var expires = expiresCol >= 0 ? schedData[sr][expiresCol] : '';

          if (expires instanceof Date) {
            expires = Utilities.formatDate(expires, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
          }

          if (target && message) {
            if (pushOwlNote(target, message, author, expires || null)) {
              owlsPushed++;
            }
          }
        }
      }
    }
  }

  // Audit log
  Logger.log('pushAllChanges by ' + user + ': ' + dogsPushed + ' dogs, ' + owlsPushed + ' owl notes');

  SpreadsheetApp.getUi().alert(
    'Pushed ' + dogsPushed + ' dog updates and ' + owlsPushed + ' owl notes to the app.'
  );
}

/**
 * "Sync Acuity" menu action — syncs today's data, refreshes billing,
 * and shows a summary alert.
 */
function syncAcuity() {
  try {
    var data = syncAcuityToday();
    var parts = [];
    for (var sec in data.sectors) {
      if (data.sectors[sec].length > 0) {
        parts.push(sec + ': ' + data.sectors[sec].length);
      }
    }
    var msg = 'Synced ' + data.totalAppointments + ' appointments for ' + data.date + '\n\n' +
      parts.join('\n');
    if (data.hasUnmatched) {
      msg += '\n\n⚠️ Unmatched names: ' + data.unmatchedNames.join(', ');
    }
    try { refreshBilling(); } catch (e) { Logger.log('syncAcuity: billing refresh skipped — ' + e.message); }
    try { refreshWeeklyBoard(); msg += '\n\nWeekly Board updated.'; } catch (e) { Logger.log('syncAcuity: weekly board refresh skipped — ' + e.message); }
    SpreadsheetApp.getUi().alert(msg);
  } catch(e) {
    Logger.log('syncAcuity error: ' + e.message);
    try { SpreadsheetApp.getUi().alert('Error: ' + e.message); } catch(u) {}
  }
}


/** Menu wrapper for pushAllChanges */
function pushChangesToApp() {
  pushAllChanges();
}


/**
 * Adds a brand new dog to Supabase.
 * @param {Object} dogData - { dog_name, owner_first, owner_last, sector, address, door_code, breed, notes }
 * @returns {Object|null} The created dog object, or null on failure
 */
function addNewDogToSupabase(dogData) {
  var result = supabaseRequest('dogs', 'POST', dogData);
  if (result && result.length > 0) {
    Logger.log('New dog added: ' + dogData.dog_name);
    return result[0];
  }
  Logger.log('Failed to add new dog: ' + dogData.dog_name);
  return null;
}


/**
 * Pulls dog roster from Supabase and populates the Dogs tab.
 * Color codes rows by sector. Does NOT overwrite the "New Dogs" section at the top.
 */
function syncRosterFromSupabase() {
  try {
    var dogs = fetchDogRoster();
    if (!dogs || dogs.length === 0) {
      var reason = !dogs
        ? 'fetchDogRoster() returned null — check Supabase key/permissions'
        : 'fetchDogRoster() returned empty array — dogs table may be empty or anon key lacks SELECT';
      Logger.log('syncRosterFromSupabase: ' + reason);
      try {
        SpreadsheetApp.getUi().alert(
          'Could not load dogs from Supabase.\n\n' +
          'You can sync later from 🐕 Wiggle → 🔄 Sync Dog Roster\n\n' +
          'Details: ' + reason
        );
      } catch(uiErr) {
        // UI might not be available during setup — that's OK
        Logger.log('syncRosterFromSupabase: UI alert not available (running from setup)');
      }
      return;
    }
    Logger.log('syncRosterFromSupabase: Fetched ' + dogs.length + ' dogs from Supabase');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(TABS.DOGS);
    if (!sheet) {
      Logger.log('syncRosterFromSupabase: Dogs tab not found — run Setup Tower first');
      return;
    }

    // Find where the roster data starts (skip "New Dogs" section)
    var allData = sheet.getDataRange().getValues();
    var headerRow = -1; // 1-indexed row number of the header

    for (var r = 0; r < allData.length; r++) {
      var cellValue = String(allData[r][0]).toLowerCase().trim();
      if (cellValue === 'dog_name' || cellValue === 'dog name' || cellValue === 'name' || cellValue === 'full roster') {
        headerRow = r + 1; // convert 0-indexed to 1-indexed
        break;
      }
    }

    // If no header row found, create one at row 12 (after "FULL ROSTER" header area)
    if (headerRow < 0) {
      headerRow = 12;
    }

    // Write header labels at headerRow
    var headerLabels = ['dog_name', 'breed', 'owner_first', 'owner_last', 'sector',
                        'address', 'door_code', 'notes', 'photo_url',
                        'emergency_contact', 'emergency_phone', 'Modified'];
    sheet.getRange(headerRow, 1, 1, headerLabels.length).setValues([headerLabels]);
    sheet.getRange(headerRow, 1, 1, headerLabels.length)
      .setFontWeight('bold')
      .setBackground(COLORS.ORANGE)
      .setFontColor(COLORS.HEADER_TEXT);

    // Data starts on the row after the header
    var dataStartRow = headerRow + 1;
    var rows = [];

    for (var i = 0; i < dogs.length; i++) {
      var dog = dogs[i];
      rows.push([
        dog.dog_name || '',
        dog.breed || '',
        dog.owner_first || '',
        dog.owner_last || '',
        dog.sector || '',
        dog.address || '',
        dog.door_code || '',
        dog.notes || '',
        dog.photo_url || '',
        dog.emergency_contact || '',
        dog.emergency_phone || '',
        false, // Modified checkbox
      ]);
    }

    // Clear data validation from entire data area so roster sync can write freely
    try {
      var clearRange = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns());
      clearRange.clearDataValidations();
      Logger.log('syncRosterFromSupabase: Cleared data validations from Dogs tab');
    } catch(e) {
      Logger.log('syncRosterFromSupabase: Could not clear validations: ' + e);
    }

    // Clear old roster data (from data start to end of sheet)
    var lastRow = sheet.getMaxRows();
    if (lastRow >= dataStartRow) {
      sheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, 12).clearContent();
      sheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, 12).setBackground(null);
    }

    // Write new data
    if (rows.length > 0) {
      sheet.getRange(dataStartRow, 1, rows.length, 12).setValues(rows);

      // Color code by sector
      for (var j = 0; j < rows.length; j++) {
        var sector = String(rows[j][4]).toLowerCase().trim();
        var rowNum = dataStartRow + j;
        var range = sheet.getRange(rowNum, 1, 1, 12);

        if (sector === 'plateau') {
          range.setBackground(COLORS.PLATEAU_BG);
        } else if (sector === 'laurier') {
          range.setBackground(COLORS.LAURIER_BG);
        }
      }

      // Insert checkboxes in Modified column
      sheet.getRange(dataStartRow, 12, rows.length, 1).insertCheckboxes();
    }

    Logger.log('syncRosterFromSupabase: Wrote ' + rows.length + ' dogs to Dogs tab starting at row ' + dataStartRow);

  } catch (e) {
    Logger.log('syncRosterFromSupabase FATAL: ' + e.message + (e.lineNumber ? ' at line ' + e.lineNumber : ''));
    try {
      SpreadsheetApp.getUi().alert(
        'Dog roster sync failed: ' + e.message + '\n\n' +
        'You can retry from 🐕 Wiggle → 🔄 Sync Dog Roster'
      );
    } catch(uiErr) {
      // UI not available — log only
    }
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GEN'S DASHBOARD — Creation, Refresh, Beast AI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Creates and formats the "Gen's Dashboard" tab.
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function createDashboard(ss) {
  var sheet = ss.getSheetByName(TABS.DASHBOARD);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.DASHBOARD);
  }
  sheet.clear();

  // --- Column widths ---
  sheet.setColumnWidth(1, 4);    // A — indicator strip
  sheet.setColumnWidth(2, 150);  // B
  sheet.setColumnWidth(3, 150);  // C
  sheet.setColumnWidth(4, 100);  // D
  sheet.setColumnWidth(5, 4);    // E — indicator strip
  sheet.setColumnWidth(6, 150);  // F
  sheet.setColumnWidth(7, 150);  // G
  sheet.setColumnWidth(8, 100);  // H

  // --- ROW 1: Title bar ---
  sheet.getRange('A1:H1').merge()
    .setValue('🐕 Gen\'s Dashboard')
    .setBackground(COLORS.ORANGE)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontSize(20)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 48);

  // --- ROW 2: Dynamic date ---
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy');
  sheet.getRange('A2').setValue(dateStr)
    .setFontColor('#888888')
    .setFontSize(12);

  // --- ROW 3: Shift tabs + hidden shift selector ---
  sheet.getRange('A3').setValue('📸 Updates 3-5').setFontWeight('bold').setFontSize(10);
  sheet.getRange('C3').setValue('☀️ Monday 7-9:30').setFontWeight('bold').setFontSize(10);
  sheet.getRange('E3').setValue('💰 Friday Billing').setFontWeight('bold').setFontSize(10);

  // H3: hidden shift selector with data validation
  var shiftRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Updates', 'Monday', 'Friday'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('H3').setDataValidation(shiftRule)
    .setValue('Updates')
    .setFontColor('#ffffff')  // White text = hidden on white bg
    .setFontSize(8);

  // --- ROW 4: spacer ---
  sheet.setRowHeight(4, 8);

  // --- ROW 5: Section header — TODAY'S RECAP ---
  sheet.getRange('A5:H5').merge()
    .setValue('📸 TODAY\'S RECAP')
    .setFontWeight('bold')
    .setFontSize(11)
    .setFontColor(COLORS.ORANGE);

  // --- ROWS 6-9: Problem cards area (4 rows × 2 cards) ---
  for (var r = 6; r <= 9; r++) {
    // Card 1 indicator
    sheet.getRange(r, 1).setBackground(COLORS.BLUE_BG);
    // Card 1 content
    sheet.getRange(r, 2).setFontSize(10);
    sheet.getRange(r, 3, 1, 2).merge().setFontSize(9).setFontColor('#666666');
    // Card 2 indicator
    sheet.getRange(r, 5).setBackground(COLORS.BLUE_BG);
    // Card 2 content
    sheet.getRange(r, 6).setFontSize(10);
    sheet.getRange(r, 7, 1, 2).merge().setFontSize(9).setFontColor('#666666');
  }

  // Placeholder text
  sheet.getRange('B6').setValue('No issues detected').setFontColor('#999999');

  // --- ROW 10: spacer ---
  sheet.setRowHeight(10, 8);

  // --- ROW 11: OPPORTUNITIES header ---
  sheet.getRange('A11:H11').merge()
    .setValue('📋 OPPORTUNITIES')
    .setFontWeight('bold')
    .setFontSize(11);

  // --- ROWS 12-16: Three opportunity boxes side by side ---
  // Follow-ups box (A-B)
  sheet.getRange('A12:B12').merge()
    .setValue('🔄 Follow-ups (0)')
    .setFontWeight('bold')
    .setFontSize(10)
    .setBackground(COLORS.ORANGE_BG)
    .setBorder(true, true, true, true, false, false, '#dddddd', SpreadsheetApp.BorderStyle.SOLID);
  for (var fr = 13; fr <= 16; fr++) {
    sheet.getRange(fr, 1, 1, 2).merge()
      .setBorder(true, true, true, true, false, false, '#eeeeee', SpreadsheetApp.BorderStyle.SOLID)
      .setFontSize(9)
      .setFontColor('#666666');
  }

  // Package Nudge box (C-D)
  sheet.getRange('C12:D12').merge()
    .setValue('💰 Package Nudge (0)')
    .setFontWeight('bold')
    .setFontSize(10)
    .setBackground(COLORS.GREEN_BG)
    .setBorder(true, true, true, true, false, false, '#dddddd', SpreadsheetApp.BorderStyle.SOLID);
  for (var pr = 13; pr <= 16; pr++) {
    sheet.getRange(pr, 3, 1, 2).merge()
      .setBorder(true, true, true, true, false, false, '#eeeeee', SpreadsheetApp.BorderStyle.SOLID)
      .setFontSize(9)
      .setFontColor('#666666');
  }

  // Active Owl Notes box (E-F)
  sheet.getRange('E12:F12').merge()
    .setValue('🦉 Active Owl Notes (0)')
    .setFontWeight('bold')
    .setFontSize(10)
    .setBackground(COLORS.BLUE_BG)
    .setBorder(true, true, true, true, false, false, '#dddddd', SpreadsheetApp.BorderStyle.SOLID);
  for (var or_ = 13; or_ <= 16; or_++) {
    sheet.getRange(or_, 5, 1, 2).merge()
      .setBorder(true, true, true, true, false, false, '#eeeeee', SpreadsheetApp.BorderStyle.SOLID)
      .setFontSize(9)
      .setFontColor('#666666');
  }

  // --- ROW 17: spacer ---
  sheet.setRowHeight(17, 8);

  // --- ROW 18: TASKS header ---
  sheet.getRange('A18:H18').merge()
    .setValue('✅ TASKS')
    .setFontWeight('bold')
    .setFontSize(11);

  // --- ROWS 19-26: Task columns ---
  // @gen header
  sheet.getRange('A19').setValue('').setFontSize(9);
  sheet.getRange('B19').setValue('@gen tasks')
    .setFontWeight('bold').setFontSize(10).setFontColor(COLORS.ORANGE);
  sheet.getRange('C19').setValue('From').setFontWeight('bold').setFontSize(9).setFontColor('#999999');
  sheet.getRange('D19').setValue('Date').setFontWeight('bold').setFontSize(9).setFontColor('#999999');

  // @rod header
  sheet.getRange('E19').setValue('').setFontSize(9);
  sheet.getRange('F19').setValue('@rod tasks')
    .setFontWeight('bold').setFontSize(10).setFontColor(COLORS.BLUE);
  sheet.getRange('G19').setValue('From').setFontWeight('bold').setFontSize(9).setFontColor('#999999');
  sheet.getRange('H19').setValue('Date').setFontWeight('bold').setFontSize(9).setFontColor('#999999');

  // Task rows with checkboxes
  for (var tr = 20; tr <= 26; tr++) {
    sheet.getRange(tr, 1).insertCheckboxes();   // @gen checkbox
    sheet.getRange(tr, 2).setFontSize(9);        // task text
    sheet.getRange(tr, 3).setFontSize(8).setFontColor('#999999');
    sheet.getRange(tr, 4).setFontSize(8).setFontColor('#999999');
    sheet.getRange(tr, 5).insertCheckboxes();   // @rod checkbox
    sheet.getRange(tr, 6).setFontSize(9);
    sheet.getRange(tr, 7).setFontSize(8).setFontColor('#999999');
    sheet.getRange(tr, 8).setFontSize(8).setFontColor('#999999');
  }

  // --- ROW 27: spacer ---
  sheet.setRowHeight(27, 8);

  // --- ROW 28: TODAY'S LOG header ---
  sheet.getRange('A28:H28').merge()
    .setValue('📝 TODAY\'S LOG')
    .setFontWeight('bold')
    .setFontSize(11);

  // --- ROWS 29-38: Audit log ---
  for (var lr = 29; lr <= 38; lr++) {
    sheet.getRange(lr, 1).setBackground(COLORS.GREEN_BG); // colored dot
    sheet.getRange(lr, 2).setFontSize(9).setFontWeight('bold'); // who
    sheet.getRange(lr, 3, 1, 4).merge().setFontSize(9).setFontColor('#666666'); // what
    sheet.getRange(lr, 7).setFontSize(8).setFontColor('#999999'); // time
  }

  // --- ROW 39: spacer ---
  sheet.setRowHeight(39, 8);

  // --- ROW 40: ACTIONS hint ---
  sheet.getRange('A40:H40').merge()
    .setValue('⚡ ACTIONS — Use the 🐕 Wiggle menu above')
    .setFontWeight('bold')
    .setFontSize(11)
    .setFontColor('#888888');

  // --- ROW 41: spacer ---
  sheet.setRowHeight(41, 8);

  // --- ROW 42: THE BEAST header ---
  sheet.getRange('A42:H42').merge()
    .setValue('🦍 THE BEAST')
    .setFontWeight('bold')
    .setFontSize(14)
    .setFontColor(COLORS.ORANGE);

  // --- ROW 43: Beast subtitle ---
  sheet.getRange('A43:H43').merge()
    .setValue('Type anything below — the beast confirms before acting')
    .setFontColor('#888888')
    .setFontSize(10);

  // --- ROWS 44-48: Beast INPUT area ---
  sheet.getRange('A44:F48').merge()
    .setBackground('#fef5ed')
    .setFontSize(14)
    .setVerticalAlignment('top')
    .setWrap(true)
    .setBorder(true, true, true, true, false, false, COLORS.ORANGE, SpreadsheetApp.BorderStyle.SOLID);

  // Send hint (not a button — use the menu)
  sheet.getRange('G44:H48').merge()
    .setValue('Use menu:\n🐕 Wiggle → 🦍 Ask The Beast')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontSize(9)
    .setFontWeight('normal')
    .setFontStyle('italic')
    .setFontColor('#999999')
    .setBackground('#fef5ed')
    .setWrap(true)
    .setBorder(true, true, true, true, false, false, COLORS.ORANGE, SpreadsheetApp.BorderStyle.SOLID);

  // --- ROWS 49-58: Beast RESPONSE area ---
  sheet.getRange('A49:H58').merge()
    .setBackground(COLORS.SURFACE_ALT)
    .setFontSize(12)
    .setVerticalAlignment('top')
    .setWrap(true)
    .setBorder(true, true, true, true, false, false, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

  // --- ROW 59: Confirmation hint (not buttons — use the menu) ---
  sheet.getRange('A59:C59').merge()
    .setValue('Use menu: ✅ Confirm or ❌ Cancel Beast Action')
    .setFontWeight('normal')
    .setFontStyle('italic')
    .setFontSize(9)
    .setFontColor('#999999');

  // --- Freeze header row ---
  sheet.setFrozenRows(1);

  // --- Tab color ---
  sheet.setTabColor(COLORS.ORANGE);

  Logger.log('createDashboard: Dashboard tab created and formatted');
}


/**
 * Detects the current shift based on day of week and time.
 * @returns {string} 'Updates', 'Monday', or 'Friday'
 */
function detectShift_() {
  var now = new Date();
  var day = now.getDay(); // 0=Sun, 1=Mon, ...
  var hour = now.getHours();

  if (day === 1 && hour < 12) return 'Monday';
  if (day === 5) return 'Friday';
  return 'Updates';
}


/**
 * Writes an array of audit log entries to the dashboard log section.
 * @param {Sheet} sheet - The dashboard sheet
 * @param {Array} entries - Array of { who, what, time, color }
 */
function writeAuditLog_(sheet, entries) {
  // Clear log area first
  for (var lr = 29; lr <= 38; lr++) {
    sheet.getRange(lr, 1).setBackground(COLORS.SURFACE).clearContent();
    sheet.getRange(lr, 2).clearContent();
    sheet.getRange(lr, 3, 1, 4).merge().clearContent();
    sheet.getRange(lr, 7).clearContent();
  }

  var colorMap = {
    gen: COLORS.GREEN_BG,
    rod: COLORS.BLUE_BG,
    beast: COLORS.PURPLE_BG,
    system: COLORS.ORANGE_BG,
  };

  for (var i = 0; i < Math.min(entries.length, 10); i++) {
    var row = 29 + i;
    var entry = entries[i];
    var dotColor = colorMap[String(entry.color || 'system').toLowerCase()] || COLORS.ORANGE_BG;

    sheet.getRange(row, 1).setBackground(dotColor);
    sheet.getRange(row, 2).setValue(entry.who || '');
    sheet.getRange(row, 3, 1, 4).merge().setValue(entry.what || '');
    sheet.getRange(row, 7).setValue(entry.time || '');
  }
}


/**
 * Writes problem cards to the recap section (rows 6-9).
 * @param {Sheet} sheet - The dashboard sheet
 * @param {Array} problems - Array of { title, detail, severity: 'critical'|'warning'|'info' }
 */
function writeProblemCards_(sheet, problems) {
  // Clear cards area
  for (var r = 6; r <= 9; r++) {
    sheet.getRange(r, 1).setBackground(COLORS.BLUE_BG);
    sheet.getRange(r, 2).clearContent();
    sheet.getRange(r, 3, 1, 2).merge().clearContent();
    sheet.getRange(r, 5).setBackground(COLORS.BLUE_BG);
    sheet.getRange(r, 6).clearContent();
    sheet.getRange(r, 7, 1, 2).merge().clearContent();
  }

  if (!problems || problems.length === 0) {
    sheet.getRange('B6').setValue('No issues detected ✅').setFontColor('#999999');
    return;
  }

  var severityColor = {
    critical: COLORS.RED_BG,
    warning: COLORS.YELLOW_BG,
    info: COLORS.BLUE_BG,
  };

  for (var i = 0; i < Math.min(problems.length, 8); i++) {
    var row = 6 + Math.floor(i / 2);
    var isLeft = (i % 2 === 0);
    var indicatorCol = isLeft ? 1 : 5;
    var titleCol = isLeft ? 2 : 6;
    var detailCol = isLeft ? 3 : 7;

    var bg = severityColor[problems[i].severity] || COLORS.BLUE_BG;
    sheet.getRange(row, indicatorCol).setBackground(bg);
    sheet.getRange(row, titleCol).setValue(problems[i].title || '')
      .setFontColor('#333333').setFontWeight('bold');
    sheet.getRange(row, detailCol, 1, 2).merge()
      .setValue(problems[i].detail || '')
      .setFontColor('#666666');
  }
}


function getMondayMustAsk_() {
  try {
    var url = CONFIG.supabase.url + '/rest/v1/expected_schedule?type=eq.must_ask&monday=eq.true&select=dog_name,contact_method,contact_handle';
    var response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'apikey': CONFIG.supabase.anonKey,
        'Authorization': 'Bearer ' + CONFIG.supabase.anonKey,
      },
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
  } catch(e) {
    Logger.log('getMondayMustAsk_ error: ' + e.message);
  }
  return [];
}

/**
 * Refreshes the "Gen's Dashboard" — the "Refresh Dashboard" menu action.
 * Auto-detects shift, syncs Acuity, and populates all sections.
 */
function refreshDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.DASHBOARD);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Dashboard tab not found. Run Setup Tower first.');
    return;
  }

  // Determine active shift
  var manualShift = sheet.getRange('H3').getValue();
  var shift = (manualShift && manualShift !== '') ? String(manualShift) : detectShift_();

  // Update date
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy');
  sheet.getRange('A2').setValue(dateStr);

  // Update section header based on shift
  var shiftHeaders = {
    Updates: '📸 TODAY\'S RECAP',
    Monday: '☀️ MONDAY PREP',
    Friday: '💰 FRIDAY BILLING',
  };
  sheet.getRange('A5:H5').merge()
    .setValue(shiftHeaders[shift] || '📸 TODAY\'S RECAP');

  // Sync Acuity data
  var acuityData = syncAcuityToday();

  // --- Build problems based on shift ---
  var problems = [];

  if (shift === 'Updates') {
    // Check for unmatched names
    if (acuityData.unmatchedNames && acuityData.unmatchedNames.length > 0) {
      problems.push({
        title: '⚠️ Unmatched names',
        detail: acuityData.unmatchedNames.slice(0, 3).join(', '),
        severity: 'warning',
      });
    }
    // Check capacity
    for (var sName in acuityData.sectors) {
      var count = acuityData.sectors[sName].length;
      if (count >= CONFIG.capacity.critical) {
        problems.push({
          title: '🔴 ' + sName + ' at ' + count,
          detail: 'Over capacity limit (' + CONFIG.capacity.critical + ')',
          severity: 'critical',
        });
      } else if (count >= CONFIG.capacity.warning) {
        problems.push({
          title: '🟡 ' + sName + ' at ' + count,
          detail: 'Approaching capacity (' + CONFIG.capacity.warning + ')',
          severity: 'warning',
        });
      }
    }
    if (problems.length === 0) {
      problems.push({
        title: '✅ All clear',
        detail: acuityData.totalAppointments + ' walks today, no issues',
        severity: 'info',
      });
    }
  } else if (shift === 'Monday') {
    if (acuityData.unmatchedNames && acuityData.unmatchedNames.length > 0) {
      problems.push({
        title: '⚠️ Unmatched names',
        detail: acuityData.unmatchedNames.join(', '),
        severity: 'warning',
      });
    }
    for (var mSector in acuityData.sectors) {
      var mCount = acuityData.sectors[mSector].length;
      if (mCount >= CONFIG.capacity.warning) {
        problems.push({
          title: '⚠️ ' + mSector + ': ' + mCount + ' dogs',
          detail: 'Check group balance',
          severity: 'warning',
        });
      }
    }
    if (problems.length === 0) {
      problems.push({
        title: '✅ Monday ready',
        detail: acuityData.totalAppointments + ' walks scheduled',
        severity: 'info',
      });
    }
  } else if (shift === 'Friday') {
    // Billing summary
    var certs = fetchAcuityCertificates();
    var lowPackages = certs.filter(function(c) { return c.remaining <= 2 && c.remaining > 0; });
    var emptyPackages = certs.filter(function(c) { return c.remaining === 0; });

    if (emptyPackages.length > 0) {
      problems.push({
        title: '🔴 ' + emptyPackages.length + ' empty packages',
        detail: emptyPackages.slice(0, 2).map(function(c) { return c.clientName; }).join(', '),
        severity: 'critical',
      });
    }
    if (lowPackages.length > 0) {
      problems.push({
        title: '🟡 ' + lowPackages.length + ' low packages',
        detail: lowPackages.slice(0, 2).map(function(c) { return c.clientName + ' (' + c.remaining + ')'; }).join(', '),
        severity: 'warning',
      });
    }
    if (problems.length === 0) {
      problems.push({
        title: '✅ Billing clear',
        detail: 'All packages healthy',
        severity: 'info',
      });
    }
  }

  writeProblemCards_(sheet, problems);

  // --- Opportunities section (rows 12-16) ---
  var owlNotes = supabaseRequest('owl_notes?status=eq.active&select=*', 'GET') || [];

  if (shift === 'Monday') {
    // Must-Ask dogs for Monday
    var mustAsk = getMondayMustAsk_();
    sheet.getRange('A12:B12').merge()
      .setValue('📞 Must Ask (' + mustAsk.length + ')')
      .setBackground('#fef9ed');
    for (var ma = 0; ma < Math.min(mustAsk.length, 4); ma++) {
      var contact = mustAsk[ma].contact_method ? ' (' + mustAsk[ma].contact_method + ')' : '';
      sheet.getRange(13 + ma, 1, 1, 2).merge()
        .setValue('  ' + mustAsk[ma].dog_name + contact);
    }
  } else {
    // Follow-ups (unmatched names)
    sheet.getRange('A12:B12').merge()
      .setValue('🔄 Follow-ups (' + acuityData.unmatchedNames.length + ')');
    for (var fi = 0; fi < Math.min(acuityData.unmatchedNames.length, 4); fi++) {
      sheet.getRange(13 + fi, 1, 1, 2).merge()
        .setValue('  ' + acuityData.unmatchedNames[fi]);
    }
  }

  // Package Nudge
  var certs2 = shift === 'Friday' ? certs : fetchAcuityCertificates();
  var nudgeable = certs2.filter(function(c) { return c.remaining <= 3 && c.remaining > 0; });
  sheet.getRange('C12:D12').merge()
    .setValue('💰 Package Nudge (' + nudgeable.length + ')');
  for (var pi = 0; pi < Math.min(nudgeable.length, 4); pi++) {
    sheet.getRange(13 + pi, 3, 1, 2).merge()
      .setValue('  ' + nudgeable[pi].clientName + ' (' + nudgeable[pi].remaining + ' left)');
  }

  // Owl Notes
  sheet.getRange('E12:F12').merge()
    .setValue('🦉 Active Owl Notes (' + owlNotes.length + ')');
  for (var oi = 0; oi < Math.min(owlNotes.length, 4); oi++) {
    sheet.getRange(13 + oi, 5, 1, 2).merge()
      .setValue('  ' + (owlNotes[oi].target || '') + ': ' + (owlNotes[oi].message || '').substring(0, 30));
  }

  // --- Tasks section (rows 19-26) ---
  // Clear task rows
  for (var tc = 20; tc <= 26; tc++) {
    sheet.getRange(tc, 1).setValue(false);
    sheet.getRange(tc, 2).clearContent();
    sheet.getRange(tc, 3).clearContent();
    sheet.getRange(tc, 4).clearContent();
    sheet.getRange(tc, 5).setValue(false);
    sheet.getRange(tc, 6).clearContent();
    sheet.getRange(tc, 7).clearContent();
    sheet.getRange(tc, 8).clearContent();
  }

  // Read tasks from a "Tasks" data range (hidden in H column area)
  // Tasks are stored in a simple format: assignee | task | from | date | done
  var tasksData = supabaseRequest('tasks?status=eq.open&order=created_at.desc&limit=14&select=*', 'GET') || [];

  var genTasks = tasksData.filter(function(t) { return (t.assignee || '').toLowerCase() === 'gen'; });
  var rodTasks = tasksData.filter(function(t) { return (t.assignee || '').toLowerCase() === 'rod'; });

  for (var gi = 0; gi < Math.min(genTasks.length, 7); gi++) {
    var gr = 20 + gi;
    sheet.getRange(gr, 2).setValue(genTasks[gi].task || '');
    sheet.getRange(gr, 3).setValue(genTasks[gi].from_who || '');
    sheet.getRange(gr, 4).setValue(genTasks[gi].created_at ? genTasks[gi].created_at.substring(0, 10) : '');
  }

  for (var ri = 0; ri < Math.min(rodTasks.length, 7); ri++) {
    var rr = 20 + ri;
    sheet.getRange(rr, 6).setValue(rodTasks[ri].task || '');
    sheet.getRange(rr, 7).setValue(rodTasks[ri].from_who || '');
    sheet.getRange(rr, 8).setValue(rodTasks[ri].created_at ? rodTasks[ri].created_at.substring(0, 10) : '');
  }

  // --- Audit log (rows 29-38) ---
  var auditEntries = [];
  var timeNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  auditEntries.push({
    who: 'System',
    what: 'Dashboard refreshed — ' + shift + ' shift — ' + acuityData.totalAppointments + ' walks',
    time: timeNow,
    color: 'system',
  });

  if (acuityData.hasUnmatched) {
    auditEntries.push({
      who: 'System',
      what: '⚠️ ' + acuityData.unmatchedNames.length + ' unmatched names detected',
      time: timeNow,
      color: 'system',
    });
  }

  writeAuditLog_(sheet, auditEntries);

  Logger.log('refreshDashboard: Completed for ' + shift + ' shift');
}


/**
 * "Ask The Beast" — reads Gen's input, calls Claude, writes response.
 * Triggered from menu: 🐕 Wiggle → 🦍 Ask The Beast
 */
function askTheBeast() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.DASHBOARD);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Dashboard tab not found.');
    return;
  }

  // Read Gen's input from the beast input area (A44:F48)
  var input = sheet.getRange('A44').getValue();
  if (!input || String(input).trim() === '') {
    SpreadsheetApp.getUi().alert('Type something in the beast input area first!');
    return;
  }

  input = String(input).trim();

  // Get context
  var manualShift = sheet.getRange('H3').getValue();
  var shift = (manualShift && manualShift !== '') ? String(manualShift) : detectShift_();
  var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Get today's summary for context
  var todaySummary = copyTodaySummary();

  // Build system prompt
  var systemPrompt = 'You are The Beast 🦍, Wiggle Dog Walks\' AI assistant. ' +
    'You help Gen manage 93 dogs across Plateau and Laurier sectors in Montreal.\n\n' +
    'ALWAYS confirm before taking any action. Show what you\'ll do and ask for approval.\n\n' +
    'Available actions: add_vacation, update_dog, send_email, add_owl_note, add_task, resolve_name\n\n' +
    'Current date: ' + todayStr + '\n' +
    'Active shift: ' + shift + '\n\n' +
    'When proposing an action, format it as:\n' +
    'ACTION: <action_name>\nPARAMS: <json params>\n\n' +
    'Keep responses concise — this displays in a small area in Google Sheets.\n\n' +
    'Current dashboard state:\n' + todaySummary;

  // Call Claude API
  try {
    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.claude_api_key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: input }],
      }),
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    if (code !== 200) {
      sheet.getRange('A49').setValue('🦍 Error: HTTP ' + code + '\n' + response.getContentText().substring(0, 200));
      return;
    }

    var result = JSON.parse(response.getContentText());
    var beastReply = result.content[0].text || 'No response';

    // Check if Claude proposed an action
    var actionMatch = beastReply.match(/ACTION:\s*(\w+)/);
    var paramsMatch = beastReply.match(/PARAMS:\s*```?j?s?o?n?\s*(\{[\s\S]*?\})\s*```?/);
    if (!paramsMatch) {
      paramsMatch = beastReply.match(/PARAMS:\s*(\{[^}]+\})/);
    }

    if (actionMatch) {
      var actionType = actionMatch[1];
      var paramsStr = paramsMatch ? paramsMatch[1] : '{}';
      var params = {};
      try { params = JSON.parse(paramsStr); } catch(pe) { Logger.log('Beast params parse error: ' + pe); }

      // Store proposed action in PropertiesService (reliable cross-function storage)
      var proposedAction = {
        action: actionType,
        params: params,
        timestamp: new Date().toISOString(),
      };
      PropertiesService.getScriptProperties().setProperty('pendingBeastAction', JSON.stringify(proposedAction));

      // Build a FRIENDLY message instead of raw ACTION/PARAMS
      var friendlyMsg = formatBeastProposal_(actionType, params);
      sheet.getRange('A49').setValue(friendlyMsg);

      // Show confirmation hint
      sheet.getRange('A59').setValue('🦍 Do it')
        .setFontWeight('bold').setFontColor(COLORS.GREEN);
      sheet.getRange('D59').setValue('❌ Nah')
        .setFontWeight('bold').setFontColor(COLORS.RED);
    } else {
      // No action proposed — show reply as-is, clear pending action
      // Strip any stray ACTION/PARAMS fragments just in case
      sheet.getRange('A49').setValue('🦍 ' + beastReply);
      PropertiesService.getScriptProperties().deleteProperty('pendingBeastAction');
    }

    // Clear input area
    sheet.getRange('A44').clearContent();

    // Audit log entry
    var timeNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
    var existingLogs = [];
    for (var lr = 29; lr <= 38; lr++) {
      var who = sheet.getRange(lr, 2).getValue();
      if (who) {
        existingLogs.push({
          who: who,
          what: sheet.getRange(lr, 3).getValue(),
          time: sheet.getRange(lr, 7).getValue(),
          color: 'system',
        });
      }
    }
    existingLogs.unshift({
      who: 'Beast',
      what: 'Asked: "' + input.substring(0, 40) + '..."',
      time: timeNow,
      color: 'beast',
    });
    writeAuditLog_(sheet, existingLogs);

  } catch (e) {
    sheet.getRange('A49').setValue('🦍 Error: ' + e.message);
    Logger.log('askTheBeast error: ' + e.message);
  }
}


/**
 * Formats a Beast action proposal as a friendly human-readable message.
 * @param {string} actionType - The action name (add_vacation, update_dog, etc.)
 * @param {Object} params - The parsed action parameters
 * @returns {string} Friendly message for the response area
 */
function formatBeastProposal_(actionType, params) {
  // Ensure params is an object (might be a string from older storage)
  if (typeof params === 'string') {
    try { params = JSON.parse(params); } catch(e) { params = {}; }
  }
  if (!params || typeof params !== 'object') params = {};

  // Resolve name from many possible keys Claude might use
  var dog = params.dog_name || params.dog || params.walker || params.name || params.person || '(unknown)';
  var msg = '';

  switch (actionType) {
    case 'add_vacation':
      var start = params.start_date || params.start || params.from || '?';
      var end = params.end_date || params.end || params.to || params.until || '?';
      var notes = (params.notes || params.reason) ? ' — ' + (params.notes || params.reason) : '';
      msg = "🦍 I'll add " + dog + "'s vacation " + start + " to " + end + notes;
      break;
    case 'update_dog':
      msg = "🦍 I'll update " + dog + ": set " + (params.field || '?') + " to \"" + (params.value || '?') + '"';
      break;
    case 'add_owl_note':
      var target = params.target || params.dog || params.name || '(unknown)';
      var note = params.message || params.note || params.text || '?';
      msg = "🦍 I'll add an owl note for " + target + ': "' + note + '"';
      break;
    case 'add_task':
      var assignee = params.assignee || params.for || 'gen';
      var task = params.task || params.text || params.description || '?';
      msg = "🦍 I'll add a task for @" + assignee + ': "' + task + '"';
      break;
    case 'send_email':
      var recipient = params.to || params.recipient || params.email || dog;
      msg = "🦍 I'll draft an email to " + recipient + (params.subject ? ' re: ' + params.subject : '');
      break;
    case 'resolve_name':
      msg = "🦍 I'll map owner \"" + (params.owner_name || params.owner || '?') + '" to dog "' + dog + '"';
      break;
    default:
      msg = "🦍 I'll run action: " + actionType;
  }

  msg += '\n\nUse the menu: ✅ Confirm Beast Action or ❌ Cancel Beast Action';
  return msg;
}


/**
 * Confirms and executes the Beast's proposed action.
 * Triggered from menu: 🐕 Wiggle → ✅ Confirm Beast Action
 */
function confirmBeastAction() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.DASHBOARD);
  if (!sheet) return;

  var stored = PropertiesService.getScriptProperties().getProperty('pendingBeastAction');
  if (!stored || String(stored).trim() === '') {
    SpreadsheetApp.getUi().alert('No pending beast action to confirm.');
    return;
  }

  try {
    var proposed = JSON.parse(stored);
    var action = proposed.action;
    var params = typeof proposed.params === 'string' ? JSON.parse(proposed.params) : proposed.params;

    var resultMsg = '';

    switch (action) {
      case 'add_vacation':
        try {
          var vacName = params.dog_name || params.dog || params.walker || params.name || '';
          var vacStart = params.start_date || params.start || params.from || '';
          var vacEnd = params.end_date || params.end || params.to || params.until || '';
          var vacNotes = params.notes || params.reason || '';
          var messages = [];

          // ALWAYS write to Schedule Ecosystem (weekly overview)
          var schedSheet = ss.getSheetByName(TABS.SCHEDULE);
          if (schedSheet) {
            var vacRow = -1;
            for (var vr = 6; vr <= 25; vr++) {
              if (!schedSheet.getRange(vr, 1).getValue()) {
                vacRow = vr;
                break;
              }
            }
            if (vacRow > 0) {
              schedSheet.getRange(vacRow, 1).setValue(vacName);
              schedSheet.getRange(vacRow, 2).setValue('OFF');
              schedSheet.getRange(vacRow, 3).setValue(vacStart);
              schedSheet.getRange(vacRow, 4).setValue(vacEnd);
              schedSheet.getRange(vacRow, 5).setValue(vacNotes);
              schedSheet.getRange(vacRow, 6).setValue('Active');
              messages.push('📋 Added to Schedule Ecosystem');
            } else {
              messages.push('⚠️ Schedule vacation section full');
            }
          }

          // If it's a WALKER, also write to Staff tab vacations
          var walkerNames = ['megan','solene','chloe','amanda','belen','amelie','maeva','rodrigo','gen'];
          if (walkerNames.indexOf(vacName.toLowerCase().trim()) >= 0) {
            var staffSheet = ss.getSheetByName(TABS.STAFF);
            if (staffSheet) {
              var staffData = staffSheet.getDataRange().getValues();
              var vacHeaderRow = -1;
              for (var sr = 0; sr < staffData.length; sr++) {
                var cellText = String(staffData[sr][0]).toLowerCase();
                if (cellText.indexOf('walker vacations') >= 0 || cellText.indexOf('vacations & substitutions') >= 0) {
                  vacHeaderRow = sr + 1;
                  break;
                }
              }
              if (vacHeaderRow > 0) {
                var dataRow = -1;
                for (var wr = vacHeaderRow + 1; wr <= vacHeaderRow + 20; wr++) {
                  var cellVal = staffSheet.getRange(wr, 1).getValue();
                  if (wr === vacHeaderRow + 1 && String(cellVal).toLowerCase() === 'walker') continue;
                  if (!cellVal || String(cellVal).trim() === '') {
                    dataRow = wr;
                    break;
                  }
                }
                if (dataRow > 0) {
                  staffSheet.getRange(dataRow, 1).setValue(vacName);
                  staffSheet.getRange(dataRow, 2).setValue(vacStart);
                  staffSheet.getRange(dataRow, 3).setValue(vacEnd);
                  staffSheet.getRange(dataRow, 9).setValue(vacNotes);
                  messages.push('👥 Added to Staff vacations');
                } else {
                  messages.push('⚠️ Staff vacation section full');
                }
              }
            }
          }

          resultMsg = '✅ Vacation added for ' + vacName + ': ' + vacStart + ' to ' + vacEnd + '\n' + messages.join(' · ');
        } catch (vacErr) {
          resultMsg = '❌ Failed to add vacation: ' + vacErr.message;
          Logger.log('confirmBeastAction add_vacation error: ' + vacErr.message);
        }
        break;

      case 'update_dog':
        var field = params.field || '';
        var value = params.value || '';
        var dogName = params.dog_name || params.dog || '';
        var updated = pushDogUpdate(dogName, field, value);
        resultMsg = updated ? '✅ Updated ' + dogName + ': ' + field + ' → ' + value : '❌ Failed to update';
        break;

      case 'add_owl_note':
        var pushed = pushOwlNote(
          params.target || params.dog || '',
          params.message || params.note || '',
          'Beast',
          params.expires || null
        );
        resultMsg = pushed ? '✅ Owl note added' : '❌ Failed to add owl note';
        break;

      case 'add_task':
        var taskResult = supabaseRequest('tasks', 'POST', {
          assignee: params.assignee || 'gen',
          task: params.task || params.text || '',
          from_who: 'Beast',
          status: 'open',
        });
        resultMsg = taskResult ? '✅ Task added for @' + (params.assignee || 'gen') : '❌ Failed to add task';
        break;

      case 'resolve_name':
        var mapResult = supabaseRequest('name_mappings', 'POST', {
          owner_name: (params.owner_name || params.owner || '').toLowerCase().trim(),
          dog_name: params.dog_name || params.dog || '',
        });
        resultMsg = mapResult ? '✅ Name mapping saved' : '❌ Failed to save mapping';
        break;

      case 'send_email':
        resultMsg = '📧 Email actions coming in Prompt 7';
        break;

      default:
        resultMsg = '❓ Unknown action: ' + action;
    }

    // Write result
    sheet.getRange('A49').setValue('🦍 ' + resultMsg);

    // Clear proposed action
    PropertiesService.getScriptProperties().deleteProperty('pendingBeastAction');
    sheet.getRange('A59').clearContent();
    sheet.getRange('D59').clearContent();

    // Audit log
    var timeNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
    var existingLogs = [];
    for (var lr = 29; lr <= 38; lr++) {
      var who = sheet.getRange(lr, 2).getValue();
      if (who) {
        existingLogs.push({
          who: who,
          what: sheet.getRange(lr, 3).getValue(),
          time: sheet.getRange(lr, 7).getValue(),
          color: 'system',
        });
      }
    }
    existingLogs.unshift({
      who: 'Beast',
      what: '✅ Executed: ' + action,
      time: timeNow,
      color: 'beast',
    });
    writeAuditLog_(sheet, existingLogs);

    // Refresh dashboard
    refreshDashboard();

  } catch (e) {
    sheet.getRange('A49').setValue('🦍 Error executing action: ' + e.message);
    Logger.log('confirmBeastAction error: ' + e.message);
  }
}


/**
 * Cancels the Beast's proposed action.
 * Triggered from menu: 🐕 Wiggle → ❌ Cancel Beast Action
 */
function cancelBeastAction() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.DASHBOARD);
  if (!sheet) return;

  // Clear proposed action
  PropertiesService.getScriptProperties().deleteProperty('pendingBeastAction');

  // Write cancellation to response area
  sheet.getRange('A49').setValue('❌ Cancelled — no action taken.');

  // Clear confirmation labels
  sheet.getRange('A59').clearContent();
  sheet.getRange('D59').clearContent();

  // Audit log
  var timeNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  var existingLogs = [];
  for (var lr = 29; lr <= 38; lr++) {
    var who = sheet.getRange(lr, 2).getValue();
    if (who) {
      existingLogs.push({
        who: who,
        what: sheet.getRange(lr, 3).getValue(),
        time: sheet.getRange(lr, 7).getValue(),
        color: 'system',
      });
    }
  }
  existingLogs.unshift({
    who: 'Beast',
    what: '❌ Action cancelled by user',
    time: timeNow,
    color: 'beast',
  });
  writeAuditLog_(sheet, existingLogs);
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEEKLY BOARD — Creation + Refresh
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Helper: returns the Monday of the current week as a Date.
 */
function getMonday_() {
  var now = new Date();
  var day = now.getDay(); // 0=Sun, 1=Mon... 6=Sat
  var offset;
  if (day === 0) {
    offset = 1; // Sunday: next Monday is tomorrow
  } else if (day === 6) {
    offset = 2; // Saturday: next Monday is in 2 days
  } else {
    offset = 1 - day; // Weekday: this week's Monday
  }
  var monday = new Date(now);
  monday.setDate(now.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Helper: returns an array of Date objects for Mon-Fri of the week.
 */
function getWeekDates_(monday) {
  var dates = [];
  for (var i = 0; i < 5; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Helper: formats a Date as "Mon 7", "Tue 8", etc.
 */
function shortDayHeader_(date) {
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()] + ' ' + date.getDate();
}

/**
 * Helper: reads walker vacations from the Staff tab.
 * Returns array of { name, startDate, endDate } for vacations active this week.
 */
function getWalkerVacations_(ss, monday, friday) {
  var vacations = [];
  var staffSheet = ss.getSheetByName(TABS.STAFF);
  if (!staffSheet) return vacations;

  var data = staffSheet.getDataRange().getValues();
  if (data.length < 2) return vacations;

  var headers = data[0];
  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[String(headers[c]).toLowerCase().trim()] = c;
  }

  var nameCol = colMap['name'] !== undefined ? colMap['name'] :
                colMap['walker'] !== undefined ? colMap['walker'] : 0;
  var vacStartCol = colMap['vacation_start'] !== undefined ? colMap['vacation_start'] :
                    colMap['vacation start'] !== undefined ? colMap['vacation start'] :
                    colMap['vac_start'] !== undefined ? colMap['vac_start'] : -1;
  var vacEndCol = colMap['vacation_end'] !== undefined ? colMap['vacation_end'] :
                  colMap['vacation end'] !== undefined ? colMap['vacation end'] :
                  colMap['vac_end'] !== undefined ? colMap['vac_end'] : -1;

  if (vacStartCol < 0 || vacEndCol < 0) return vacations;

  for (var r = 1; r < data.length; r++) {
    var vStart = data[r][vacStartCol];
    var vEnd = data[r][vacEndCol];
    if (!vStart || !vEnd) continue;

    var startDate = new Date(vStart);
    var endDate = new Date(vEnd);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

    // Check if vacation overlaps this week
    if (startDate <= friday && endDate >= monday) {
      vacations.push({
        name: String(data[r][nameCol] || '').trim(),
        startDate: startDate,
        endDate: endDate,
      });
    }
  }

  return vacations;
}

/**
 * Helper: reads walker schedule from the Staff tab.
 * Returns map of { dayName: { Plateau: [walkerNames], Laurier: [walkerNames] } }
 */
function getWalkerSchedule_(ss) {
  var schedule = {};
  var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  for (var d = 0; d < dayNames.length; d++) {
    schedule[dayNames[d]] = { Plateau: [], Laurier: [] };
  }

  var staffSheet = ss.getSheetByName(TABS.STAFF);
  if (!staffSheet) return schedule;

  var data = staffSheet.getDataRange().getValues();
  if (data.length < 2) return schedule;

  var headers = data[0];
  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[String(headers[c]).toLowerCase().trim()] = c;
  }

  var nameCol = colMap['name'] !== undefined ? colMap['name'] :
                colMap['walker'] !== undefined ? colMap['walker'] : 0;
  var sectorCol = colMap['sector'] !== undefined ? colMap['sector'] : -1;

  // Look for day columns: monday, tuesday, etc. or mon, tue, etc.
  var dayColMap = {};
  for (var di = 0; di < dayNames.length; di++) {
    var dn = dayNames[di];
    var short = dn.substring(0, 3);
    dayColMap[dn] = colMap[dn] !== undefined ? colMap[dn] :
                    colMap[short] !== undefined ? colMap[short] : -1;
  }

  for (var r = 1; r < data.length; r++) {
    var walkerName = String(data[r][nameCol] || '').trim();
    if (!walkerName) continue;

    var walkerSector = sectorCol >= 0 ? String(data[r][sectorCol] || '').trim() : '';

    for (var di2 = 0; di2 < dayNames.length; di2++) {
      var col = dayColMap[dayNames[di2]];
      if (col < 0) continue;

      var cellStr = String(data[r][col]).trim();
      // Staff tab has sector names like "Plateau", "Laurier" — not booleans
      if (cellStr === 'Plateau' || cellStr === 'Laurier') {
        schedule[dayNames[di2]][cellStr].push(walkerName);
      }
    }
  }

  return schedule;
}

/**
 * Helper: reads dog vacations from the Schedule Ecosystem tab.
 * Returns array of { dogName, type, reason, startDate, endDate }
 */
function getDogVacations_(ss, monday, friday) {
  var vacations = [];
  var schedSheet = ss.getSheetByName(TABS.SCHEDULE);
  if (!schedSheet) return vacations;

  var data = schedSheet.getDataRange().getValues();
  if (data.length < 2) return vacations;

  var headers = data[0];
  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[String(headers[c]).toLowerCase().trim()] = c;
  }

  var targetCol = colMap['target'] !== undefined ? colMap['target'] :
                  colMap['dog'] !== undefined ? colMap['dog'] :
                  colMap['dog_name'] !== undefined ? colMap['dog_name'] : 0;
  var typeCol = colMap['type'] !== undefined ? colMap['type'] : -1;
  var reasonCol = colMap['reason'] !== undefined ? colMap['reason'] :
                  colMap['message'] !== undefined ? colMap['message'] : -1;
  var startCol = colMap['start'] !== undefined ? colMap['start'] :
                 colMap['start_date'] !== undefined ? colMap['start_date'] :
                 colMap['from'] !== undefined ? colMap['from'] : -1;
  var endCol = colMap['end'] !== undefined ? colMap['end'] :
               colMap['end_date'] !== undefined ? colMap['end_date'] :
               colMap['to'] !== undefined ? colMap['to'] : -1;
  var statusCol = colMap['status'] !== undefined ? colMap['status'] : -1;

  for (var r = 1; r < data.length; r++) {
    var rowType = typeCol >= 0 ? String(data[r][typeCol] || '').toLowerCase().trim() : '';
    var rowStatus = statusCol >= 0 ? String(data[r][statusCol] || '').toLowerCase().trim() : 'active';

    if (rowType !== 'vacation' && rowType !== 'off' && rowType !== 'holiday') continue;
    if (rowStatus === 'cancelled' || rowStatus === 'expired') continue;

    var sDate = startCol >= 0 ? data[r][startCol] : null;
    var eDate = endCol >= 0 ? data[r][endCol] : null;
    if (!sDate) continue;

    var startDate = new Date(sDate);
    var endDate = eDate ? new Date(eDate) : new Date(sDate);
    if (isNaN(startDate.getTime())) continue;
    if (isNaN(endDate.getTime())) endDate = startDate;

    // Check overlap with week
    if (startDate <= friday && endDate >= monday) {
      vacations.push({
        dogName: String(data[r][targetCol] || '').trim(),
        type: 'Dog',
        reason: reasonCol >= 0 ? String(data[r][reasonCol] || '').trim() : 'Vacation',
        startDate: startDate,
        endDate: endDate,
      });
    }
  }

  return vacations;
}

/**
 * Helper: reads active owl notes from the Schedule Ecosystem tab.
 * Returns array of { target, message, expires }
 */
function getActiveOwlNotes_(ss) {
  var notes = [];
  var schedSheet = ss.getSheetByName(TABS.SCHEDULE);
  if (!schedSheet) return notes;

  var data = schedSheet.getDataRange().getValues();
  if (data.length < 2) return notes;

  var headers = data[0];
  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[String(headers[c]).toLowerCase().trim()] = c;
  }

  var targetCol = colMap['target'] !== undefined ? colMap['target'] : 0;
  var messageCol = colMap['message'] !== undefined ? colMap['message'] : -1;
  var expiresCol = colMap['expires'] !== undefined ? colMap['expires'] :
                   colMap['expires_at'] !== undefined ? colMap['expires_at'] : -1;
  var typeCol = colMap['type'] !== undefined ? colMap['type'] : -1;
  var statusCol = colMap['status'] !== undefined ? colMap['status'] : -1;

  for (var r = 1; r < data.length; r++) {
    var rowType = typeCol >= 0 ? String(data[r][typeCol] || '').toLowerCase().trim() : '';
    var rowStatus = statusCol >= 0 ? String(data[r][statusCol] || '').toLowerCase().trim() : '';

    if (rowType === 'owl_note' || rowType === 'owl note' || rowType === 'note') {
      if (rowStatus === 'active' || rowStatus === '') {
        notes.push({
          target: String(data[r][targetCol] || '').trim(),
          message: messageCol >= 0 ? String(data[r][messageCol] || '').trim() : '',
          expires: expiresCol >= 0 ? data[r][expiresCol] : '',
        });
      }
    }
  }

  return notes;
}

/**
 * Helper: reads billing/package data. Returns map of dogName → remaining count.
 */
function getPackageWarnings_(ss) {
  var warnings = {};
  var certs = fetchAcuityCertificates();
  var ownerMap = getOwnerToDogMap();

  for (var i = 0; i < certs.length; i++) {
    var clientKey = (certs[i].clientName || '').toLowerCase().trim().split(' ')[0];
    var dogName = ownerMap[clientKey] || certs[i].clientName;
    var remaining = parseInt(certs[i].remaining, 10) || 0;

    if (remaining <= 3 && remaining > 0) {
      warnings[dogName] = remaining;
    }
  }

  return warnings;
}

/**
 * Helper: reads dogs roster and returns map of dogName → { sector, address }.
 */
function getDogRosterMap_(ss) {
  var map = {};
  var dogsSheet = ss.getSheetByName(TABS.DOGS);
  if (!dogsSheet) return map;

  var data = dogsSheet.getDataRange().getValues();
  if (data.length < 2) return map;

  var headers = data[0];
  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[String(headers[c]).toLowerCase().trim()] = c;
  }

  var nameCol = colMap['dog_name'] !== undefined ? colMap['dog_name'] :
                colMap['dog name'] !== undefined ? colMap['dog name'] :
                colMap['name'] !== undefined ? colMap['name'] : 0;
  var sectorCol = colMap['sector'] !== undefined ? colMap['sector'] : -1;
  var addressCol = colMap['address'] !== undefined ? colMap['address'] : -1;

  for (var r = 1; r < data.length; r++) {
    var name = String(data[r][nameCol] || '').trim();
    if (!name) continue;
    map[name] = {
      sector: sectorCol >= 0 ? String(data[r][sectorCol] || '').trim() : '',
      address: addressCol >= 0 ? String(data[r][addressCol] || '').trim() : '',
    };
  }

  return map;
}


/**
 * Creates and formats the "Weekly Board" tab.
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function createWeeklyBoard(ss) {
  var sheet = ss.getSheetByName(TABS.WEEKLY);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.WEEKLY);
  }
  sheet.clear();

  var monday = getMonday_();
  var weekDates = getWeekDates_(monday);
  var friday = weekDates[4];
  var tz = Session.getScriptTimeZone();

  // Column widths: A=140, B-F=180
  sheet.setColumnWidth(1, 140);
  for (var col = 2; col <= 6; col++) {
    sheet.setColumnWidth(col, 180);
  }

  // --- ROW 1: Title bar ---
  sheet.getRange('A1:F1').merge()
    .setValue('📅 Weekly Board')
    .setBackground(COLORS.ORANGE)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontSize(20)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 48);

  // --- ROW 2: Dynamic subtitle (date range + walker vacations) ---
  var startStr = Utilities.formatDate(monday, tz, 'MMMM d');
  var endStr = Utilities.formatDate(friday, tz, 'd, yyyy');
  var subtitle = startStr + '-' + endStr;

  // Append walker vacations active this week
  var walkerVacs = getWalkerVacations_(ss, monday, friday);
  if (walkerVacs.length > 0) {
    var vacParts = [];
    for (var v = 0; v < walkerVacs.length; v++) {
      var wv = walkerVacs[v];
      var vStart = Utilities.formatDate(wv.startDate, tz, 'MMM d');
      var vEnd = Utilities.formatDate(wv.endDate, tz, 'd');
      vacParts.push(wv.name + ' on vacation (' + vStart + '-' + vEnd + ')');
    }
    subtitle += ' \u00B7 ' + vacParts.join(', ');
  }

  sheet.getRange('A2:F2').merge()
    .setValue(subtitle)
    .setFontColor('#888888')
    .setFontSize(10);

  // --- ROW 3: spacer ---
  sheet.setRowHeight(3, 8);

  // --- ROW 4: Week grid header ---
  var today = new Date();
  var todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');

  sheet.getRange('A4').setValue('').setBackground(COLORS.SURFACE_ALT);

  for (var di = 0; di < 5; di++) {
    var cell = sheet.getRange(4, di + 2); // B4-F4
    cell.setValue(shortDayHeader_(weekDates[di]))
      .setFontColor(COLORS.HEADER_TEXT)
      .setFontWeight('bold')
      .setFontSize(13)
      .setHorizontalAlignment('center');

    var dateCheck = Utilities.formatDate(weekDates[di], tz, 'yyyy-MM-dd');
    if (dateCheck === todayStr) {
      cell.setBackground(COLORS.ORANGE_DARK);
    } else {
      cell.setBackground(COLORS.ORANGE);
    }
  }

  // --- ROWS 5-17: PLATEAU section ---
  sheet.getRange('A5:A17').merge()
    .setValue('🏔️ Plateau')
    .setBackground(COLORS.PLATEAU)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(13)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // Format Plateau data cells
  for (var pr = 5; pr <= 17; pr++) {
    for (var pc = 2; pc <= 6; pc++) {
      sheet.getRange(pr, pc)
        .setVerticalAlignment('top')
        .setWrap(true)
        .setFontSize(9)
        .setBackground(COLORS.PLATEAU_BG);
    }
  }

  // --- ROWS 18-30: LAURIER section ---
  sheet.getRange('A18:A30').merge()
    .setValue('🌳 Laurier')
    .setBackground(COLORS.LAURIER)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(13)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // Format Laurier data cells
  for (var lr = 18; lr <= 30; lr++) {
    for (var lc = 2; lc <= 6; lc++) {
      sheet.getRange(lr, lc)
        .setVerticalAlignment('top')
        .setWrap(true)
        .setFontSize(9)
        .setBackground(COLORS.LAURIER_BG);
    }
  }

  // --- ROW 31: spacer ---
  sheet.setRowHeight(31, 12);

  // --- ROW 32: NOT WALKING header ---
  sheet.getRange('A32:F32').merge()
    .setValue('🏖️ NOT WALKING THIS WEEK')
    .setFontWeight('bold')
    .setFontSize(12);

  // --- ROW 33: Column headers ---
  sheet.getRange('A33').setValue('Name').setFontWeight('bold').setFontSize(10);
  sheet.getRange('B33').setValue('Type').setFontWeight('bold').setFontSize(10);
  sheet.getRange('C33').setValue('Reason').setFontWeight('bold').setFontSize(10);
  sheet.getRange('D33:F33').merge().setValue('Dates').setFontWeight('bold').setFontSize(10);
  sheet.getRange('A33:F33').setBackground(COLORS.SURFACE_ALT);

  // --- ROWS 34-43: Placeholder for not-walking data ---
  for (var nw = 34; nw <= 43; nw++) {
    sheet.getRange(nw, 1).setFontSize(9);
    sheet.getRange(nw, 2).setFontSize(9);
    sheet.getRange(nw, 3).setFontSize(9);
    sheet.getRange(nw, 4, 1, 3).merge().setFontSize(9);
  }

  // --- ROW 44: spacer ---
  sheet.setRowHeight(44, 12);

  // --- ROW 45: THIS WEEK header ---
  sheet.getRange('A45:F45').merge()
    .setValue('📋 THIS WEEK')
    .setFontWeight('bold')
    .setFontSize(12);

  // --- ROWS 46-48: Owl Notes summary ---
  sheet.getRange('A46').setValue('Target').setFontWeight('bold').setFontSize(9).setFontColor('#888888');
  sheet.getRange('B46:C46').merge().setValue('Message').setFontWeight('bold').setFontSize(9).setFontColor('#888888');
  sheet.getRange('D46').setValue('Expires').setFontWeight('bold').setFontSize(9).setFontColor('#888888');
  for (var on = 47; on <= 48; on++) {
    sheet.getRange(on, 1).setFontSize(9);
    sheet.getRange(on, 2, 1, 2).merge().setFontSize(9);
    sheet.getRange(on, 4).setFontSize(9);
  }

  // --- ROWS 49-51: Open Tasks summary ---
  sheet.getRange('A49').setValue('@gen').setFontWeight('bold').setFontSize(9).setFontColor(COLORS.ORANGE);
  sheet.getRange('B49').setValue('@rod').setFontWeight('bold').setFontSize(9).setFontColor(COLORS.BLUE);
  sheet.getRange('C49').setValue('Unassigned').setFontWeight('bold').setFontSize(9).setFontColor('#888888');
  for (var ot = 50; ot <= 51; ot++) {
    sheet.getRange(ot, 1).setFontSize(9);
    sheet.getRange(ot, 2).setFontSize(9);
    sheet.getRange(ot, 3).setFontSize(9);
  }

  // --- ROWS 52-54: Capacity check ---
  sheet.getRange('A52').setValue('Day').setFontWeight('bold').setFontSize(9).setFontColor('#888888');
  sheet.getRange('B52').setValue('Plateau').setFontWeight('bold').setFontSize(9).setFontColor(COLORS.PLATEAU);
  sheet.getRange('C52').setValue('Laurier').setFontWeight('bold').setFontSize(9).setFontColor(COLORS.LAURIER);
  sheet.getRange('D52').setValue('Status').setFontWeight('bold').setFontSize(9).setFontColor('#888888');

  // --- Freeze header rows ---
  sheet.setFrozenRows(4);

  // --- Tab color ---
  sheet.setTabColor(COLORS.ORANGE);

  Logger.log('createWeeklyBoard: Weekly Board tab created and formatted');
}


/**
 * Refreshes the Weekly Board with live data from Acuity, Schedule,
 * Staff, Billing, and Dogs tabs.
 */
function refreshWeeklyBoard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.WEEKLY);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Weekly Board tab not found. Run Setup Tower first.');
    return;
  }

  var tz = Session.getScriptTimeZone();
  var monday = getMonday_();
  var weekDates = getWeekDates_(monday);
  var friday = weekDates[4];
  var today = new Date();
  var todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
  var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  // --- Gather data ---
  var acuityWeek = syncAcuityWeek();
  var dogVacations = getDogVacations_(ss, monday, friday);
  var walkerVacations = getWalkerVacations_(ss, monday, friday);
  var walkerSchedule = getWalkerSchedule_(ss);
  var packageWarnings = getPackageWarnings_(ss);
  var dogRoster = getDogRosterMap_(ss);

  // Build set of dogs on vacation per day
  var vacationSetByDay = {};
  for (var d = 0; d < 5; d++) {
    vacationSetByDay[dayNames[d]] = {};
  }
  for (var vi = 0; vi < dogVacations.length; vi++) {
    var vac = dogVacations[vi];
    for (var vd = 0; vd < 5; vd++) {
      if (vac.startDate <= weekDates[vd] && vac.endDate >= weekDates[vd]) {
        vacationSetByDay[dayNames[vd]][vac.dogName.toLowerCase()] = true;
      }
    }
  }

  // Build set of walkers on vacation per day
  var walkerVacByDay = {};
  for (var wd = 0; wd < 5; wd++) {
    walkerVacByDay[dayNames[wd]] = {};
  }
  for (var wvi = 0; wvi < walkerVacations.length; wvi++) {
    var wv = walkerVacations[wvi];
    for (var wvd = 0; wvd < 5; wvd++) {
      if (wv.startDate <= weekDates[wvd] && wv.endDate >= weekDates[wvd]) {
        walkerVacByDay[dayNames[wvd]][wv.name.toLowerCase()] = true;
      }
    }
  }

  // --- Update ROW 2 subtitle ---
  var startStr = Utilities.formatDate(monday, tz, 'MMMM d');
  var endStr = Utilities.formatDate(friday, tz, 'd, yyyy');
  var subtitle = startStr + '-' + endStr;
  if (walkerVacations.length > 0) {
    var vacParts = [];
    for (var sv = 0; sv < walkerVacations.length; sv++) {
      var swv = walkerVacations[sv];
      var svStart = Utilities.formatDate(swv.startDate, tz, 'MMM d');
      var svEnd = Utilities.formatDate(swv.endDate, tz, 'd');
      vacParts.push(swv.name + ' on vacation (' + svStart + '-' + svEnd + ')');
    }
    subtitle += ' \u00B7 ' + vacParts.join(', ');
  }
  sheet.getRange('A2:F2').merge().setValue(subtitle);

  // --- Update ROW 4 day headers (Mon 23, Tue 24, etc.) ---
  for (var dhi = 0; dhi < 5; dhi++) {
    sheet.getRange(4, dhi + 2).setValue(shortDayHeader_(weekDates[dhi]));
  }

  // --- Capacity tracking for header coloring ---
  var capacityByDay = {};

  // --- Sector config: startRow for data cells ---
  var sectorConfig = [
    { name: 'Plateau', startRow: 5, endRow: 17 },
    { name: 'Laurier', startRow: 18, endRow: 30 },
  ];

  // --- Populate grid for each sector and day ---
  for (var si = 0; si < sectorConfig.length; si++) {
    var sec = sectorConfig[si];

    for (var di = 0; di < 5; di++) {
      var dayName = dayNames[di];
      var colIdx = di + 2; // B=2, C=3, D=4, E=5, F=6

      // Clear cells in this sector column
      for (var cr = sec.startRow; cr <= sec.endRow; cr++) {
        sheet.getRange(cr, colIdx).setValue('');
      }

      // Get appointments for this day+sector
      var dayData = acuityWeek.days[dayName];
      if (!dayData || !dayData.sectors[sec.name]) continue;

      var dogs = dayData.sectors[sec.name];

      // Filter out vacationing dogs
      var activeDogs = [];
      for (var ai = 0; ai < dogs.length; ai++) {
        var dogKey = (dogs[ai].dogName || '').toLowerCase();
        if (!vacationSetByDay[dayName][dogKey]) {
          activeDogs.push(dogs[ai]);
        }
      }

      // Split AM/PM based on time (before/after noon)
      var amDogs = [];
      var pmDogs = [];
      for (var ti = 0; ti < activeDogs.length; ti++) {
        var timeStr = activeDogs[ti].time || '';
        var hour = 10; // Default to AM
        if (timeStr) {
          var timeParts = timeStr.match(/(\d{1,2}):(\d{2})/);
          if (timeParts) {
            hour = parseInt(timeParts[1], 10);
            // Handle datetime strings like "2026-03-23T14:00:00"
            if (timeStr.indexOf('T') >= 0) {
              var tPart = timeStr.split('T')[1];
              var tMatch = tPart.match(/(\d{1,2})/);
              if (tMatch) hour = parseInt(tMatch[1], 10);
            }
          }
        }
        if (hour >= 12) {
          pmDogs.push(activeDogs[ti]);
        } else {
          amDogs.push(activeDogs[ti]);
        }
      }

      // Build cell content with prefixes
      var lines = [];

      for (var ami = 0; ami < amDogs.length; ami++) {
        lines.push(formatDogLine_(amDogs[ami], packageWarnings, dogRoster, sec.name));
      }

      if (pmDogs.length > 0) {
        if (lines.length > 0) lines.push('🕐 PM');
        for (var pmi = 0; pmi < pmDogs.length; pmi++) {
          lines.push(formatDogLine_(pmDogs[pmi], packageWarnings, dogRoster, sec.name));
        }
      }

      // Get walkers for this day+sector (excluding vacationing walkers)
      var dayWalkers = walkerSchedule[dayName][sec.name] || [];
      for (var wi = 0; wi < dayWalkers.length; wi++) {
        if (!walkerVacByDay[dayName][dayWalkers[wi].toLowerCase()]) {
          lines.push('👤 ' + dayWalkers[wi]);
        }
      }

      // Write to cell — use the first cell of the sector range
      var cellContent = lines.join('\n');
      sheet.getRange(sec.startRow, colIdx).setValue(cellContent);

      // Track capacity
      if (!capacityByDay[dayName]) {
        capacityByDay[dayName] = { Plateau: 0, Laurier: 0 };
      }
      capacityByDay[dayName][sec.name] = activeDogs.length;
    }
  }

  // --- Color day headers based on capacity ---
  for (var hi = 0; hi < 5; hi++) {
    var hDayName = dayNames[hi];
    var headerCell = sheet.getRange(4, hi + 2);
    var dateCheck = Utilities.formatDate(weekDates[hi], tz, 'yyyy-MM-dd');

    var totalPlateau = capacityByDay[hDayName] ? capacityByDay[hDayName].Plateau : 0;
    var totalLaurier = capacityByDay[hDayName] ? capacityByDay[hDayName].Laurier : 0;
    var maxCount = Math.max(totalPlateau, totalLaurier);

    if (dateCheck === todayStr) {
      headerCell.setBackground(COLORS.ORANGE_DARK);
    } else if (maxCount >= CONFIG.capacity.critical) {
      headerCell.setBackground(COLORS.RED);
    } else if (maxCount >= CONFIG.capacity.warning) {
      headerCell.setBackground(COLORS.YELLOW);
    } else {
      headerCell.setBackground(COLORS.ORANGE);
    }

    // Keep text styling
    headerCell.setFontColor(COLORS.HEADER_TEXT)
      .setFontWeight('bold')
      .setFontSize(13)
      .setHorizontalAlignment('center');
  }

  // --- NOT WALKING section (rows 34-43) ---
  // Clear
  for (var nwr = 34; nwr <= 43; nwr++) {
    sheet.getRange(nwr, 1).clearContent().setFontColor(null);
    sheet.getRange(nwr, 2).clearContent();
    sheet.getRange(nwr, 3).clearContent();
    sheet.getRange(nwr, 4, 1, 3).merge().clearContent();
  }

  var notWalkingRow = 34;

  // Dog vacations
  for (var dvi = 0; dvi < dogVacations.length && notWalkingRow <= 43; dvi++) {
    var dv = dogVacations[dvi];
    var dvStart = Utilities.formatDate(dv.startDate, tz, 'MMM d');
    var dvEnd = Utilities.formatDate(dv.endDate, tz, 'MMM d');
    sheet.getRange(notWalkingRow, 1).setValue(dv.dogName);
    sheet.getRange(notWalkingRow, 2).setValue('Dog');
    sheet.getRange(notWalkingRow, 3).setValue(dv.reason || 'Vacation');
    sheet.getRange(notWalkingRow, 4, 1, 3).merge().setValue(dvStart + ' - ' + dvEnd);
    notWalkingRow++;
  }

  // Walker vacations (in blue text)
  for (var wvi2 = 0; wvi2 < walkerVacations.length && notWalkingRow <= 43; wvi2++) {
    var wv2 = walkerVacations[wvi2];
    var wvStart = Utilities.formatDate(wv2.startDate, tz, 'MMM d');
    var wvEnd = Utilities.formatDate(wv2.endDate, tz, 'MMM d');
    sheet.getRange(notWalkingRow, 1).setValue(wv2.name).setFontColor(COLORS.BLUE);
    sheet.getRange(notWalkingRow, 2).setValue('Walker').setFontColor(COLORS.BLUE);
    sheet.getRange(notWalkingRow, 3).setValue('Vacation').setFontColor(COLORS.BLUE);
    sheet.getRange(notWalkingRow, 4, 1, 3).merge()
      .setValue(wvStart + ' - ' + wvEnd).setFontColor(COLORS.BLUE);
    notWalkingRow++;
  }

  // --- THIS WEEK section ---
  // Owl Notes (rows 47-48)
  var owlNotes = getActiveOwlNotes_(ss);
  for (var oni = 0; oni < Math.min(owlNotes.length, 2); oni++) {
    var noteRow = 47 + oni;
    sheet.getRange(noteRow, 1).setValue(owlNotes[oni].target);
    sheet.getRange(noteRow, 2, 1, 2).merge().setValue(owlNotes[oni].message);
    var expStr = '';
    if (owlNotes[oni].expires) {
      try {
        expStr = Utilities.formatDate(new Date(owlNotes[oni].expires), tz, 'MMM d');
      } catch (e) {
        expStr = String(owlNotes[oni].expires);
      }
    }
    sheet.getRange(noteRow, 4).setValue(expStr);
  }

  // Task counts (row 50)
  var tasks = supabaseRequest('tasks?status=eq.open&select=*', 'GET') || [];
  var genCount = 0, rodCount = 0, unassignedCount = 0;
  for (var tci = 0; tci < tasks.length; tci++) {
    var assignee = (tasks[tci].assignee || '').toLowerCase();
    if (assignee === 'gen') genCount++;
    else if (assignee === 'rod') rodCount++;
    else unassignedCount++;
  }
  sheet.getRange(50, 1).setValue(genCount + ' tasks');
  sheet.getRange(50, 2).setValue(rodCount + ' tasks');
  sheet.getRange(50, 3).setValue(unassignedCount + ' tasks');

  // Capacity per day (rows 53-54, up to 5 days but we have 2 rows — use one row per 2-3 days)
  var capRow = 53;
  for (var ci = 0; ci < 5 && capRow <= 54; ci++) {
    // Write all 5 days across 2 rows: 3 on row 53, 2 on row 54
    if (ci < 3) {
      // We'll use a compact format for all 5 days across one status cell
    }
  }
  // Compact capacity display across one row
  var capParts = [];
  for (var cdi = 0; cdi < 5; cdi++) {
    var cDayName = dayNames[cdi];
    var pCount = capacityByDay[cDayName] ? capacityByDay[cDayName].Plateau : 0;
    var lCount = capacityByDay[cDayName] ? capacityByDay[cDayName].Laurier : 0;
    var status = '';
    var maxC = Math.max(pCount, lCount);
    if (maxC >= CONFIG.capacity.critical) status = '🔴';
    else if (maxC >= CONFIG.capacity.warning) status = '🟡';
    else status = '✅';

    var dayShort = shortDayHeader_(weekDates[cdi]).split(' ')[0];
    sheet.getRange(53, cdi + 1).setValue(dayShort + ': P' + pCount + '/L' + lCount + ' ' + status)
      .setFontSize(8);
  }

  Logger.log('refreshWeeklyBoard: Completed for week of ' + Utilities.formatDate(monday, tz, 'yyyy-MM-dd'));
}


/**
 * Helper: formats a dog entry line with prefixes for the weekly board cell.
 * @param {Object} dog - { dogName, matched, ... }
 * @param {Object} packageWarnings - map of dogName → remaining count
 * @param {Object} dogRoster - map of dogName → { sector, address }
 * @param {string} currentSector - 'Plateau' or 'Laurier'
 * @returns {string} Formatted dog name line
 */
function formatDogLine_(dog, packageWarnings, dogRoster, currentSector) {
  var name = dog.dogName || '';
  var prefix = '';

  // Unmatched dog
  if (!dog.matched) {
    prefix = '❓ ';
  }

  // Low package warning
  if (packageWarnings[name]) {
    prefix = '⚠️ ';
    name = name + ' (' + packageWarnings[name] + ')';
  }

  // Different address / different sector than expected
  var rosterInfo = dogRoster[dog.dogName];
  if (rosterInfo && rosterInfo.sector) {
    var expectedSector = rosterInfo.sector.charAt(0).toUpperCase() + rosterInfo.sector.slice(1).toLowerCase();
    if (expectedSector !== currentSector && expectedSector !== '' && expectedSector !== 'Unknown') {
      prefix = '📍 ';
      name = name + ' @ ' + rosterInfo.address;
    }
  }

  return prefix + name;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCHEDULE ECOSYSTEM — Creation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Creates and formats the "Schedule Ecosystem" tab.
 * Contains dog vacations, conflict rules, sector overrides, and owl notes.
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function createScheduleEcosystem(ss) {
  var sheet = ss.getSheetByName(TABS.SCHEDULE);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.SCHEDULE);
  }
  sheet.clear();

  // --- Column widths ---
  sheet.setColumnWidth(1, 140); // A
  sheet.setColumnWidth(2, 120); // B
  sheet.setColumnWidth(3, 110); // C
  sheet.setColumnWidth(4, 110); // D
  sheet.setColumnWidth(5, 200); // E
  sheet.setColumnWidth(6, 90);  // F

  var darkBg = '#4a4540';

  // ═══════════════════════════════════════════════════════════
  // ROW 1: Title bar
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A1:F1').merge()
    .setValue('\u{1F4CB} Schedule Ecosystem')
    .setBackground(darkBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);

  // ROW 2: Subtitle
  sheet.getRange('A2:F2').merge()
    .setValue('Rules, vacations, notes, overrides \u2014 the operational layer')
    .setFontColor('#888888')
    .setFontSize(10);

  // ROW 3: spacer
  sheet.setRowHeight(3, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION A — Dog Vacations & Schedule Changes (rows 4-26)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A4:F4').merge()
    .setValue('\u{1F3D6}\uFE0F DOG VACATIONS & SCHEDULE CHANGES')
    .setBackground(darkBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  // Column headers
  var vacHeaders = ['Dog Name', 'Type', 'Start Date', 'End Date', 'Reason', 'Status'];
  sheet.getRange('A5:F5').setValues([vacHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Data validation for Type (column B) — rows 6-25
  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['OFF', 'ADD'], true)
    .setAllowInvalid(false)
    .build();
  for (var vr = 6; vr <= 25; vr++) {
    sheet.getRange(vr, 2).setDataValidation(typeRule);
  }

  // Data validation for Status (column F) — rows 6-25
  var vacStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Active', 'Expired', 'Pending'], true)
    .setAllowInvalid(false)
    .build();
  for (var vs = 6; vs <= 25; vs++) {
    sheet.getRange(vs, 6).setDataValidation(vacStatusRule);
  }

  // ROW 26: Hint text
  sheet.getRange('A26:F26').merge()
    .setValue('\u270F\uFE0F Add rows directly. Changes auto-show on Weekly Board.')
    .setFontColor(COLORS.GREEN)
    .setFontSize(9);

  // ROW 27: spacer
  sheet.setRowHeight(27, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION B — Conflict Rules (rows 28-36)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A28:F28').merge()
    .setValue('\u26A1 CONFLICT RULES')
    .setBackground(darkBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  var conflictHeaders = ['Dog 1', 'Dog 2', 'Rule', 'Notes', '', ''];
  sheet.getRange('A29:F29').setValues([conflictHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Data validation for Rule (column C) — rows 30-36
  var conflictRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Never same group', 'Separate preferred'], true)
    .setAllowInvalid(false)
    .build();
  for (var cr = 30; cr <= 36; cr++) {
    sheet.getRange(cr, 3).setDataValidation(conflictRule);
  }

  // Pre-fill row 30
  sheet.getRange('A30').setValue('Mochi');
  sheet.getRange('B30').setValue('Chaska');
  sheet.getRange('C30').setValue('Never same group');
  sheet.getRange('D30').setValue('Reactive together');

  // ROW 37: spacer
  sheet.setRowHeight(37, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION C — Sector Overrides (rows 38-44)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A38:F38').merge()
    .setValue('\u{1F4CD} SECTOR OVERRIDES')
    .setBackground(darkBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  var sectorHeaders = ['Dog', 'Override Sector', 'Reason', '', '', ''];
  sheet.getRange('A39:F39').setValues([sectorHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Data validation for Override Sector (column B) — rows 40-44
  var sectorRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Plateau', 'Laurier'], true)
    .setAllowInvalid(false)
    .build();
  for (var sr = 40; sr <= 44; sr++) {
    sheet.getRange(sr, 2).setDataValidation(sectorRule);
  }

  // Pre-fill row 40
  sheet.getRange('A40').setValue('Paloma');
  sheet.getRange('B40').setValue('Plateau');
  sheet.getRange('C40').setValue('Auto-corrected by system');

  // ROW 45: spacer
  sheet.setRowHeight(45, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION D — Owl Notes (rows 46-61)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A46:F46').merge()
    .setValue('\u{1F989} OWL NOTES')
    .setBackground(darkBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  var owlHeaders = ['Target', 'Message', 'Author', 'Created', 'Expires', 'Status'];
  sheet.getRange('A47:F47').setValues([owlHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Data validation for Status (column F) — rows 48-60
  var owlStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Active', 'Expired', 'Pushed'], true)
    .setAllowInvalid(false)
    .build();
  for (var or_ = 48; or_ <= 60; or_++) {
    sheet.getRange(or_, 6).setDataValidation(owlStatusRule);
  }

  // ROW 61: Hint text
  sheet.getRange('A61:F61').merge()
    .setValue('Expired notes auto-clean nightly. Push to app via Push Changes \u2192 App.')
    .setFontColor('#888888')
    .setFontSize(9)
    .setFontStyle('italic');

  // --- Tab color ---
  sheet.setTabColor('#999999');

  Logger.log('createScheduleEcosystem: Schedule Ecosystem tab created and formatted');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOGS TAB — Creation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Creates and formats the "Dogs" tab with New Dogs intake section
 * and Full Roster section populated by syncRosterFromSupabase().
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function createDogsTab(ss) {
  var sheet = ss.getSheetByName(TABS.DOGS);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.DOGS);
  }
  sheet.clear();

  var blueBg = '#2c5f8a';
  var rosterHeaders = [
    'Dog Name', 'Owner First', 'Owner Last', 'Sector', 'Address',
    'Door Code', 'Phone', 'Email', 'Breed', 'Notes', 'Source', 'Added?'
  ];

  // --- Column widths ---
  var colWidths = [120, 100, 100, 80, 200, 80, 110, 180, 100, 200, 70, 60];
  for (var cw = 0; cw < colWidths.length; cw++) {
    sheet.setColumnWidth(cw + 1, colWidths[cw]);
  }

  // ═══════════════════════════════════════════════════════════
  // ROW 1: Title bar
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A1:L1').merge()
    .setValue('\u{1F415} Dogs \u2014 Master Roster')
    .setBackground(blueBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);

  // ROW 2: spacer
  sheet.setRowHeight(2, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION: NEW DOGS (rows 3-8)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A3:L3').merge()
    .setValue('\u{1F4E5} NEW DOGS \u2014 incoming from Acuity or App')
    .setBackground(COLORS.YELLOW_BG)
    .setFontWeight('bold')
    .setFontSize(11);

  // Column headers (row 4)
  sheet.getRange('A4:L4').setValues([rosterHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Checkboxes for Added? (column L) — rows 5-8
  sheet.getRange('L5:L8').insertCheckboxes();

  // ROW 9: spacer
  sheet.setRowHeight(9, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION: FULL ROSTER (rows 10+)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A10:L10').merge()
    .setValue('\u{1F415} FULL ROSTER')
    .setBackground(blueBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  // Roster column headers (row 11) — same as row 4 but column L = "Modified"
  var fullHeaders = rosterHeaders.slice();
  fullHeaders[11] = 'Modified';
  sheet.getRange('A11:L11').setValues([fullHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // --- Freeze rows 1 and 11 (freeze up to row 11 so both headers stay visible) ---
  // We freeze row 1 as the main header. Since row 11 can't be independently frozen,
  // we freeze just row 1 for the title bar.
  sheet.setFrozenRows(1);

  // --- Tab color ---
  sheet.setTabColor('#4a90d9');

  Logger.log('createDogsTab: Dogs tab created and formatted');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAFF TAB — Creation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Creates and formats the "Staff" tab with walker schedules
 * and vacation/substitution tracking.
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function createStaffTab(ss) {
  var sheet = ss.getSheetByName(TABS.STAFF);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.STAFF);
  }
  sheet.clear();

  var purpleBg = '#7c5cbf';
  var darkBg = '#4a4540';

  // ═══════════════════════════════════════════════════════════
  // ROW 1: Title bar
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A1:I1').merge()
    .setValue('\u{1F465} Staff')
    .setBackground(purpleBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);

  // ROW 2: spacer
  sheet.setRowHeight(2, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION: WALKER SCHEDULE (rows 3-14)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A3:I3').merge()
    .setValue('\u{1F4C5} WALKER SCHEDULE')
    .setBackground(darkBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  // Column headers (row 4)
  var schedHeaders = ['Name', 'Role', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Email', 'Phone'];
  sheet.getRange('A4:I4').setValues([schedHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Data validation for day columns (C-G) — rows 5-14
  var dayRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Plateau', 'Laurier', 'Off', 'Updates', '\u2014'], true)
    .setAllowInvalid(false)
    .build();

  // Data validation for Role (column B) — rows 5-14
  var roleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Chief Pup', 'Wiggle Pro', 'Pup Walker'], true)
    .setAllowInvalid(false)
    .build();

  for (var dr = 5; dr <= 14; dr++) {
    sheet.getRange(dr, 2).setDataValidation(roleRule);
    for (var dc = 3; dc <= 7; dc++) {
      sheet.getRange(dr, dc).setDataValidation(dayRule);
    }
  }

  // Pre-fill staff data (rows 5-13)
  var staffData = [
    ['Megan',   'Wiggle Pro', 'Plateau', '\u2014',    '\u2014',    'Plateau', '\u2014',    'megan@wiggledogwalks.com',   ''],
    ['Solene',  'Wiggle Pro', '\u2014',    'Plateau', 'Plateau', 'Plateau', '\u2014',    'solene@wiggledogwalks.com',  ''],
    ['Chloe',   'Wiggle Pro', 'Plateau', 'Plateau', '\u2014',    '\u2014',    'Plateau', 'chloe@wiggledogwalks.com',   ''],
    ['Amanda',  'Wiggle Pro', 'Laurier', 'Laurier', 'Laurier', 'Laurier', '\u2014',    'amanda@wiggledogwalks.com',  ''],
    ['Belen',   'Wiggle Pro', 'Laurier', '\u2014',    '\u2014',    'Laurier', 'Laurier', 'belen@wiggledogwalks.com',   ''],
    ['Amelie',  'Wiggle Pro', '\u2014',    'Laurier', 'Laurier', '\u2014',    '\u2014',    'amelie@wiggledogwalks.com',  ''],
    ['Maeva',   'Wiggle Pro', '\u2014',    '\u2014',    '\u2014',    '\u2014',    'Laurier', 'maeva@wiggledogwalks.com',   ''],
    ['Rodrigo', 'Chief Pup',  '\u2014',    '\u2014',    'Plateau', '\u2014',    'Plateau', 'rod_galvan@hotmail.com',     ''],
    ['Gen',     'Chief Pup',  'Updates', 'Updates', 'Updates', 'Updates', 'Updates', 'gen-vg@outlook.com',         ''],
  ];

  sheet.getRange(5, 1, staffData.length, 9).setValues(staffData);

  // Color-code day cells based on sector assignment
  for (var sr = 0; sr < staffData.length; sr++) {
    for (var sc = 2; sc <= 6; sc++) { // Columns C-G (index 2-6 in staffData)
      var cellVal = staffData[sr][sc];
      var cellRange = sheet.getRange(sr + 5, sc + 1); // +5 for row offset, +1 for column offset
      if (cellVal === 'Plateau') {
        cellRange.setBackground(COLORS.PLATEAU_BG);
      } else if (cellVal === 'Laurier') {
        cellRange.setBackground(COLORS.LAURIER_BG);
      }
      // Off/— cells stay white (default)
    }
  }

  // ROW 15: spacer
  sheet.setRowHeight(15, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION: WALKER VACATIONS & SUBSTITUTIONS (rows 16-31)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A16:I16').merge()
    .setValue('\u{1F3D6}\uFE0F WALKER VACATIONS & SUBSTITUTIONS')
    .setBackground(darkBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  // Column headers (row 17)
  var vacHeaders = ['Walker', 'Start Date', 'End Date', 'Mon Cover', 'Tue Cover', 'Wed Cover', 'Thu Cover', 'Fri Cover', 'Notes'];
  sheet.getRange('A17:I17').setValues([vacHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Pre-fill row 18
  sheet.getRange('A18').setValue('Amanda');
  sheet.getRange('B18').setValue('2026-04-03');
  sheet.getRange('C18').setValue('2026-04-27');
  sheet.getRange('D18').setValue('Maeva');
  sheet.getRange('E18').setValue('Rodrigo');
  sheet.getRange('F18').setValue('Rodrigo');
  sheet.getRange('G18').setValue('Rodrigo');
  sheet.getRange('H18').setValue('\u2014');
  sheet.getRange('I18').setValue('Megan covers Rod on Wed at Plateau');

  // ROW 31: Hint text
  sheet.getRange('A31:I31').merge()
    .setValue('Edit substitutions here. Weekly Board reads this automatically.')
    .setFontColor('#888888')
    .setFontSize(9);

  // --- Freeze row 1 ---
  sheet.setFrozenRows(1);

  // --- Tab color ---
  sheet.setTabColor(purpleBg);

  Logger.log('createStaffTab: Staff tab created and formatted');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BILLING TAB — Creation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Creates and formats the "Billing" tab with package balances,
 * renewals, and predictions — separated by sector.
 * @param {Spreadsheet} ss - The active spreadsheet
 */
function createBillingTab(ss) {
  var sheet = ss.getSheetByName(TABS.BILLING);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.BILLING);
  }
  sheet.clear();

  var greenBg = '#3d9970';
  var billingHeaders = ['Dog', 'Owner', 'Email', 'Walks Left', 'Days/Week', 'Runs Out By', 'Usual Package', 'Status', 'Last Renewed'];

  // --- Column widths ---
  var colWidths = [120, 100, 180, 80, 70, 100, 150, 70, 100];
  for (var cw = 0; cw < colWidths.length; cw++) {
    sheet.setColumnWidth(cw + 1, colWidths[cw]);
  }

  // ═══════════════════════════════════════════════════════════
  // ROW 1: Title bar
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A1:I1').merge()
    .setValue('\uD83D\uDCB0 Billing')
    .setBackground(greenBg)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);

  // ROW 2: subtitle
  sheet.getRange('A2').setValue('Package balances, renewals, predictions')
    .setFontColor('#888888')
    .setFontSize(10);

  // ROW 3: spacer
  sheet.setRowHeight(3, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION: PLATEAU (rows 4-30)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A4:I4').merge()
    .setValue('\u{26F0}\uFE0F PLATEAU')
    .setBackground(COLORS.PLATEAU)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  // Column headers (row 5)
  sheet.getRange('A5:I5').setValues([billingHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Data validation for Usual Package (column G) — rows 6-30
  var packageRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['5 walks - $150', '10 walks - $280', '20 walks - $520', 'Private - $45/walk'], true)
    .setAllowInvalid(false)
    .build();
  for (var pr = 6; pr <= 30; pr++) {
    sheet.getRange(pr, 7).setDataValidation(packageRule);
  }

  // Data validation for Status (column H) — rows 6-30
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Empty', 'Low', 'OK', 'Vacation'], true)
    .setAllowInvalid(true)
    .build();
  for (var sr = 6; sr <= 30; sr++) {
    sheet.getRange(sr, 8).setDataValidation(statusRule);
  }

  // ROW 31: spacer
  sheet.setRowHeight(31, 8);

  // ═══════════════════════════════════════════════════════════
  // SECTION: LAURIER (rows 32-58)
  // ═══════════════════════════════════════════════════════════
  sheet.getRange('A32:I32').merge()
    .setValue('\u{1F333} LAURIER')
    .setBackground(COLORS.LAURIER)
    .setFontColor(COLORS.HEADER_TEXT)
    .setFontWeight('bold')
    .setFontSize(11);

  // Column headers (row 33)
  sheet.getRange('A33:I33').setValues([billingHeaders])
    .setBackground('#e8e6e3')
    .setFontWeight('bold')
    .setFontSize(10);

  // Data validation for Usual Package (column G) — rows 34-58
  for (var pr2 = 34; pr2 <= 58; pr2++) {
    sheet.getRange(pr2, 7).setDataValidation(packageRule);
  }

  // Data validation for Status (column H) — rows 34-58
  for (var sr2 = 34; sr2 <= 58; sr2++) {
    sheet.getRange(sr2, 8).setDataValidation(statusRule);
  }

  // ═══════════════════════════════════════════════════════════
  // CONDITIONAL FORMATTING
  // ═══════════════════════════════════════════════════════════

  // Column D (Walks Left) — Plateau rows 6-30 and Laurier rows 34-58
  var walksRanges = [sheet.getRange('D6:D30'), sheet.getRange('D34:D58')];
  for (var wr = 0; wr < walksRanges.length; wr++) {
    var range = walksRanges[wr];
    // Red: 0 walks
    var redRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberEqualTo(0)
      .setBackground('#fef2f0')
      .setFontColor(COLORS.RED)
      .setBold(true)
      .setRanges([range])
      .build();
    // Yellow: 1-3 walks
    var yellowRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberBetween(1, 3)
      .setBackground('#fef9ed')
      .setFontColor(COLORS.YELLOW)
      .setBold(true)
      .setRanges([range])
      .build();
    // Green: 4+
    var greenRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(4)
      .setBackground('#f0faf5')
      .setFontColor(COLORS.GREEN)
      .setRanges([range])
      .build();
    var rules = sheet.getConditionalFormatRules();
    rules.push(redRule, yellowRule, greenRule);
    sheet.setConditionalFormatRules(rules);
  }

  // Column H (Status) — Plateau rows 6-30 and Laurier rows 34-58
  var statusRanges = [sheet.getRange('H6:H30'), sheet.getRange('H34:H58')];
  for (var st = 0; st < statusRanges.length; st++) {
    var sRange = statusRanges[st];
    var emptyRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Empty')
      .setBackground('#fef2f0')
      .setFontColor(COLORS.RED)
      .setBold(true)
      .setRanges([sRange])
      .build();
    var lowRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Low')
      .setBackground('#fef9ed')
      .setFontColor(COLORS.YELLOW)
      .setBold(true)
      .setRanges([sRange])
      .build();
    var okRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('OK')
      .setBackground('#f0faf5')
      .setFontColor(COLORS.GREEN)
      .setRanges([sRange])
      .build();
    var vacRule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Vacation')
      .setBackground('#eeeeee')
      .setFontColor('#888888')
      .setRanges([sRange])
      .build();
    var sRules = sheet.getConditionalFormatRules();
    sRules.push(emptyRule, lowRule, okRule, vacRule);
    sheet.setConditionalFormatRules(sRules);
  }

  // --- Freeze rows 1 and 5 ---
  sheet.setFrozenRows(5);

  // --- Tab color ---
  sheet.setTabColor(greenBg);

  Logger.log('createBillingTab: Billing tab created and formatted');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BILLING — Refresh from Acuity Certificates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Refreshes the Billing tab with current package data from Acuity certificates.
 * Resolves client names to dog names, calculates run-out dates,
 * determines status, and writes to the correct sector section.
 */
function refreshBilling() {
  try {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.BILLING);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Billing tab not found. Run Setup Tower first.');
    return;
  }

  var certs = fetchAcuityCertificates();
  if (!certs || certs.length === 0) {
    SpreadsheetApp.getUi().alert('No certificates found from Acuity.');
    return;
  }

  Logger.log('refreshBilling: ' + certs.length + ' raw certificates from Acuity');

  // Filter to active certs: remaining > 0
  certs = certs.filter(function(cert) {
    return cert.remaining > 0;
  });

  Logger.log('refreshBilling: ' + certs.length + ' certs after filtering (remaining>0)');

  if (certs.length === 0) {
    SpreadsheetApp.getUi().alert('No active certificates found from Acuity after filtering.');
    return;
  }

  var today = new Date();
  var ownerMap = getOwnerToDogMap();
  var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Fetch today's appointments to determine sector and days/week
  var appointments = fetchAcuityAppointments(todayStr);

  // Build a map of dog name → sector from Acuity appointments (best effort)
  var dogSectorMap = {};
  var dogDaysMap = {};
  for (var a = 0; a < appointments.length; a++) {
    var appt = appointments[a];
    var resolved = resolveAcuityName(appt.firstName, appt.lastName);
    var sector = getAppointmentTypeLabel(appt.appointmentTypeID);
    if (resolved.matched && sector !== 'Unknown') {
      dogSectorMap[resolved.dogName.toLowerCase()] = sector;
    }
  }

  // Also fetch this week to get days/week counts (on weekends, use next Monday)
  var dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  var mondayOffset;
  if (dayOfWeek === 0) {
    mondayOffset = 1;
  } else if (dayOfWeek === 6) {
    mondayOffset = 2;
  } else {
    mondayOffset = 1 - dayOfWeek;
  }
  var monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  var weekData = fetchAcuityWeek(monday);
  var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  // Count days/week for each dog
  for (var d = 0; d < dayNames.length; d++) {
    var dayAppts = weekData[dayNames[d]] || [];
    for (var da = 0; da < dayAppts.length; da++) {
      var dayResolved = resolveAcuityName(dayAppts[da].firstName, dayAppts[da].lastName);
      if (dayResolved.matched) {
        var dKey = dayResolved.dogName.toLowerCase();
        dogDaysMap[dKey] = (dogDaysMap[dKey] || 0) + 1;
        // Also grab sector from weekly data
        if (!dogSectorMap[dKey]) {
          var daySector = getAppointmentTypeLabel(dayAppts[da].appointmentTypeID);
          if (daySector !== 'Unknown') {
            dogSectorMap[dKey] = daySector;
          }
        }
      }
    }
  }

  // Match package name to dropdown option
  function matchPackage(pkgName) {
    var name = (pkgName || '').toLowerCase();
    if (name.indexOf('20') !== -1) return '20 walks - $520';
    if (name.indexOf('10') !== -1) return '10 walks - $280';
    if (name.indexOf('5') !== -1 || name.indexOf('five') !== -1) return '5 walks - $150';
    if (name.indexOf('private') !== -1 || name.indexOf('priv') !== -1) return 'Private - $45/walk';
    return '10 walks - $280'; // default
  }

  // Group certificates by dog name — keep latest cert per dog, sum remaining walks
  var dogCertMap = {}; // key: dogName lowercase → { dogName, owner, totalWalks, latestPackage, certs[] }

  for (var c = 0; c < certs.length; c++) {
    var cert = certs[c];
    // Resolve client name to dog name
    var clientFirst = (cert.clientName || '').split(' ')[0].toLowerCase().trim();
    var clientLast = (cert.clientName || '').split(' ').slice(1).join(' ');
    var resolved = resolveAcuityName(clientFirst, clientLast);
    var dogName = resolved.matched ? resolved.dogName : (ownerMap[clientFirst] || cert.clientName);
    // Normalize: trim whitespace, consistent casing for grouping key
    dogName = String(dogName).trim();
    var dKey = dogName.toLowerCase();

    if (!dogCertMap[dKey]) {
      dogCertMap[dKey] = {
        dogName: dogName,
        owner: cert.clientName || '',
        totalWalks: 0,
        latestPackage: cert.packageName || '',
        latestId: cert.id || 0,
      };
    }
    dogCertMap[dKey].totalWalks += (cert.remaining || 0);
    // Keep the package name from the cert with highest ID (most recent)
    if ((cert.id || 0) >= dogCertMap[dKey].latestId) {
      dogCertMap[dKey].latestId = cert.id || 0;
      dogCertMap[dKey].latestPackage = cert.packageName || '';
      dogCertMap[dKey].owner = cert.clientName || '';
    }
  }

  Logger.log('refreshBilling: ' + Object.keys(dogCertMap).length + ' unique dogs after grouping');

  // Build billing entries from grouped data
  var plateauDogs = [];
  var laurierDogs = [];

  var dogKeys = Object.keys(dogCertMap);
  for (var dk = 0; dk < dogKeys.length; dk++) {
    var grouped = dogCertMap[dogKeys[dk]];
    var walksLeft = grouped.totalWalks;
    var daysPerWeek = dogDaysMap[grouped.dogName.toLowerCase()] || 3; // default 3
    var runsOutDays = daysPerWeek > 0 ? Math.ceil((walksLeft / daysPerWeek) * 7) : 999;
    var runsOutDate = new Date(today);
    runsOutDate.setDate(today.getDate() + runsOutDays);
    var runsOutStr = Utilities.formatDate(runsOutDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // Determine status
    var status = 'OK';
    if (walksLeft === 0) status = 'Empty';
    else if (walksLeft <= 3) status = 'Low';

    var entry = {
      dog: grouped.dogName,
      owner: grouped.owner,
      email: '', // Acuity certs don't always have email, will be filled from sheet
      walksLeft: walksLeft,
      daysPerWeek: daysPerWeek,
      runsOutBy: runsOutStr,
      usualPackage: matchPackage(grouped.latestPackage),
      status: status,
      lastRenewed: '',
    };

    var sector = dogSectorMap[grouped.dogName.toLowerCase()] || 'Plateau'; // default Plateau
    if (sector === 'Laurier') {
      laurierDogs.push(entry);
    } else {
      plateauDogs.push(entry);
    }
  }

  // Sort: Empty first, then Low, then OK
  var statusOrder = { 'Empty': 0, 'Low': 1, 'OK': 2, 'Vacation': 3 };
  function sortByStatus(a, b) {
    return (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
  }
  plateauDogs.sort(sortByStatus);
  laurierDogs.sort(sortByStatus);

  // Preserve existing email and lastRenewed values from the sheet
  function readExisting(startRow, endRow) {
    var existing = {};
    for (var r = startRow; r <= endRow; r++) {
      var name = sheet.getRange(r, 1).getValue();
      if (name) {
        existing[String(name).toLowerCase()] = {
          email: sheet.getRange(r, 3).getValue() || '',
          lastRenewed: sheet.getRange(r, 9).getValue() || '',
        };
      }
    }
    return existing;
  }

  var existingPlateau = readExisting(6, 30);
  var existingLaurier = readExisting(34, 58);

  // Write to Plateau section (rows 6-30)
  function writeSection(dogs, startRow, endRow, existingData) {
    // Clear data area
    for (var cr = startRow; cr <= endRow; cr++) {
      sheet.getRange(cr, 1, 1, 9).clearContent();
    }

    for (var i = 0; i < Math.min(dogs.length, endRow - startRow + 1); i++) {
      var row = startRow + i;
      var dog = dogs[i];
      var prev = existingData[dog.dog.toLowerCase()] || {};

      sheet.getRange(row, 1).setValue(dog.dog);
      sheet.getRange(row, 2).setValue(dog.owner);
      sheet.getRange(row, 3).setValue(prev.email || dog.email);
      sheet.getRange(row, 4).setValue(dog.walksLeft);
      sheet.getRange(row, 5).setValue(dog.daysPerWeek);
      sheet.getRange(row, 6).setValue(dog.runsOutBy);
      sheet.getRange(row, 7).setValue(dog.usualPackage);
      sheet.getRange(row, 8).setValue(dog.status);
      sheet.getRange(row, 9).setValue(prev.lastRenewed || dog.lastRenewed);
    }
  }

  writeSection(plateauDogs, 6, 30, existingPlateau);
  writeSection(laurierDogs, 34, 58, existingLaurier);

  Logger.log('refreshBilling: Plateau dogs: ' + plateauDogs.length + ', Laurier dogs: ' + laurierDogs.length);
  Logger.log('refreshBilling: Total unique dogs written: ' + (plateauDogs.length + laurierDogs.length));
  SpreadsheetApp.getUi().alert('Billing refreshed: ' + plateauDogs.length + ' Plateau, ' + laurierDogs.length + ' Laurier (' + (plateauDogs.length + laurierDogs.length) + ' unique dogs total).');
  } catch(e) {
    Logger.log('refreshBilling error: ' + e.message);
    try { SpreadsheetApp.getUi().alert('Error: ' + e.message); } catch(u) {}
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BILLING — Send Package Nudge
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Sends a friendly package nudge email to clients whose dogs
 * walked today and have 3 or fewer walks remaining.
 * Menu action: "Send Package Nudge"
 */
function sendPackageNudge() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var billingSheet = ss.getSheetByName(TABS.BILLING);

  if (!billingSheet) {
    ui.alert('Billing tab not found. Run Setup Tower first.');
    return;
  }

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var appointments = fetchAcuityAppointments(today);

  if (!appointments || appointments.length === 0) {
    ui.alert('No appointments found for today.');
    return;
  }

  // Resolve today's dogs
  var todaysDogs = {};
  for (var i = 0; i < appointments.length; i++) {
    var resolved = resolveAcuityName(appointments[i].firstName, appointments[i].lastName);
    if (resolved.matched) {
      todaysDogs[resolved.dogName.toLowerCase()] = true;
    }
  }

  // Read billing data from both sectors
  function readBillingSection(startRow, endRow) {
    var entries = [];
    for (var r = startRow; r <= endRow; r++) {
      var dog = billingSheet.getRange(r, 1).getValue();
      if (!dog) continue;
      var walksLeft = Number(billingSheet.getRange(r, 4).getValue()) || 0;
      var owner = billingSheet.getRange(r, 2).getValue() || '';
      var email = billingSheet.getRange(r, 3).getValue() || '';
      entries.push({ dog: dog, owner: owner, email: email, walksLeft: walksLeft });
    }
    return entries;
  }

  var allBilling = readBillingSection(6, 30).concat(readBillingSection(34, 58));

  // Find dogs that walked today AND have <= 3 walks
  var nudgeList = [];
  for (var b = 0; b < allBilling.length; b++) {
    var entry = allBilling[b];
    if (todaysDogs[entry.dog.toLowerCase()] && entry.walksLeft <= 3 && entry.email) {
      nudgeList.push(entry);
    }
  }

  if (nudgeList.length === 0) {
    ui.alert('No low-package dogs walked today \u2014 no nudges to send.');
    return;
  }

  // Build confirmation message
  var confirmMsg = 'Send package nudge to:\n';
  for (var n = 0; n < nudgeList.length; n++) {
    var item = nudgeList[n];
    confirmMsg += '\u2022 ' + item.dog + ' (' + item.owner + ') \u2014 ' + item.walksLeft + ' walk' + (item.walksLeft !== 1 ? 's' : '') + ' left\n';
  }
  confirmMsg += '\nSend?';

  var response = ui.alert('Package Nudge', confirmMsg, ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  // Send emails
  var sentCount = 0;
  for (var s = 0; s < nudgeList.length; s++) {
    var nudge = nudgeList[s];
    try {
      var subject = '\uD83D\uDC15 ' + nudge.dog + "'s Walk Update + Package Reminder";
      var body = 'Hi ' + nudge.owner.split(' ')[0] + ',\n\n'
        + 'Just wanted to let you know that ' + nudge.dog + ' had a great walk today! \uD83D\uDC3E\n\n'
        + 'Quick heads up \u2014 ' + nudge.dog + ' has ' + nudge.walksLeft + ' walk' + (nudge.walksLeft !== 1 ? 's' : '') + ' remaining in their current package. '
        + 'Whenever you\u2019re ready to renew, just reply to this email or let us know!\n\n'
        + 'Thanks for trusting us with ' + nudge.dog + '!\n\n'
        + 'Warm regards,\n'
        + 'Gen & the Wiggle team \uD83D\uDC15\u200D\uD83E\uDDBA';

      GmailApp.sendEmail(nudge.email, subject, body, {
        from: CONFIG.email.wiggle,
        name: 'Wiggle Dog Walks',
      });
      sentCount++;
    } catch (e) {
      Logger.log('sendPackageNudge email error for ' + nudge.dog + ': ' + e.message);
    }
  }

  // Log to audit
  var dashSheet = ss.getSheetByName(TABS.DASHBOARD);
  if (dashSheet) {
    var existingLogs = [];
    for (var lr = 29; lr <= 38; lr++) {
      var who = dashSheet.getRange(lr, 2).getValue();
      var what = dashSheet.getRange(lr, 3).getValue();
      var time = dashSheet.getRange(lr, 7).getValue();
      if (who || what) existingLogs.push({ who: who, what: what, time: time, color: 'system' });
    }
    existingLogs.unshift({
      who: 'Gen',
      what: 'Sent ' + sentCount + ' package nudge email' + (sentCount !== 1 ? 's' : ''),
      time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'),
      color: 'gen',
    });
    writeAuditLog_(dashSheet, existingLogs);
  }

  ui.alert('Sent ' + sentCount + ' nudge email' + (sentCount !== 1 ? 's' : '') + '.');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BILLING — Send All Bills (Friday action)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Sends renewal bills to all clients with 3 or fewer walks remaining.
 * Uses the "Usual Package" column to determine the package/price.
 * Menu action: "Send All Bills"
 */
function sendAllBills() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.BILLING);

  if (!sheet) {
    ui.alert('Billing tab not found. Run Setup Tower first.');
    return;
  }

  var packagePrices = {
    '5 walks - $150': 150,
    '10 walks - $280': 280,
    '20 walks - $520': 520,
    'Private - $45/walk': 45,
  };

  function readLowWalks(startRow, endRow) {
    var results = [];
    for (var r = startRow; r <= endRow; r++) {
      var dog = sheet.getRange(r, 1).getValue();
      if (!dog) continue;
      var walksLeft = Number(sheet.getRange(r, 4).getValue()) || 0;
      if (walksLeft > 3) continue;
      var owner = sheet.getRange(r, 2).getValue() || '';
      var email = sheet.getRange(r, 3).getValue() || '';
      var pkg = sheet.getRange(r, 7).getValue() || '10 walks - $280';
      results.push({ dog: dog, owner: owner, email: email, package: pkg, price: packagePrices[pkg] || 0 });
    }
    return results;
  }

  var plateauBills = readLowWalks(6, 30);
  var laurierBills = readLowWalks(34, 58);
  var allBills = plateauBills.concat(laurierBills);

  if (allBills.length === 0) {
    ui.alert('No dogs with 3 or fewer walks remaining. No bills to send.');
    return;
  }

  // Build confirmation
  var totalValue = 0;
  var confirmMsg = 'Send renewal bills:\n\n';

  if (plateauBills.length > 0) {
    confirmMsg += '\u{26F0}\uFE0F PLATEAU:\n';
    for (var p = 0; p < plateauBills.length; p++) {
      confirmMsg += '\u2022 ' + plateauBills[p].dog + ' (' + plateauBills[p].owner + ') \u2014 ' + plateauBills[p].package + '\n';
      totalValue += plateauBills[p].price;
    }
    confirmMsg += '\n';
  }

  if (laurierBills.length > 0) {
    confirmMsg += '\u{1F333} LAURIER:\n';
    for (var l = 0; l < laurierBills.length; l++) {
      confirmMsg += '\u2022 ' + laurierBills[l].dog + ' (' + laurierBills[l].owner + ') \u2014 ' + laurierBills[l].package + '\n';
      totalValue += laurierBills[l].price;
    }
    confirmMsg += '\n';
  }

  confirmMsg += 'Total: $' + totalValue + '\n\nSend all?';

  var response = ui.alert('Send Bills', confirmMsg, ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  // Send emails
  var sentCount = 0;
  for (var s = 0; s < allBills.length; s++) {
    var bill = allBills[s];
    if (!bill.email) {
      Logger.log('sendAllBills: skipping ' + bill.dog + ' — no email');
      continue;
    }
    try {
      var subject = '\uD83D\uDC15 Wiggle Dog Walks \u2014 Package Renewal for ' + bill.dog;
      var body = 'Hi ' + bill.owner.split(' ')[0] + ',\n\n'
        + 'Hope you and ' + bill.dog + ' are doing great! \uD83D\uDC3E\n\n'
        + 'This is a friendly reminder that ' + bill.dog + '\u2019s walk package is running low. '
        + 'We\u2019d love to keep the walks going!\n\n'
        + 'Package: ' + bill.package + '\n\n'
        + 'To renew, just reply to this email or pay via your usual method (e-transfer to info@wiggledogwalks.com).\n\n'
        + 'Thanks for being part of the Wiggle family!\n\n'
        + 'Warm regards,\n'
        + 'Gen & the Wiggle team \uD83D\uDC15\u200D\uD83E\uDDBA';

      GmailApp.sendEmail(bill.email, subject, body, {
        from: CONFIG.email.wiggle,
        name: 'Wiggle Dog Walks',
      });
      sentCount++;
    } catch (e) {
      Logger.log('sendAllBills email error for ' + bill.dog + ': ' + e.message);
    }
  }

  // Log to audit
  var dashSheet = ss.getSheetByName(TABS.DASHBOARD);
  if (dashSheet) {
    var existingLogs = [];
    for (var lr = 29; lr <= 38; lr++) {
      var who = dashSheet.getRange(lr, 2).getValue();
      var what = dashSheet.getRange(lr, 3).getValue();
      var time = dashSheet.getRange(lr, 7).getValue();
      if (who || what) existingLogs.push({ who: who, what: what, time: time, color: 'system' });
    }
    existingLogs.unshift({
      who: 'Gen',
      what: 'Sent ' + sentCount + ' renewal bill' + (sentCount !== 1 ? 's' : '') + ' \u2014 $' + totalValue,
      time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'),
      color: 'gen',
    });
    writeAuditLog_(dashSheet, existingLogs);
  }

  ui.alert('Sent ' + sentCount + ' renewal bill' + (sentCount !== 1 ? 's' : '') + ' \u2014 total value $' + totalValue + '.');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL — Monday Prep (Sunday 8 PM trigger)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generates and sends a Monday morning briefing email to Gen.
 * Triggered Sunday at 8 PM. Includes schedule, coverage,
 * low packages, open tasks, and owl notes.
 */
function sendMondayPrepEmail() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = new Date();

  // Monday is tomorrow (triggered Sunday)
  var monday = new Date(today);
  monday.setDate(today.getDate() + 1);
  var mondayStr = Utilities.formatDate(monday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var mondayDisplay = Utilities.formatDate(monday, Session.getScriptTimeZone(), 'EEEE, MMMM d');

  // Fetch Monday appointments
  var mondayAppts = fetchAcuityAppointments(mondayStr);
  var plateauCount = 0;
  var laurierCount = 0;
  for (var i = 0; i < mondayAppts.length; i++) {
    var sector = getAppointmentTypeLabel(mondayAppts[i].appointmentTypeID);
    if (sector === 'Plateau') plateauCount++;
    else if (sector === 'Laurier') laurierCount++;
  }

  // Read schedule ecosystem for changes this week
  var scheduleSheet = ss.getSheetByName(TABS.SCHEDULE);
  var scheduleChanges = [];
  if (scheduleSheet) {
    // Scan dog vacation section (rows 6-15) and extras section for relevant entries
    for (var r = 6; r <= 15; r++) {
      var dog = scheduleSheet.getRange(r, 1).getValue();
      var startDate = scheduleSheet.getRange(r, 2).getValue();
      var endDate = scheduleSheet.getRange(r, 3).getValue();
      if (dog && startDate) {
        scheduleChanges.push('\u2022 ' + dog + ': ' + startDate + ' \u2013 ' + (endDate || 'TBD'));
      }
    }
  }

  // Read staff tab for Monday coverage
  var staffSheet = ss.getSheetByName(TABS.STAFF);
  var walkerCoverage = [];
  if (staffSheet) {
    // Walker schedule is in rows 5-14 (Staff tab)
    for (var w = 5; w <= 14; w++) {
      var walker = staffSheet.getRange(w, 1).getValue();
      var monStatus = staffSheet.getRange(w, 2).getValue();
      if (walker && monStatus) {
        walkerCoverage.push('\u2022 ' + walker + ': ' + monStatus);
      }
    }
    // Check vacations (rows 18+)
    for (var v = 18; v <= 25; v++) {
      var vacWalker = staffSheet.getRange(v, 1).getValue();
      var vacStart = staffSheet.getRange(v, 2).getValue();
      var vacEnd = staffSheet.getRange(v, 3).getValue();
      var monCover = staffSheet.getRange(v, 4).getValue();
      if (vacWalker && vacStart) {
        walkerCoverage.push('\u2022 ' + vacWalker + ' on vacation (' + vacStart + ' \u2013 ' + vacEnd + '), Mon cover: ' + (monCover || 'TBD'));
      }
    }
  }

  // Low/empty packages (top 5)
  var billingSheet = ss.getSheetByName(TABS.BILLING);
  var lowPackages = [];
  if (billingSheet) {
    function readLowFromSection(startRow, endRow) {
      for (var r = startRow; r <= endRow; r++) {
        var dog = billingSheet.getRange(r, 1).getValue();
        if (!dog) continue;
        var walksLeft = Number(billingSheet.getRange(r, 4).getValue()) || 0;
        var status = billingSheet.getRange(r, 8).getValue() || '';
        if (status === 'Empty' || status === 'Low') {
          lowPackages.push({ dog: dog, walksLeft: walksLeft, status: status });
        }
      }
    }
    readLowFromSection(6, 30);
    readLowFromSection(34, 58);
    lowPackages.sort(function(a, b) { return a.walksLeft - b.walksLeft; });
  }

  // Read dashboard for open tasks and owl notes
  var dashSheet = ss.getSheetByName(TABS.DASHBOARD);
  var openTasks = [];
  var owlNotes = [];
  if (dashSheet) {
    // Tasks section (rows 12-19 typically)
    for (var t = 12; t <= 19; t++) {
      var task = dashSheet.getRange(t, 2).getValue();
      var assignee = dashSheet.getRange(t, 5).getValue();
      if (task && String(assignee).toLowerCase().indexOf('gen') !== -1) {
        openTasks.push('\u2022 ' + task);
      }
    }
    // Owl notes section (rows 22-27 typically)
    for (var o = 22; o <= 27; o++) {
      var owl = dashSheet.getRange(o, 2).getValue();
      if (owl) owlNotes.push('\u2022 ' + owl);
    }
  }

  // Compose email
  var body = 'Good morning Gen! \u2615 Here\u2019s your Monday prep:\n\n';

  body += '\u{1F4C5} DOGS WALKING MONDAY\n';
  body += '\u{26F0}\uFE0F Plateau: ' + plateauCount + ' dogs\n';
  body += '\u{1F333} Laurier: ' + laurierCount + ' dogs\n';
  body += 'Total: ' + (plateauCount + laurierCount) + '\n\n';

  // Must-ask dogs
  var mustAskDogs = getMondayMustAsk_();
  if (mustAskDogs.length > 0) {
    body += '📞 MUST ASK — CONTACT TODAY\n';
    for (var ma = 0; ma < mustAskDogs.length; ma++) {
      var dog = mustAskDogs[ma];
      var method = dog.contact_method || '?';
      var handle = dog.contact_handle || '';
      body += '• ' + dog.dog_name + ' — ' + method;
      if (handle) body += ' (' + handle + ')';
      body += '\n';
    }
    body += '\n';
  }

  if (scheduleChanges.length > 0) {
    body += '\u{1F504} SCHEDULE CHANGES THIS WEEK\n';
    body += scheduleChanges.join('\n') + '\n\n';
  }

  if (walkerCoverage.length > 0) {
    body += '\u{1F6B6} WALKER COVERAGE\n';
    body += walkerCoverage.join('\n') + '\n\n';
  }

  if (lowPackages.length > 0) {
    body += '\u{26A0}\uFE0F LOW/EMPTY PACKAGES (top 5)\n';
    for (var lp = 0; lp < Math.min(lowPackages.length, 5); lp++) {
      body += '\u2022 ' + lowPackages[lp].dog + ' \u2014 ' + lowPackages[lp].walksLeft + ' walks (' + lowPackages[lp].status + ')\n';
    }
    body += '\n';
  }

  if (openTasks.length > 0) {
    body += '\u2705 OPEN TASKS FOR @GEN\n';
    body += openTasks.join('\n') + '\n\n';
  }

  if (owlNotes.length > 0) {
    body += '\u{1F989} ACTIVE OWL NOTES\n';
    body += owlNotes.join('\n') + '\n\n';
  }

  body += 'Have a great week! \u{1F43E}\n\u2014 Wiggle Tower';

  var subject = '\uD83D\uDC15 Wiggle Monday Prep \u2014 ' + mondayDisplay;

  try {
    GmailApp.sendEmail(CONFIG.email.gen, subject, body, {
      from: CONFIG.email.wiggle,
      name: 'Wiggle Control Tower',
    });
    Logger.log('sendMondayPrepEmail: sent to ' + CONFIG.email.gen);
  } catch (e) {
    Logger.log('sendMondayPrepEmail error: ' + e.message);
  }

  // Audit log
  if (dashSheet) {
    var existingLogs = [];
    for (var lr = 29; lr <= 38; lr++) {
      var who = dashSheet.getRange(lr, 2).getValue();
      var what = dashSheet.getRange(lr, 3).getValue();
      var time = dashSheet.getRange(lr, 7).getValue();
      if (who || what) existingLogs.push({ who: who, what: what, time: time, color: 'system' });
    }
    existingLogs.unshift({
      who: 'Tower',
      what: 'Monday prep email sent to Gen',
      time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'),
      color: 'beast',
    });
    writeAuditLog_(dashSheet, existingLogs);
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL — Friday Billing Summary (Friday 4 PM trigger)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generates and sends a Friday billing summary email to Gen.
 * Triggered Friday at 4 PM. Lists dogs needing renewal,
 * suggested packages, and total potential value.
 */
function sendFridayBillingEmail() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var billingSheet = ss.getSheetByName(TABS.BILLING);
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'EEEE, MMMM d');

  var packagePrices = {
    '5 walks - $150': 150,
    '10 walks - $280': 280,
    '20 walks - $520': 520,
    'Private - $45/walk': 45,
  };

  var plateauRenewals = [];
  var laurierRenewals = [];
  var totalValue = 0;

  if (billingSheet) {
    function readRenewals(startRow, endRow, list) {
      for (var r = startRow; r <= endRow; r++) {
        var dog = billingSheet.getRange(r, 1).getValue();
        if (!dog) continue;
        var walksLeft = Number(billingSheet.getRange(r, 4).getValue()) || 0;
        if (walksLeft > 3) continue;
        var owner = billingSheet.getRange(r, 2).getValue() || '';
        var pkg = billingSheet.getRange(r, 7).getValue() || '10 walks - $280';
        var price = packagePrices[pkg] || 0;
        list.push({ dog: dog, owner: owner, package: pkg, walksLeft: walksLeft, price: price });
        totalValue += price;
      }
    }
    readRenewals(6, 30, plateauRenewals);
    readRenewals(34, 58, laurierRenewals);
  }

  var body = 'Hi Gen! \uD83D\uDCB0 Here\u2019s your Friday billing summary:\n\n';

  if (plateauRenewals.length > 0) {
    body += '\u{26F0}\uFE0F PLATEAU \u2014 NEEDS RENEWAL\n';
    for (var p = 0; p < plateauRenewals.length; p++) {
      var pr = plateauRenewals[p];
      body += '\u2022 ' + pr.dog + ' (' + pr.owner + ') \u2014 ' + pr.walksLeft + ' left \u2192 ' + pr.package + '\n';
    }
    body += '\n';
  }

  if (laurierRenewals.length > 0) {
    body += '\u{1F333} LAURIER \u2014 NEEDS RENEWAL\n';
    for (var l = 0; l < laurierRenewals.length; l++) {
      var lr = laurierRenewals[l];
      body += '\u2022 ' + lr.dog + ' (' + lr.owner + ') \u2014 ' + lr.walksLeft + ' left \u2192 ' + lr.package + '\n';
    }
    body += '\n';
  }

  if (plateauRenewals.length === 0 && laurierRenewals.length === 0) {
    body += 'All packages looking good! No urgent renewals this week. \u2705\n\n';
  }

  body += '\u{1F4B5} TOTAL POTENTIAL RENEWAL VALUE: $' + totalValue + '\n\n';
  body += 'Send bills via \uD83D\uDC15 Wiggle \u2192 Send All Bills in the spreadsheet.\n\n';
  body += 'Have a great weekend! \u{1F43E}\n\u2014 Wiggle Tower';

  var subject = '\uD83D\uDCB0 Wiggle Friday Billing \u2014 ' + dateStr;

  try {
    GmailApp.sendEmail(CONFIG.email.gen, subject, body, {
      from: CONFIG.email.wiggle,
      name: 'Wiggle Control Tower',
    });
    Logger.log('sendFridayBillingEmail: sent to ' + CONFIG.email.gen);
  } catch (e) {
    Logger.log('sendFridayBillingEmail error: ' + e.message);
  }

  // Audit log
  var dashSheet = ss.getSheetByName(TABS.DASHBOARD);
  if (dashSheet) {
    var existingLogs = [];
    for (var alr = 29; alr <= 38; alr++) {
      var who = dashSheet.getRange(alr, 2).getValue();
      var what = dashSheet.getRange(alr, 3).getValue();
      var time = dashSheet.getRange(alr, 7).getValue();
      if (who || what) existingLogs.push({ who: who, what: what, time: time, color: 'system' });
    }
    existingLogs.unshift({
      who: 'Tower',
      what: 'Friday billing email sent \u2014 $' + totalValue + ' pending',
      time: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'),
      color: 'beast',
    });
    writeAuditLog_(dashSheet, existingLogs);
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BILLING — Export Report (PDF email)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Exports the Billing tab as a PDF and emails it to Rod.
 * Menu action: "Export Report"
 */
function exportReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var billingSheet = ss.getSheetByName(TABS.BILLING);

  if (!billingSheet) {
    SpreadsheetApp.getUi().alert('Billing tab not found. Run Setup Tower first.');
    return;
  }

  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Build PDF export URL for the Billing tab only
  var ssId = ss.getId();
  var sheetId = billingSheet.getSheetId();
  var url = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?'
    + 'exportFormat=pdf'
    + '&format=pdf'
    + '&size=letter'
    + '&portrait=true'
    + '&fitw=true'
    + '&gridlines=false'
    + '&printtitle=false'
    + '&sheetnames=false'
    + '&pagenum=false'
    + '&fzr=true'
    + '&gid=' + sheetId;

  var token = ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    SpreadsheetApp.getUi().alert('Failed to generate PDF: HTTP ' + response.getResponseCode());
    return;
  }

  var pdfBlob = response.getBlob().setName('Wiggle_Billing_Report_' + dateStr + '.pdf');

  var subject = '\uD83D\uDCC4 Wiggle Billing Report \u2014 ' + dateStr;
  var body = 'Hi Rod,\n\n'
    + 'Attached is the latest Wiggle billing report as of ' + dateStr + '.\n\n'
    + 'Cheers,\nWiggle Control Tower';

  try {
    GmailApp.sendEmail(CONFIG.email.rodrigo, subject, body, {
      from: CONFIG.email.wiggle,
      name: 'Wiggle Control Tower',
      attachments: [pdfBlob],
    });
    Logger.log('exportReport: PDF sent to ' + CONFIG.email.rodrigo);
    SpreadsheetApp.getUi().alert('Report sent to Rod.');
  } catch (e) {
    Logger.log('exportReport error: ' + e.message);
    SpreadsheetApp.getUi().alert('Error sending report: ' + e.message);
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUDIT LOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Writes a single audit entry to the Dashboard "Today's Log" section
 * and persists to PropertiesService for full audit history.
 * @param {string} who - "System", "Rod", "Gen", or "Walker Sam"
 * @param {string} what - Description of what happened
 * @param {string} severity - "info", "warning", "error", "success"
 */
function logToAudit(who, what, severity) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.DASHBOARD);
  if (!sheet) return;

  var timeStr = Utilities.formatDate(new Date(), 'America/Toronto', 'HH:mm');

  // Determine color based on who
  var dotColor;
  var whoLower = String(who).toLowerCase();
  if (whoLower === 'system') {
    dotColor = COLORS.GREEN;
  } else if (whoLower.indexOf('walker') === 0) {
    dotColor = COLORS.BLUE;
  } else if (whoLower === 'gen') {
    dotColor = COLORS.PURPLE;
  } else if (whoLower === 'rod') {
    dotColor = COLORS.ORANGE;
  } else {
    dotColor = COLORS.GREEN;
  }

  // Find next empty row in log section (rows 29-38)
  var nextRow = -1;
  for (var r = 29; r <= 38; r++) {
    if (!sheet.getRange(r, 2).getValue()) {
      nextRow = r;
      break;
    }
  }

  // If log is full, shift everything up (drop oldest)
  if (nextRow === -1) {
    for (var s = 29; s < 38; s++) {
      sheet.getRange(s, 1).setBackground(sheet.getRange(s + 1, 1).getBackground());
      sheet.getRange(s, 2).setValue(sheet.getRange(s + 1, 2).getValue());
      sheet.getRange(s, 3, 1, 4).merge().setValue(sheet.getRange(s + 1, 3).getValue());
      sheet.getRange(s, 7).setValue(sheet.getRange(s + 1, 7).getValue());
    }
    nextRow = 38;
    sheet.getRange(38, 2).clearContent();
    sheet.getRange(38, 3, 1, 4).merge().clearContent();
    sheet.getRange(38, 7).clearContent();
  }

  // Write entry
  sheet.getRange(nextRow, 1).setBackground(dotColor);
  sheet.getRange(nextRow, 2).setValue(who);
  sheet.getRange(nextRow, 3, 1, 4).merge().setValue(what);
  sheet.getRange(nextRow, 7).setValue(timeStr);

  // Persist to PropertiesService for full history
  var props = PropertiesService.getScriptProperties();
  var history = [];
  try {
    var raw = props.getProperty('audit_history');
    if (raw) history = JSON.parse(raw);
  } catch (e) {}

  history.push({
    who: who,
    what: what,
    severity: severity,
    time: timeStr,
    date: Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM-dd'),
  });

  // Keep last 200 entries
  if (history.length > 200) {
    history = history.slice(history.length - 200);
  }

  props.setProperty('audit_history', JSON.stringify(history));
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Adds a task to the Dashboard task section.
 * @param {string} assignee - "@gen", "@rod", or "@all"
 * @param {string} text - Task description
 * @param {string} fromWho - Who created the task
 */
function addTask(assignee, text, fromWho) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.DASHBOARD);
  if (!sheet) return;

  var dateStr = Utilities.formatDate(new Date(), 'America/Toronto', 'MM/dd');
  var targets = [];

  assignee = String(assignee).toLowerCase().trim();
  if (assignee === '@gen' || assignee === 'gen') {
    targets.push('gen');
  } else if (assignee === '@rod' || assignee === 'rod') {
    targets.push('rod');
  } else if (assignee === '@all' || assignee === 'all') {
    targets.push('gen');
    targets.push('rod');
  } else {
    targets.push('gen'); // default to gen
  }

  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    var colOffset = (target === 'gen') ? 0 : 4; // gen=A-D, rod=E-H
    var checkboxCol = 1 + colOffset;  // A or E
    var textCol = 2 + colOffset;      // B or F
    var fromCol = 3 + colOffset;      // C or G
    var dateCol = 4 + colOffset;      // D or H

    // Find next empty task row (rows 20-26)
    for (var r = 20; r <= 26; r++) {
      if (!sheet.getRange(r, textCol).getValue()) {
        sheet.getRange(r, checkboxCol).setValue(false);
        sheet.getRange(r, textCol).setValue(text);
        sheet.getRange(r, fromCol).setValue(fromWho);
        sheet.getRange(r, dateCol).setValue(dateStr);
        break;
      }
    }
  }

  logToAudit('System', 'Task added for ' + assignee + ': ' + text, 'info');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MORNING CHECK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Runs the morning check: validates today's schedule, finds conflicts,
 * checks walker coverage, logs auto-fixes. Triggered at 9 AM daily
 * and from the Wiggle menu.
 */
function runMorningCheck() {
  try {
  // Weekend guard
  var today = new Date();
  var dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    try {
      SpreadsheetApp.getUi().alert("It's the weekend! No walks scheduled.");
    } catch (e) {
      // Triggered from time-based trigger (no UI)
      Logger.log('Morning check skipped: weekend');
    }
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.DASHBOARD);

  // Sync Acuity
  var acuityData = syncAcuityToday();

  var problems = [];
  var opportunities = [];
  var autoFixed = [];

  var todayStr = Utilities.formatDate(today, 'America/Toronto', 'yyyy-MM-dd');

  // ---- A. Check each appointment ----
  var allDogs = [];
  for (var sectorName in acuityData.sectors) {
    var dogs = acuityData.sectors[sectorName];
    for (var d = 0; d < dogs.length; d++) {
      allDogs.push(dogs[d]);
    }
  }

  for (var i = 0; i < allDogs.length; i++) {
    var dog = allDogs[i];

    // a. Unmatched names
    if (!dog.matched) {
      problems.push({
        type: 'critical',
        title: '🔴 Unknown dog',
        detail: '"' + dog.ownerFirst + '" at ' + (dog.time || 'N/A') + ' — no match in roster',
        severity: 'critical',
      });
    }
  }

  // ---- B. Conflict rules ----
  var schedSheet = ss.getSheetByName(TABS.SCHEDULE);
  if (schedSheet) {
    // Read conflict rules (rows 30-36)
    for (var cr = 30; cr <= 36; cr++) {
      var dog1 = String(schedSheet.getRange(cr, 1).getValue()).trim();
      var dog2 = String(schedSheet.getRange(cr, 2).getValue()).trim();
      var rule = String(schedSheet.getRange(cr, 3).getValue()).trim();
      if (!dog1 || !dog2) continue;

      // Check if both dogs are in the same sector today
      for (var secName in acuityData.sectors) {
        var secDogs = acuityData.sectors[secName];
        var hasDog1 = false, hasDog2 = false;
        for (var sd = 0; sd < secDogs.length; sd++) {
          if (secDogs[sd].dogName === dog1) hasDog1 = true;
          if (secDogs[sd].dogName === dog2) hasDog2 = true;
        }
        if (hasDog1 && hasDog2) {
          problems.push({
            type: 'warning',
            title: '🟡 Conflict',
            detail: dog1 + ' + ' + dog2 + ' in same group (' + secName + ')',
            severity: 'warning',
          });
        }
      }
    }

    // ---- C. Sector overrides ----
    for (var so = 40; so <= 44; so++) {
      var overrideDog = String(schedSheet.getRange(so, 1).getValue()).trim();
      var overrideSector = String(schedSheet.getRange(so, 2).getValue()).trim();
      if (!overrideDog || !overrideSector) continue;

      // Check if dog is booked in wrong sector
      for (var checkSec in acuityData.sectors) {
        if (checkSec === overrideSector || checkSec === 'Unknown' || checkSec === 'Private') continue;
        var secList = acuityData.sectors[checkSec];
        for (var cs = 0; cs < secList.length; cs++) {
          if (secList[cs].dogName === overrideDog) {
            autoFixed.push(overrideDog + ' auto-moved to ' + overrideSector);
          }
        }
      }
    }

    // ---- D. Check vacations vs bookings ----
    for (var vr = 6; vr <= 25; vr++) {
      var vacDog = String(schedSheet.getRange(vr, 1).getValue()).trim();
      var vacType = String(schedSheet.getRange(vr, 2).getValue()).trim();
      var vacStart = schedSheet.getRange(vr, 3).getValue();
      var vacEnd = schedSheet.getRange(vr, 4).getValue();
      var vacStatus = String(schedSheet.getRange(vr, 6).getValue()).trim();
      if (!vacDog || vacStatus !== 'Active' || vacType !== 'OFF') continue;

      // Check date range
      if (vacStart && vacEnd) {
        var startDate = new Date(vacStart);
        var endDate = new Date(vacEnd);
        if (today >= startDate && today <= endDate) {
          // Dog should be on vacation — check if booked
          for (var vs in acuityData.sectors) {
            var vsList = acuityData.sectors[vs];
            for (var vi = 0; vi < vsList.length; vi++) {
              if (vsList[vi].dogName === vacDog) {
                problems.push({
                  type: 'warning',
                  title: '⚠️ Vacation conflict',
                  detail: vacDog + ' is on vacation but booked in Acuity',
                  severity: 'warning',
                });
              }
            }
          }
        }
      }
    }
  }

  // ---- E. Package balance warnings ----
  try {
    var certs = fetchAcuityCertificates();
    for (var ci = 0; ci < certs.length; ci++) {
      if (certs[ci].remaining === 0) {
        problems.push({
          type: 'warning',
          title: '⚠️ Empty package',
          detail: certs[ci].clientName + ' — 0 walks remaining',
          severity: 'warning',
        });
      } else if (certs[ci].remaining >= 1 && certs[ci].remaining <= 3) {
        opportunities.push({
          type: 'info',
          title: '💰 Package nudge',
          detail: certs[ci].clientName + ' — ' + certs[ci].remaining + ' walks left',
        });
      }
    }
  } catch (e) {
    Logger.log('Morning check: package check skipped — ' + e.message);
  }

  // ---- F. Walker coverage ----
  var staffSheet = ss.getSheetByName(TABS.STAFF);
  if (staffSheet) {
    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var todayDayName = dayNames[dayOfWeek];
    // Map day name to column: Monday=C(3), Tuesday=D(4), Wednesday=E(5), Thursday=F(6), Friday=G(7)
    var dayColMap = { Monday: 3, Tuesday: 4, Wednesday: 5, Thursday: 6, Friday: 7 };
    var todayCol = dayColMap[todayDayName];

    if (todayCol) {
      // Check walker vacations (rows 18-27 in Staff tab)
      for (var wr = 18; wr <= 27; wr++) {
        var walkerName = String(staffSheet.getRange(wr, 1).getValue()).trim();
        var vacStart2 = staffSheet.getRange(wr, 3).getValue();
        var vacEnd2 = staffSheet.getRange(wr, 4).getValue();
        var substitute = String(staffSheet.getRange(wr, 5).getValue()).trim();
        var vacStatus2 = String(staffSheet.getRange(wr, 6).getValue()).trim();

        if (!walkerName || vacStatus2 !== 'Active') continue;

        if (vacStart2 && vacEnd2) {
          var wStart = new Date(vacStart2);
          var wEnd = new Date(vacEnd2);
          if (today >= wStart && today <= wEnd) {
            if (!substitute) {
              // Find walker's sector from schedule section
              var walkerSector = 'Unknown';
              for (var ws = 5; ws <= 14; ws++) {
                var schedName = String(staffSheet.getRange(ws, 1).getValue()).trim();
                if (schedName === walkerName) {
                  walkerSector = String(staffSheet.getRange(ws, todayCol).getValue()).trim();
                  break;
                }
              }
              problems.push({
                type: 'critical',
                title: '🔴 No walker coverage',
                detail: walkerName + ' is off, no substitute for ' + walkerSector,
                severity: 'critical',
              });
            }
          }
        }
      }

      // Check capacity per sector
      for (var capSec in acuityData.sectors) {
        if (capSec === 'Unknown' || capSec === 'Private') continue;
        var capCount = acuityData.sectors[capSec].length;
        if (capCount >= CONFIG.capacity.critical) {
          // Only add if not already in problems
          var alreadyAdded = false;
          for (var pa = 0; pa < problems.length; pa++) {
            if (problems[pa].detail && problems[pa].detail.indexOf(capSec) >= 0 && problems[pa].detail.indexOf('OVER') >= 0) {
              alreadyAdded = true;
              break;
            }
          }
          if (!alreadyAdded) {
            problems.push({
              type: 'warning',
              title: '🔴 ' + capSec + ' at ' + capCount,
              detail: capSec + ' at ' + capCount + ' dogs — OVER CAPACITY',
              severity: 'critical',
            });
          }
        } else if (capCount >= CONFIG.capacity.warning) {
          opportunities.push({
            type: 'info',
            title: '📊 ' + capSec + ' at ' + capCount,
            detail: capSec + ' at ' + capCount + ' dogs — approaching capacity',
          });
        }
      }
    }
  }

  // ---- Write results to Dashboard ----
  if (sheet) {
    // Clear and write recap cards
    writeProblemCards_(sheet, problems);

    // Clear and write opportunities (rows 13-16)
    for (var oc = 13; oc <= 16; oc++) {
      sheet.getRange(oc, 1, 1, 2).merge().clearContent();
      sheet.getRange(oc, 3, 1, 2).merge().clearContent();
      sheet.getRange(oc, 5, 1, 2).merge().clearContent();
    }

    // Follow-ups count
    var followUpCount = problems.filter(function(p) { return p.type === 'critical'; }).length;
    sheet.getRange('A12:B12').merge()
      .setValue('🔄 Follow-ups (' + followUpCount + ')');

    // Write follow-up items
    var criticals = problems.filter(function(p) { return p.type === 'critical'; });
    for (var fu = 0; fu < Math.min(criticals.length, 4); fu++) {
      sheet.getRange(13 + fu, 1, 1, 2).merge()
        .setValue('  ' + criticals[fu].detail);
    }

    // Package nudge count
    var nudges = opportunities.filter(function(o) { return o.title && o.title.indexOf('Package') >= 0; });
    sheet.getRange('C12:D12').merge()
      .setValue('💰 Package Nudge (' + nudges.length + ')');
    for (var nu = 0; nu < Math.min(nudges.length, 4); nu++) {
      sheet.getRange(13 + nu, 3, 1, 2).merge()
        .setValue('  ' + nudges[nu].detail);
    }

    // Auto-fixed items logged as green System entries
    for (var af = 0; af < autoFixed.length; af++) {
      logToAudit('System', autoFixed[af], 'success');
    }

    // Summary log
    var okCount = acuityData.totalAppointments - problems.length;
    if (okCount < 0) okCount = 0;
    logToAudit('System',
      'Morning check: ' + problems.length + ' problems, ' +
      opportunities.length + ' opportunities, ' +
      autoFixed.length + ' auto-fixed, ' +
      okCount + ' dogs OK',
      'info');

    // Update date
    var dateDisplay = Utilities.formatDate(today, 'America/Toronto', 'EEEE, MMMM d, yyyy');
    sheet.getRange('A2').setValue(dateDisplay);
  }

  // Refresh Weekly Board
  try { refreshWeeklyBoard(); } catch (e) {
    Logger.log('Morning check: Weekly Board refresh skipped — ' + e.message);
  }

  Logger.log('runMorningCheck: Complete — ' + problems.length + ' problems, ' +
    opportunities.length + ' opportunities, ' + autoFixed.length + ' auto-fixed');
  } catch(e) {
    Logger.log('runMorningCheck error: ' + e.message);
    try { SpreadsheetApp.getUi().alert('Error: ' + e.message); } catch(u) {}
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTO-CLEAN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Auto-cleans expired vacations, owl notes, and completed tasks.
 * Triggered at midnight daily.
 */
function autoCleanExpired() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var vacExpired = 0;
  var notesExpired = 0;
  var tasksCleared = 0;

  // ---- Schedule Ecosystem: Vacations (rows 6-25) ----
  var schedSheet = ss.getSheetByName(TABS.SCHEDULE);
  if (schedSheet) {
    for (var vr = 6; vr <= 25; vr++) {
      var endDate = schedSheet.getRange(vr, 4).getValue(); // column D = End Date
      var status = String(schedSheet.getRange(vr, 6).getValue()).trim(); // column F = Status
      if (endDate && status === 'Active') {
        var end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        if (end < today) {
          schedSheet.getRange(vr, 6).setValue('Expired');
          schedSheet.getRange('A' + vr + ':F' + vr).setBackground('#e8e6e3');
          schedSheet.getRange('A' + vr + ':F' + vr).setFontColor('#999999');
          vacExpired++;
        }
      }
    }

    // ---- Owl Notes (rows 48-60) ----
    for (var on = 48; on <= 60; on++) {
      var expires = schedSheet.getRange(on, 5).getValue(); // column E = Expires
      var noteStatus = String(schedSheet.getRange(on, 6).getValue()).trim(); // column F = Status
      if (expires && noteStatus === 'Active') {
        var expDate = new Date(expires);
        expDate.setHours(0, 0, 0, 0);
        if (expDate < today) {
          schedSheet.getRange(on, 6).setValue('Expired');
          schedSheet.getRange('A' + on + ':F' + on).setBackground('#e8e6e3');
          notesExpired++;
        }
      }
    }
  }

  // ---- Dashboard tasks: clear completed + older than 24h (rows 20-26) ----
  var dashSheet = ss.getSheetByName(TABS.DASHBOARD);
  if (dashSheet) {
    var yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    for (var tr = 20; tr <= 26; tr++) {
      // Check @gen tasks (columns A-D)
      var genChecked = dashSheet.getRange(tr, 1).getValue();
      var genDate = dashSheet.getRange(tr, 4).getValue();
      if (genChecked === true && genDate) {
        var gd = new Date(genDate);
        if (gd < yesterday) {
          dashSheet.getRange(tr, 1).setValue(false);
          dashSheet.getRange(tr, 2).clearContent();
          dashSheet.getRange(tr, 3).clearContent();
          dashSheet.getRange(tr, 4).clearContent();
          tasksCleared++;
        }
      }

      // Check @rod tasks (columns E-H)
      var rodChecked = dashSheet.getRange(tr, 5).getValue();
      var rodDate = dashSheet.getRange(tr, 8).getValue();
      if (rodChecked === true && rodDate) {
        var rd = new Date(rodDate);
        if (rd < yesterday) {
          dashSheet.getRange(tr, 5).setValue(false);
          dashSheet.getRange(tr, 6).clearContent();
          dashSheet.getRange(tr, 7).clearContent();
          dashSheet.getRange(tr, 8).clearContent();
          tasksCleared++;
        }
      }
    }
  }

  logToAudit('System',
    'Auto-clean: ' + vacExpired + ' vacations expired, ' +
    notesExpired + ' notes expired, ' +
    tasksCleared + ' tasks cleared',
    'info');

  Logger.log('autoCleanExpired: ' + vacExpired + ' vac, ' + notesExpired + ' notes, ' + tasksCleared + ' tasks');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OWL NOTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Creates a new Owl Note via interactive prompts.
 * Menu action: 🐕 Wiggle → 🦉 New Owl Note
 */
function newOwlNote() {
  var ui = SpreadsheetApp.getUi();

  // Step 1: Who is this note for?
  var targetResp = ui.prompt(
    '🦉 New Owl Note',
    'Who is this note for? (dog name or @all)',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetResp.getSelectedButton() !== ui.Button.OK) return;
  var target = targetResp.getResponseText().trim();
  if (!target) {
    ui.alert('No target specified.');
    return;
  }

  // Step 2: What's the note?
  var messageResp = ui.prompt(
    '🦉 New Owl Note',
    "What's the note?",
    ui.ButtonSet.OK_CANCEL
  );
  if (messageResp.getSelectedButton() !== ui.Button.OK) return;
  var message = messageResp.getResponseText().trim();
  if (!message) {
    ui.alert('No message entered.');
    return;
  }

  // Step 3: Expiry date
  var expiryResp = ui.prompt(
    '🦉 New Owl Note',
    'When should it expire? (YYYY-MM-DD or leave blank for 1 week)',
    ui.ButtonSet.OK_CANCEL
  );
  if (expiryResp.getSelectedButton() !== ui.Button.OK) return;
  var expiryText = expiryResp.getResponseText().trim();

  var expiryDate;
  if (expiryText) {
    expiryDate = new Date(expiryText);
    if (isNaN(expiryDate.getTime())) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);
    }
  } else {
    expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
  }

  var expiryStr = Utilities.formatDate(expiryDate, 'America/Toronto', 'yyyy-MM-dd');
  var todayStr = Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM-dd');

  // Detect author
  var author = 'Gen';
  try {
    var email = Session.getActiveUser().getEmail();
    if (email && email.indexOf('rod') >= 0) author = 'Rod';
  } catch (e) {}

  // Write to Schedule Ecosystem Owl Notes section (rows 48-60)
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var schedSheet = ss.getSheetByName(TABS.SCHEDULE);
  if (!schedSheet) {
    ui.alert('Schedule Ecosystem tab not found. Run Setup Tower first.');
    return;
  }

  var written = false;
  for (var r = 48; r <= 60; r++) {
    if (!schedSheet.getRange(r, 1).getValue()) {
      schedSheet.getRange(r, 1).setValue(target);   // Target
      schedSheet.getRange(r, 2).setValue(message);   // Message
      schedSheet.getRange(r, 3).setValue(author);    // Author
      schedSheet.getRange(r, 4).setValue(todayStr);  // Created
      schedSheet.getRange(r, 5).setValue(expiryStr); // Expires
      schedSheet.getRange(r, 6).setValue('Active');  // Status
      written = true;
      break;
    }
  }

  if (!written) {
    ui.alert('Owl Notes section is full! Clear some expired notes first.');
    return;
  }

  // Also push to Supabase
  try {
    pushOwlNote(target, message, author, expiryStr);
  } catch (e) {
    Logger.log('newOwlNote: Supabase push skipped — ' + e.message);
  }

  logToAudit(author, 'New owl note for ' + target + ': ' + message, 'info');

  ui.alert('🦉 Owl note added!\n\nTarget: ' + target + '\nExpires: ' + expiryStr +
    '\n\nPush Changes → App to send it to walkers.');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TODAY'S SUMMARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Builds a text summary of today's dashboard state.
 * Used by askTheBeast() to include context in the system prompt.
 * @returns {string} Formatted text summary
 */
function copyTodaySummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TABS.DASHBOARD);
  if (!sheet) return '(Dashboard not found)';

  var today = new Date();
  var dateStr = Utilities.formatDate(today, 'America/Toronto', 'EEEE, MMMM d, yyyy');

  var summary = "TODAY'S SUMMARY — " + dateStr + '\n\n';

  // ---- RECAP (rows 6-9) ----
  summary += 'RECAP:\n';
  var hasRecap = false;
  for (var r = 6; r <= 9; r++) {
    var title1 = sheet.getRange(r, 2).getValue();
    var detail1 = sheet.getRange(r, 3).getValue();
    if (title1) {
      summary += '- ' + title1 + (detail1 ? ' — ' + detail1 : '') + '\n';
      hasRecap = true;
    }
    var title2 = sheet.getRange(r, 6).getValue();
    var detail2 = sheet.getRange(r, 7).getValue();
    if (title2) {
      summary += '- ' + title2 + (detail2 ? ' — ' + detail2 : '') + '\n';
      hasRecap = true;
    }
  }
  if (!hasRecap) summary += '- No issues\n';

  // ---- OPPORTUNITIES (rows 12-16) ----
  summary += '\nOPPORTUNITIES:\n';
  var hasOpps = false;

  // Follow-ups header
  var followHeader = sheet.getRange('A12').getValue();
  if (followHeader) summary += followHeader + '\n';
  for (var f = 13; f <= 16; f++) {
    var fVal = sheet.getRange(f, 1).getValue();
    if (fVal) { summary += '  ' + fVal + '\n'; hasOpps = true; }
  }

  // Package nudge header
  var nudgeHeader = sheet.getRange('C12').getValue();
  if (nudgeHeader) summary += nudgeHeader + '\n';
  for (var p = 13; p <= 16; p++) {
    var pVal = sheet.getRange(p, 3).getValue();
    if (pVal) { summary += '  ' + pVal + '\n'; hasOpps = true; }
  }

  // Owl notes header
  var owlHeader = sheet.getRange('E12').getValue();
  if (owlHeader) summary += owlHeader + '\n';
  for (var o = 13; o <= 16; o++) {
    var oVal = sheet.getRange(o, 5).getValue();
    if (oVal) { summary += '  ' + oVal + '\n'; hasOpps = true; }
  }

  if (!hasOpps) summary += '- None\n';

  // ---- TASKS (rows 20-26) ----
  summary += '\nTASKS:\n@gen: ';
  var genTasks = [];
  for (var gt = 20; gt <= 26; gt++) {
    var gTask = sheet.getRange(gt, 2).getValue();
    if (gTask) genTasks.push(String(gTask));
  }
  summary += genTasks.length > 0 ? genTasks.join(', ') : 'none';

  summary += '\n@rod: ';
  var rodTasks = [];
  for (var rt = 20; rt <= 26; rt++) {
    var rTask = sheet.getRange(rt, 6).getValue();
    if (rTask) rodTasks.push(String(rTask));
  }
  summary += rodTasks.length > 0 ? rodTasks.join(', ') : 'none';

  // ---- LOG (rows 29-38) ----
  summary += '\n\nLOG:\n';
  var hasLog = false;
  for (var lr = 29; lr <= 38; lr++) {
    var logWho = sheet.getRange(lr, 2).getValue();
    var logWhat = sheet.getRange(lr, 3).getValue();
    var logTime = sheet.getRange(lr, 7).getValue();
    if (logWho) {
      summary += '- [' + logTime + '] ' + logWho + ': ' + logWhat + '\n';
      hasLog = true;
    }
  }
  if (!hasLog) summary += '- No entries\n';

  return summary;
}
