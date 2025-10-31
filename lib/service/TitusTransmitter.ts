import fastify, { type FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { Socket, Server as SocketIOServer } from "socket.io";
import type { Update } from "@grammyjs/types";
import { BotTokenDecryptor } from "./BotTokenDecryptor";
import type {
  BotStateRepository,
  HookStateRepository,
  UpdateRepository,
} from "../repositories";
import { Telegram } from "../telegram";
import { env } from "../env";
import { HookStatePoller } from "./HookStatePoller";

export type TitusTransmitterConfig = {
  port: number;
  host: string;
  botStateRepository: BotStateRepository;
  hookStateRepository: HookStateRepository;
  updateRepository: UpdateRepository;
  telegram?: {
    baseUrl?: string;
  };
  onClose?: () => void;
  logger: Logger;
};

export class TitusTransmitter {
  private readonly port: number;
  private readonly host: string;
  private readonly fastify: FastifyInstance;
  private readonly io: SocketIOServer;
  private readonly telegram: Telegram;
  private readonly botStateRepository: BotStateRepository;
  private readonly hookStateRepository: HookStateRepository;
  private readonly updateRepository: UpdateRepository;
  private readonly transmitterOrigin = env.TRANSMITTER_ORIGIN;
  private readonly botTokenDecryptor: BotTokenDecryptor;
  private readonly hookStatePoller: HookStatePoller;
  private readonly onClose?: () => void;
  private readonly logger: Logger;

  constructor({
    port,
    host,
    botStateRepository,
    hookStateRepository,
    updateRepository,
    telegram: telegramConfig,
    onClose,
    logger,
  }: TitusTransmitterConfig) {
    this.port = port;
    this.host = host;
    this.botStateRepository = botStateRepository;
    this.hookStateRepository = hookStateRepository;
    this.updateRepository = updateRepository;
    this.telegram = new Telegram({
      baseUrl: telegramConfig?.baseUrl,
      hookStateRepository,
      logger,
    });
    this.logger = logger;
    this.onClose = onClose;
    this.hookStatePoller = new HookStatePoller({
      hookStateRepository: this.hookStateRepository,
      telegram: this.telegram,
      logger: this.logger,
    });
    this.botTokenDecryptor = new BotTokenDecryptor(
      env.TOKEN_ENCRYPTION_SECRET,
      this.logger,
    );
    // @ts-expect-error 2322
    this.fastify = fastify({
      loggerInstance: this.logger,
      trustProxy: true,
    });
    this.io = new SocketIOServer(this.fastify.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
  }

  async start() {
    await this.fastify.listen(
      { port: this.port, host: this.host },
      (err, address) => {
        if (err) {
          this.logger.error(err);
        }

        this.logger.info(`Server is running on ${address}`);
      },
    );

    await this.hookStatePoller.start();

    this.installUpdatesHandlers();
    this.installSocketHandlers();
  }

  async stop() {
    await this.io.close();
    await this.fastify.close();
    await this.hookStatePoller.stop();
    await this.onClose?.();
  }

  private installUpdatesHandlers() {
    this.fastify.post<{ Body: Update; Params: { botId: string } }>(
      "/updates/:botId",
      async ({ params: { botId }, body: update, headers }) => {
        const secretToken = String(headers["x-secret-token"]);

        const secretTokenValid = await this.validateSecretToken(
          botId,
          secretToken,
        );

        if (!secretTokenValid) {
          throw new Error("Invalid secret token");
        }

        console.log("[Server] Update received", update);

        this.io.to(`/updates/${botId}`).emit("update", update);

        await this.updateRepository.insert(update);

        return true;
      },
    );
  }

  private installSocketHandlers() {
    this.io.on("connection", this.onSocketConnection);

    this.io.on("disconnect", (socket) => {
      console.log("[Server] Socket disconnected");
    });

    this.io.on("error", (error) => {
      console.log("[Server] Socket error", error);
    });

    this.io.on("message", (message) => {
      console.log("[Server] Socket message", message);
    });
  }

  private onSocketConnection = async (socket: Socket) => {
    const { botId, accessToken, botTokenEncrypted } = socket.handshake.auth;

    const tokenValid = await this.validateAccessToken(botId, accessToken);

    if (!tokenValid) {
      socket.disconnect(true);

      return;
    }

    socket.join(`/updates/${botId}`);

    const botToken = await this.decryptBotToken(botId, botTokenEncrypted);

    if (!botToken) {
      socket.disconnect(true);
      return;
    }

    await this.ensureWebhook(botId, botToken);
  };

  private async validateAccessToken(botId: string, accessToken: string) {
    // TODO: validate access token

    return true;
  }

  private async validateSecretToken(botId: string, secretToken: string) {
    return true;
  }

  private async ensureWebhook(botId: string, botToken: string) {
    const url = `${this.transmitterOrigin}/updates/${botId}`;

    await this.telegram.setWebhook({
      botId,
      botToken,
      url,
      secretToken: await this.getSecretTokenForBot(botId),
      allowedUpdates: [
        "message",
        "edited_message",
        "channel_post",
        "edited_channel_post",
        "message_reaction",
        "message_reaction_count",
        "inline_query",
        "chosen_inline_result",
        "callback_query",
        "shipping_query",
        "pre_checkout_query",
        "poll",
        "poll_answer",
        "my_chat_member",
        "chat_member",
        "chat_join_request",
        "chat_boost",
        "removed_chat_boost",
      ],
    });
  }

  private async getSecretTokenForBot(botId: string) {
    // TODO: return dummy for now

    return `--bot-secret-token-${botId}--`;
  }

  private async decryptBotToken(botId: string, botTokenEncrypted: string) {
    return botTokenEncrypted;

    // return this.botTokenDecryptor.decryptBotToken(botId, botTokenEncrypted);
  }
}
