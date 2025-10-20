import type { Logger } from "pino";

export class BotTokenDecryptor {
  private readonly tokenEncryptionSecret: Buffer;

  constructor(
    tokenEncryptionSecret: string,
    private readonly logger: Logger,
  ) {
    this.tokenEncryptionSecret = Buffer.from(tokenEncryptionSecret, "utf-8");
  }

  public async decryptBotToken(botId: string, botTokenEncrypted: string) {
    try {
      const { createDecipheriv } = await import("crypto");

      const botIdBuf = Buffer.from(botId, "utf-8");
      const botTokenEncryptedBuf = Buffer.from(botTokenEncrypted, "base64");
      const iv = Buffer.alloc(16);

      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));

      const decipher = createDecipheriv(
        "aes-256-cbc",
        this.tokenEncryptionSecret,
        iv,
      );

      let decrypted = decipher.update(botTokenEncryptedBuf, undefined, "utf-8");
      decrypted += decipher.final("utf-8");

      return decrypted;
    } catch (error) {
      this.logger.error(error, "Failed to decrypt bot token");

      return null;
    }
  }
}
