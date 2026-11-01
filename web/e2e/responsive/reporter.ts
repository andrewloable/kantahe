import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { auditOutDir } from './out';
import { buildReport, hasBlocker, loadBaseline, Outcome, toHtml, toMarkdown, verdict } from './report';

/** Collects what every audit test attached, writes report.json, report.md and index.html, and fails the run when there is a blocker. */
export default class AuditReporter implements Reporter {
  private readonly outcomes: Outcome[] = [];
  private readonly broken: string[] = [];
  private started = Date.now();

  onBegin(): void {
    this.started = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const attached = result.attachments.find((a) => a.name === 'audit' && a.body);
    if (attached?.body) this.outcomes.push(JSON.parse(attached.body.toString('utf8')) as Outcome);
    else if (result.status !== 'skipped') this.broken.push(`${test.title}: ${result.error?.message?.split('\n')[0] ?? result.status}`);
  }

  async onEnd(): Promise<{ status: FullResult['status'] } | undefined> {
    if (this.outcomes.length === 0 && this.broken.length === 0) {
      console.log('\nResponsive audit: no state was looked at (the set-up failed, or the filters match nothing)');
      return undefined;
    }
    const out = auditOutDir();
    mkdirSync(out, { recursive: true });
    const baselinePath = process.env['KANTAHE_AUDIT_BASELINE'];
    const report = buildReport(this.outcomes, Date.now() - this.started, baselinePath ? loadBaseline(resolve(baselinePath)) : undefined);
    writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
    writeFileSync(join(out, 'report.md'), toMarkdown(report));
    writeFileSync(join(out, 'index.html'), toHtml(report));

    const c = report.counts;
    console.log(`\nResponsive audit: ${report.states.length} screenshots, ${c.blocker} blocker, ${c.major} major, ${c.minor} minor`);
    if (report.newCounts) console.log(`  new since the baseline: ${report.newCounts.blocker} blocker, ${report.newCounts.major} major, ${report.newCounts.minor} minor`);
    console.log(`  ${join(out, 'report.md')}\n  ${join(out, 'index.html')}`);
    for (const line of this.broken) console.log(`  the audit itself failed: ${line}`);

    const allow = process.env['KANTAHE_AUDIT_ALLOW_FINDINGS'] === '1';
    if (hasBlocker(report) && !allow) console.log('  there are blockers: the run fails (--allow-findings records a baseline without failing)');
    return { status: verdict(report, this.broken, allow) };
  }
}
