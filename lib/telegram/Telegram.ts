import type { Logger } from "pino";
import axios, { type AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import type { HookStateRepository } from "../repositories";

export type WebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date: number;
  last_error_message: string;
  max_connections: number;
  allowed_updates?: string[];
  ip_address: string;
};

export type GetWebhookInfoResponse = {
  ok: boolean;
  result: WebhookInfo;
};

export type DeleteWebhookParams = {
  botId: string;
  botToken: string;
};

export type SetWebhookParams = {
  botId: string;
  botToken: string;
  url: string;
  allowedUpdates: string[];
  secretToken: string;
};

export type SetWebhookResponse = {
  ok: boolean;
  result: boolean;
  description: string;
  error_code?: number; // 429 - rate limiter
  parameters?: { retry_after?: number };
};

export type DeleteWebhookResponse = {
  ok: boolean;
  result: boolean;
  description: string;
};

export class Telegram {
  private readonly baseUrl: string;
  private readonly hookStateRepository: HookStateRepository;
  private readonly axios: AxiosInstance;
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
    this.axios = axios.create({ baseURL: this.baseUrl });

    axiosRetry(this.axios, { retries: 3 });
  }

  public async setWebhook(params: SetWebhookParams) {
    await this.axios.post<SetWebhookParams, SetWebhookResponse>(
      `/bot${params.botToken}/setWebhook`,
      {
        url: params.url,
        allowed_updates: params.allowedUpdates,
        secret_token: params.secretToken,
      },
    );

    await this.hookStateRepository.upsert({
      botId: params.botId,
      botToken: params.botToken,
      url: params.url,
      secretToken: params.secretToken,
      allowedUpdates: params.allowedUpdates,
    });
  }

  public async getWebhookInfo(botToken: string) {
    const { data } = await this.axios.get<GetWebhookInfoResponse>(
      `/bot${botToken}/getWebhookInfo`,
    );

    return data;
  }

  private async deleteWebhook(params: DeleteWebhookParams) {
    await this.axios.post<DeleteWebhookResponse>(
      `/bot${params.botToken}/deleteWebhook`,
    );

    await this.hookStateRepository.delete({ botId: params.botId });
  }
}
