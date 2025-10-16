import type { Logger } from "pino";
import type { HookStateRepository } from "../repositories/HookStateRepository";

export type WebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date: number;
  last_error_message: string;
  max_connections: number;
  allowed_updates: string[];
  ip_address: string;
};

export type SetWebhookBody = {
  ok: boolean;
  result: boolean;
  description: string;
};

export type GetWebhookInfoResponse = {
  ok: boolean;
  result: Omit<WebhookInfo, "allowed_updates">;
};

export class Telegram {
  private readonly baseUrl: string;
  private readonly hookStateRepository: HookStateRepository;
  private readonly logger: Logger;

  constructor({
    baseUrl = "https://api.telegram.org",
    hookStateRepository,
    logger,
  }: {
    baseUrl?: string;
    hookStateRepository: HookStateRepository;
    logger: Logger;
  }) {
    this.baseUrl = baseUrl;
    this.hookStateRepository = hookStateRepository;
    this.logger = logger;
  }

  public async ensureWebhook(
    botId: string,
    botToken: string,
    {
      url,
      allowedUpdates,
      secretToken,
    }: { url: string; allowedUpdates: string[]; secretToken: string },
  ) {
    const webhookInfoResponse = await this.getWebhookInfo(botToken);

    if (!webhookInfoResponse?.ok) {
      await this.hookStateRepository.setWebhookFailed(botId);
      return null;
    }

    const { result: webhookInfo } = webhookInfoResponse;

    if (webhookInfo.url === url) {
      return null;
    }

    // Update hook state with CAS logic built-in
    const updateResult = await this.hookStateRepository.update({
      botId,
      webhookUrl: url,
      secretToken,
    });

    if (!updateResult.success) {
      this.logger.warn({ botId }, 'Version mismatch, skipping webhook update');
      return null;
    }

    const setWebhookResult = await this.setWebhook(botToken, {
      url,
      allowedUpdates,
      secretToken,
    });

    if (!setWebhookResult?.ok) {
      await this.hookStateRepository.setWebhookFailed(botId);
      return setWebhookResult;
    }

    return setWebhookResult;
  }

  public async setWebhook(
    botToken: string,
    {
      url,
      allowedUpdates,
      secretToken,
    }: { url: string; allowedUpdates?: string[]; secretToken?: string },
  ): Promise<SetWebhookBody | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          allowed_updates: allowedUpdates,
          secret_token: secretToken,
        }),
      });

      return resp.json();
    } catch (error) {
      this.logger.error(error);

      return null;
    }
  }

  public async getWebhookInfo(
    botToken: string,
  ): Promise<GetWebhookInfoResponse | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/bot${botToken}/getWebhookInfo`);

      return resp.json();
    } catch (error) {
      this.logger.error(error);

      return null;
    }
  }

  public async deleteWebhook(
    botToken: string,
    { dropPendingUpdates }: { dropPendingUpdates?: boolean } = {},
  ) {
    const resp = await fetch(`${this.baseUrl}/bot${botToken}/deleteWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        drop_pending_updates: dropPendingUpdates,
      }),
    });

    return resp.json();
  }
}
