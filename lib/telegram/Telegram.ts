export type WebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date: number;
  last_error_message: string;
  max_connections: number;
  allowed_updates: string[];
};

export class Telegram {
  constructor(private readonly baseUrl = "https://api.telegram.org") {}

  public async setWebhook(
    botToken: string,
    {
      url,
      allowedUpdates,
      secretToken,
    }: {
      url: string;
      allowedUpdates?: string[];
      secretToken?: string;
    },
  ) {
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
  }

  public async getWebhookInfo(botToken: string) {
    const resp = await fetch(`${this.baseUrl}/bot${botToken}/getWebhookInfo`);

    return {
      status: resp.status,
      webhookInfo:
        resp.status === 200
          ? ((await resp.json()) as Awaited<WebhookInfo>)
          : null,
    };
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
