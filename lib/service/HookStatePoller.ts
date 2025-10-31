import { makePoller, type Poller, type Unsubscribe } from "reactive-poller";
import { type Logger } from "pino";
import type { Telegram, WebhookInfo } from "../telegram";
import { HookState, type HookStateRepository } from "../repositories";
import { SWRCache } from "../cache";

export class HookStatePoller {
  private readonly hookStateRepository: HookStateRepository;
  private readonly poller: Poller<[HookState, WebhookInfo][]>;
  private readonly telegram: Telegram;
  private state: "initial" | "starting" | "running" | "stopping" | "stopped" =
    "initial";
  private $unsubscribe?: Unsubscribe;
  private readonly logger: Logger;

  constructor({
    hookStateRepository,
    telegram,
    logger,
  }: {
    hookStateRepository: HookStateRepository;
    telegram: Telegram;
    logger: Logger;
  }) {
    this.hookStateRepository = hookStateRepository;
    this.telegram = telegram;
    this.logger = logger;
    this.poller = makePoller<[HookState, WebhookInfo][]>({
      dataProvider: this.fetchData,
      errorHandler: (error) => this.logger.error(error),
      interval: 4_000,
    });
  }

  public async start() {
    if (this.isRunning || this.isStarting) {
      return;
    }

    this.state = "starting";

    this.$unsubscribe = this.poller.onData$.subscribe(this.onData);

    await this.poller.start();

    this.state = "running";
  }

  public async stop() {
    if (this.isStopped || this.isStopping) {
      return;
    }

    this.state = "stopping";

    this.$unsubscribe?.();

    this.$unsubscribe = undefined;

    await this.poller.stop();

    this.state = "stopped";
  }

  private get isRunning() {
    return this.state === "running";
  }

  private get isStarting() {
    return this.state === "starting";
  }

  private get isStopping() {
    return this.state === "stopping";
  }

  private get isStopped() {
    return this.state === "stopped";
  }

  private getAllHooks = SWRCache.wrapFn(async () =>
    this.hookStateRepository.findAll(),
  );

  private fetchData = async () => {
    const webhookInfoPairs: [HookState, WebhookInfo][] = [];

    for (const hookState of await this.getAllHooks()) {
      const { result } = await this.telegram.getWebhookInfo(hookState.botToken);

      webhookInfoPairs.push([hookState, result]);
    }

    return webhookInfoPairs;
  };

  private onData = async (webhookInfoPairs: [HookState, WebhookInfo][]) => {
    for (const [hookState, webhookInfo] of webhookInfoPairs) {
      await this.hookStateRepository.update({
        botId: hookState.botId,
        url: webhookInfo.url,
        hasCustomCertificate: webhookInfo.has_custom_certificate,
        pendingUpdateCount: webhookInfo.pending_update_count,
        maxConnections: webhookInfo.max_connections,
        ipAddress: webhookInfo.ip_address,
        allowedUpdates: webhookInfo.allowed_updates ?? [],
      });
    }
  };
}
