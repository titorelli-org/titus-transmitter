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
    let apiCallAt: Date;
    let apiRespAt: Date;
    let setWebhookResult: SetWebhookBody | null;

    try {
      apiCallAt = new Date();

      setWebhookResult = await this.setWebhookWithRetry(botToken, {
        url,
        allowedUpdates,
        secretToken,
      });
      apiRespAt = new Date();

      if (!setWebhookResult?.ok) {
        await this.hookStateRepository.setWebhookFailed(botId);

        return setWebhookResult;
      }
    } catch (error) {
      console.error(error);
      throw error;
    }

    const webhookChanged = this.detectWebhookChange(setWebhookResult);

    if (!webhookChanged) {
      // Webhook didn't change, no database update needed
      this.logger.info(
        { botId, url },
        "Webhook already set, no database update needed",
      );

      return setWebhookResult;
    }

    const dbResult = await this.hookStateRepository.updateWithTiming(
      botId,
      url,
      secretToken,
      apiCallAt,
      apiRespAt,
      webhookChanged,
    );

    if (dbResult.success) {
      this.logger.info(
        { botId, url },
        "Webhook updated successfully with timing",
      );

      return setWebhookResult;
    }

    if (dbResult.conflict) {
      // PHASE 4: Handle conflict based on timing
      this.logger.warn(
        {
          botId,
          url,
          reason: dbResult.reason,
        },
        "Database conflict detected, newer API call exists",
      );

      // Check if we should force update or accept the conflict
      const currentState = await this.hookStateRepository.getByBotId(botId);

      if (
        currentState &&
        currentState.apiCallAt &&
        currentState.apiCallAt < apiCallAt
      ) {
        // Our call is newer, force update
        this.logger.info({ botId, url }, "Forcing update with newer API call");
        await this.hookStateRepository.forceUpdateWithTiming(
          botId,
          url,
          secretToken,
          apiCallAt,
          apiRespAt,
        );
        return setWebhookResult;
      } else {
        // Their call is newer, we lost
        this.logger.warn(
          { botId, url },
          "Newer API call exists, accepting conflict",
        );
        return setWebhookResult; // Still return success since API call succeeded
      }
    }

    // Database update failed for other reasons
    this.logger.error({ botId, url }, "Database update failed");
    return setWebhookResult; // Still return success since API call succeeded
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

  public async setWebhookWithRetry(
    botToken: string,
    {
      url,
      allowedUpdates,
      secretToken,
    }: { url: string; allowedUpdates?: string[]; secretToken?: string },
  ): Promise<SetWebhookBody | null> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
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

        const result = await resp.json();

        // Handle rate limiting
        if (result.error_code === 429) {
          const retryAfter = result.parameters?.retry_after || 1;
          this.logger.warn(
            {
              botToken,
              retryAfter,
              attempt: attempt + 1,
            },
            "Rate limited, retrying after delay",
          );

          await this.sleep(retryAfter * 1000);

          attempt++;
          
          continue;
        }

        return result;
      } catch (error) {
        this.logger.error(
          { error, attempt: attempt + 1 },
          "setWebhook request failed",
        );

        if (attempt === maxRetries - 1) {
          return null;
        }

        attempt++;

        await this.sleep(1000 * attempt); // Exponential backoff
      }
    }

    return null;
  }

  private detectWebhookChange(apiResult: SetWebhookBody): boolean {
    if (!apiResult?.ok) {
      return false;
    }

    const description = apiResult.description?.toLowerCase() || "";

    // "Webhook is already set" = no change
    if (description.includes("already set")) {
      return false;
    }

    // "Webhook was set" = change occurred
    if (description.includes("was set")) {
      return true;
    }

    // Default to true for safety if we can't determine
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
