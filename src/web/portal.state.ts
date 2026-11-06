/** Steps of the sign-in flow. `error` overlays the step it returns to. */
type PortalStep = 'email' | 'code' | 'results' | 'error';

/** Steps that have their own panel. */
type PortalPanel = Exclude<PortalStep, 'error'>;

/** State of the sign-in flow. */
interface PortalState {
  step: PortalStep;
  /** Normalized email the code was requested for. */
  email: string;
  /** Panel shown while `step` is `error`. */
  returnTo: PortalPanel;
  /** Catalogue key of the error message, when it is a local one. */
  errorKey: MessageKey | null;
  /** Message sent by the server, which takes precedence over `errorKey`. */
  errorText: string | null;
  /** Epoch ms from which a new code may be requested. */
  resendAt: number;
}

/** Events that drive the flow. */
type PortalEvent =
  | { type: 'otpSent'; email: string; now: number }
  | { type: 'verified' }
  | { type: 'restore' }
  | { type: 'failed'; status: number | null; message: string | null }
  | { type: 'invalidInput'; key: MessageKey }
  | { type: 'dismissError' }
  | { type: 'changeEmail' }
  | { type: 'signOut' };

/** Seconds before a new code may be requested. */
const RESEND_COOLDOWN_SECONDS = 60;

/** Length of the access code. */
const OTP_LENGTH = 6;

/** The state the page starts in. */
function initialPortalState(): PortalState {
  return {
    step: 'email',
    email: '',
    returnTo: 'email',
    errorKey: null,
    errorText: null,
    resendAt: 0,
  };
}

/**
 * Panel to show for a state.
 * @param state Flow state.
 */
function portalPanel(state: PortalState): PortalPanel {
  return state.step === 'error' ? state.returnTo : state.step;
}

/**
 * Moves to a panel and clears any error.
 * @param state Flow state.
 * @param step Target panel.
 * @param patch Fields to change besides the step.
 */
function goTo(
  state: PortalState,
  step: PortalPanel,
  patch: Partial<PortalState> = {},
): PortalState {
  return {
    ...state,
    ...patch,
    step,
    returnTo: step,
    errorKey: null,
    errorText: null,
  };
}

/**
 * Overlays an error on the current panel.
 * @param state Flow state.
 * @param errorKey Local message, used when the server sent no text.
 * @param errorText Message sent by the server.
 */
function withError(
  state: PortalState,
  errorKey: MessageKey | null,
  errorText: string | null,
): PortalState {
  return {
    ...state,
    step: 'error',
    returnTo: portalPanel(state),
    errorKey,
    errorText,
  };
}

/**
 * Pure transition function of the sign-in flow.
 *
 * A 401 means the session is gone when it comes from the results panel, so
 * the flow falls back to `email`. From the code panel it means a wrong code,
 * so the flow stays there.
 * @param state Current state.
 * @param event Event to apply.
 */
function reducePortal(state: PortalState, event: PortalEvent): PortalState {
  const panel = portalPanel(state);
  switch (event.type) {
    case 'otpSent':
      return goTo(state, 'code', {
        email: event.email,
        resendAt: event.now + RESEND_COOLDOWN_SECONDS * 1000,
      });
    case 'verified':
    case 'restore':
      return goTo(state, 'results');
    case 'failed':
      if (event.status === 401 && panel === 'results') {
        return withError(
          goTo(state, 'email', { resendAt: 0 }),
          'auth.sessionInvalid',
          null,
        );
      }
      return event.status !== null && event.status < 500 && event.message
        ? withError(state, null, event.message)
        : withError(state, 'portal.serverError', null);
    case 'invalidInput':
      return withError(state, event.key, null);
    case 'dismissError':
      return state.step === 'error' ? goTo(state, state.returnTo) : state;
    case 'changeEmail':
      return goTo(state, 'email', { resendAt: 0 });
    case 'signOut':
      return goTo(state, 'email', { email: '', resendAt: 0 });
  }
}

/**
 * Whole seconds left before a new code may be requested.
 * @param state Flow state.
 * @param now Current epoch ms.
 */
function resendSecondsLeft(state: PortalState, now: number): number {
  return Math.max(0, Math.ceil((state.resendAt - now) / 1000));
}

/**
 * Keeps only the digits of a typed or pasted code, up to its length.
 * @param value Raw input.
 */
function normalizeCodeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}
