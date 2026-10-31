import { BrowserContext, Page } from 'playwright';
import crypto from 'crypto';
import { ScrapeResult, ScraperConfig, ScraperRiskLevel, RiskLog } from './types';
import { logRiskEntry } from './riskLogger';

export abstract class BaseScraper {
  protected browser: any;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected config: ScraperConfig;

  constructor(browser: any, config: ScraperConfig) {
    this.browser = browser;
    this.config = config;
  }

  protected async getContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    this.context = await this.browser.newContext({
      userAgent: 'RevolutionX-Scraper/1.0',
    });
    this.page = await this.context!.newPage();
    return this.context!;
  }

  public async rateLimit(): Promise<void> {
    await new Promise((r) => setTimeout(r, 1000 / 10));
  }

  public async logRisk(
    user: string,
    action: string,
    target: string,
    context: any,
    riskLevel: ScraperRiskLevel,
    organizationId: string
  ): Promise<RiskLog> {
    const logEntry: Omit<RiskLog, 'id' | 'timestamp'> = {
      userId: user,
      organizationId,
      action,
      platform: this.config.platform as 'instagram' | 'facebook' | 'whatsapp' | 'google',
      target,
      riskLevel,
      context,
      result: riskLevel === 'critical' ? 'blocked' : 'success',
    };
    return await logRiskEntry(logEntry);
  }

  public async getSession(): Promise<string> {
    if (!this.context) throw new Error('context not initialized');
    const state = await this.context.storageState();
    return crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');
  }

  public async closeSession(): Promise<void> {
    if (this.context) await this.context.close();
    this.context = null;
    this.page = null;
  }

  public abstract scrape(params: any): Promise<ScrapeResult>;
}
