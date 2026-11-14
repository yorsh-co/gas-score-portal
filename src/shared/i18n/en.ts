/**
 * English catalogue, the source of truth of the message keys. Shared by the
 * Apps Script server and the web app. Placeholders use `{name}`.
 */
const MESSAGES_EN = {
  'menu.root': '🔶 Score Portal',
  'menu.settings': '⚙️ Settings',
  'menu.openSettings': '🛠️ Open settings',
  'menu.install': '💽 Install the script',
  'menu.uninstall': '💿 Uninstall the script',
  'menu.systemReset': '⛔ System reset',
  'menu.forms': '🟪 Forms',
  'menu.importDrive': '✔️ Import from Drive',
  'menu.linkForm': '➕ Add single Form',
  'menu.removeForms': '➖ Remove selected Form(s)',

  'toast.busy': 'Busy...',
  'toast.loading': 'Loading...',
  'toast.ready': 'Ready',
  'toast.success': 'Success',
  'toast.warning': 'Warning',
  'toast.error': 'Error',

  'prompt.default': 'Enter the {title}',
  'prompt.notBlank': 'This field cannot be empty',

  'error.cancelled': 'Cancelled by the user',
  'error.syncRunning':
    'A synchronization is in progress. Try again in a moment.',
  'error.settingsConflict': 'The settings changed in the meantime. Try again.',
  'error.fileInaccessible': 'Could not access the file',
  'error.respondentNotFound': 'Respondent not found',

  'install.installing': 'Installing the script',
  'install.triggersInstalled': 'The triggers were installed.',
  'install.timeZoneTitle': 'Time zone set to {timeZone}',
  'install.timeZoneBody': 'Open the Apps Script editor to change it',
  'install.creatingOverview': 'Creating the Overview sheet',
  'install.installed': 'The script was installed',

  'uninstall.title': '⚠️ Uninstall',
  'uninstall.body':
    'This will remove all triggers and delete all stored values like API keys and configuration values.\n\nThis action can only be reversed by re-installing the script from the menu.\n\n🆗 Click OK to uninstall.',
  'uninstall.toastTitle': 'Uninstalling',
  'uninstall.removingTriggers': 'Removing triggers',
  'uninstall.deletingProperties':
    'Deleting stored properties and configurations',
  'uninstall.complete': 'Uninstall complete',

  'reset.title': '⛔ System reset',
  'reset.body':
    '⚠️ Danger zone!\n\nAll Forms and scores will be removed from the system, and the script permissions will be revoked. To start again, you must follow every installation step after the reset.\n\n👉 Click OK to continue.',
  'reset.resetting': 'Resetting...',

  'forms.wrongSheet':
    'This action is only available from the {sheetName} sheet',
  'forms.noneSelected': 'No Forms selected',
  'forms.imported': 'Forms imported',
  'forms.linkTitle': '➕ Add single Form',
  'forms.linkPrompt': 'Enter the URL of the Forms file to link to the system.',
  'forms.accessWarning':
    'Could not access the Form "{url}". Check that you have permission to open the file.',
  'forms.reactivateTitle': '➕ Reactivate Form',
  'forms.reactivateBody':
    'The Form "{title}" is in the list of removed Forms.\n\n👉 Click OK to reactivate this Form.',
  'forms.linking': 'Linking "{title}"...',
  'forms.linked': '"{title}" linked',
  'forms.removeTitle': '➖ Remove Forms',
  'forms.removeBody':
    'The Forms below will be removed from the system and ignored when synchronizing scores:\n\n{list}\nTo reactivate one of these Forms, use the "➕ Add single Form" button.\n\n👉 Click OK to continue.',
  'forms.removing': 'Removing {count} Forms...',
  'forms.removed': 'Forms removed',

  'importer.searching': 'Searching for Forms in Drive',
  'importer.importing': 'Importing {count} new Forms',
  'importer.folderRequired':
    'Parent folder URL is required. Set the Drive folder URL in the settings.',
  'importer.folderAccessWarning':
    'Could not access the folder at "{url}". Check that you have permission to open the folder.',
  'importer.promptTitle': '🟪 Import Forms from Drive',
  'importer.promptBody':
    'Enter the URL of the Drive folder that contains the Forms to link to the system.\n\nLeave it empty to import Forms from the whole Drive.\n\n👉 Notes:\n- Only Forms that match the settings are imported.\n- New Forms in the folder are imported automatically within 60 minutes.',

  'portal.emailPlaceholder': 'Enter the email used in the quizzes',
  'portal.sendCodeButton': 'Send me a code',
  'portal.emailLabel': 'Email used in the quizzes',
  'portal.codeLabel': 'Access code',
  'portal.codeHelp': 'Enter the 6-digit code sent to {email}.',
  'portal.codeInvalid': 'Enter the 6-digit code.',
  'portal.verifyButton': 'View your scores',
  'portal.resendButton': 'Resend code',
  'portal.resendIn': 'Resend code in {seconds} s',
  'portal.changeEmail': 'Use another email',
  'portal.signOut': 'Sign out',
  'portal.refresh': 'Refresh',
  'portal.darkMode': 'Dark mode',
  'portal.labelName': 'Name',
  'portal.labelUsers': 'User(s)',
  'portal.labelResponses': 'Responses',
  'portal.labelAverage': 'Average score',
  'portal.labelForm': 'Module',
  'portal.labelScore': 'Score',
  'portal.privacyPolicy': 'Privacy policy',
  'portal.terms': 'Terms of use',
  'portal.legalNav': 'Legal',
  'portal.empty': 'No scores found.',
  'portal.loading': 'Loading scores…',
  'portal.note':
    'New scores may take up to an hour to appear after a form is submitted.',
  'portal.updatedAt': 'Updated on {date}.',
  'portal.notAnswered': 'Not answered',
  'portal.emailRequired': 'Enter your email.',
  'portal.emailInvalid': 'Enter a valid email.',
  'portal.serverError': 'Server error. Try again.',

  'auth.otpRequested':
    'If this email is registered, a code was sent. It expires in {minutes} minutes.',
  'auth.invalidEmail': 'Enter a valid email.',
  'auth.invalidCode': 'Invalid or expired code.',
  'auth.sessionInvalid': 'Your session expired. Sign in again.',
  'auth.tryLater': 'We could not send the code now. Try again later.',

  'email.otpSubject': '{portalTitle}: your access code',
  'email.otpIntro': 'Your access code for {portalTitle} is:',
  'email.otpExpiry':
    'It expires in {minutes} minutes and works only once. If you did not request it, ignore this email.',
};

/** The shape every catalogue must satisfy. */
type Messages = typeof MESSAGES_EN;

/** A message key. */
type MessageKey = keyof Messages;
