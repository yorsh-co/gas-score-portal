/**
 * Whether the script runs with the caller's own authority: the active user is
 * known and is the effective user. False for `google.script.run` calls from
 * the web app, which executes as the deployer: there the active user is blank
 * for anonymous visitors and another account for signed-in ones. Fails closed:
 * false when the session cannot be read. Never throws.
 */
function isCallerEffectiveUser_(): boolean {
  try {
    const active = Session.getActiveUser().getEmail();
    return !!active && active === Session.getEffectiveUser().getEmail();
  } catch {
    return false;
  }
}

/**
 * Refuses callers other than the user the script runs as. The web app runs as
 * the deployer and exposes every public top-level function through
 * `google.script.run`. Editor, menu and `clasp run` executions run as their
 * caller.
 * @param message Error message; defaults to `Forbidden`.
 * @throws {GasForbiddenError} When the active user is blank or is not the
 *   effective user.
 */
function assertCallerEffectiveUser_(message?: string): void {
  if (!isCallerEffectiveUser_()) throw new GasForbiddenError(message);
}
