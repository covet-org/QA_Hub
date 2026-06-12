/**
 * Automation results provider — the extension point for phase 2.
 *
 * When the automated suite exists (e.g. Playwright in CI), implement
 * AutomationProvider against its results source (CI artifacts, a
 * reporting API, or pushed JSON) and swap it in getAutomationStatus().
 * The Automation page renders whatever this returns — no UI changes
 * needed to go live.
 */

export interface AutomationSuiteResult {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  durationSeconds: number;
  lastRunAt: string; // ISO timestamp
  ciUrl?: string;
}

export interface AutomationStatus {
  available: boolean;
  suites: AutomationSuiteResult[];
}

export interface AutomationProvider {
  getStatus(): Promise<AutomationStatus>;
}

/** Placeholder until the automation suite ships. */
class NotYetImplementedProvider implements AutomationProvider {
  async getStatus(): Promise<AutomationStatus> {
    return { available: false, suites: [] };
  }
}

const provider: AutomationProvider = new NotYetImplementedProvider();

export function getAutomationStatus(): Promise<AutomationStatus> {
  return provider.getStatus();
}
