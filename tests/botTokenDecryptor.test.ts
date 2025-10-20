import { afterEach, beforeEach, describe, it } from "node:test";
import { ok, strictEqual, notStrictEqual } from "node:assert";
import { createCipheriv, createDecipheriv } from "crypto";
import { BotTokenDecryptor } from "../lib/service/BotTokenDecryptor";
import type { Logger } from "pino";

// Mock logger - simplified approach
const mockLogger = {
  error: () => {},
  info: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => mockLogger,
  level: "info",
  silent: () => {},
} as unknown as Logger;

describe("BotTokenDecryptor", () => {
  let decryptor: BotTokenDecryptor;
  const testSecret = "test-encryption-secret-32-bytes!";

  beforeEach(() => {
    // Create new decryptor instance with test secret
    decryptor = new BotTokenDecryptor(testSecret, mockLogger);
  });

  describe("decryptBotToken", () => {
    it("should successfully decrypt a valid encrypted token", async () => {
      const botId = "test-bot-123";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Encrypt the token using the same method
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      const result = await decryptor.decryptBotToken(botId, encrypted);
      
      ok(result !== null, "Decryption should succeed");
      strictEqual(result, originalToken, "Decrypted token should match original");
    });

    it("should handle botId shorter than 12 bytes", async () => {
      const botId = "short";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Encrypt the token
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      const result = await decryptor.decryptBotToken(botId, encrypted);
      
      ok(result !== null, "Decryption should succeed");
      strictEqual(result, originalToken, "Decrypted token should match original");
    });

    it("should handle botId longer than 12 bytes (truncated)", async () => {
      const botId = "very-long-bot-id-that-exceeds-twelve-bytes";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Encrypt the token
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      const result = await decryptor.decryptBotToken(botId, encrypted);
      
      ok(result !== null, "Decryption should succeed");
      strictEqual(result, originalToken, "Decrypted token should match original");
    });

    it("should handle botId exactly 12 bytes", async () => {
      const botId = "exactly12by";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Encrypt the token
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      const result = await decryptor.decryptBotToken(botId, encrypted);
      
      ok(result !== null, "Decryption should succeed");
      strictEqual(result, originalToken, "Decrypted token should match original");
    });

    it("should return null for invalid encrypted token", async () => {
      const botId = "test-bot-123";
      const invalidEncrypted = "invalid-encrypted-data";

      const result = await decryptor.decryptBotToken(botId, invalidEncrypted);
      
      strictEqual(result, null, "Should return null for invalid encrypted data");
    });

    it("should return null for empty encrypted token", async () => {
      const botId = "test-bot-123";
      const emptyEncrypted = "";

      const result = await decryptor.decryptBotToken(botId, emptyEncrypted);
      
      strictEqual(result, null, "Should return null for empty encrypted data");
    });

    it("should return null for malformed encrypted token", async () => {
      const botId = "test-bot-123";
      const malformedEncrypted = "not-base64-encoded-data-with-special-chars!@#$%";

      const result = await decryptor.decryptBotToken(botId, malformedEncrypted);
      
      strictEqual(result, null, "Should return null for malformed encrypted data");
    });

    it("should handle different bot IDs with same encrypted token", async () => {
      const botId1 = "bot-1";
      const botId2 = "bot-2";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Encrypt with botId1
      const botIdBuf1 = Buffer.from(botId1, "utf-8");
      const iv1 = Buffer.alloc(16);
      botIdBuf1.copy(iv1, 0, 0, Math.min(botIdBuf1.length, 16));
      
      const cipher1 = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv1);
      let encrypted1 = cipher1.update(originalToken, "utf-8", "base64");
      encrypted1 += cipher1.final("base64");

      // Try to decrypt with different botId2
      const result = await decryptor.decryptBotToken(botId2, encrypted1);
      
      // Should return a different result (not null, but different from original)
      ok(result !== null, "Should not return null");
      notStrictEqual(result, originalToken, "Should return different result when botId doesn't match encryption");
    });

    it("should handle unicode characters in botId", async () => {
      const botId = "бот-тест-123";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Encrypt the token
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      const result = await decryptor.decryptBotToken(botId, encrypted);
      
      ok(result !== null, "Decryption should succeed with unicode botId");
      strictEqual(result, originalToken, "Decrypted token should match original");
    });

    it("should handle special characters in token", async () => {
      const botId = "test-bot";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{}|;':\",./<>?";
      
      // Encrypt the token
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      const result = await decryptor.decryptBotToken(botId, encrypted);
      
      ok(result !== null, "Decryption should succeed with special characters");
      strictEqual(result, originalToken, "Decrypted token should match original");
    });

    it("should handle very long tokens", async () => {
      const botId = "test-bot";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(10);
      
      // Encrypt the token
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      const result = await decryptor.decryptBotToken(botId, encrypted);
      
      ok(result !== null, "Decryption should succeed with long tokens");
      strictEqual(result, originalToken, "Decrypted token should match original");
    });

    it("should handle empty botId", async () => {
      const botId = "";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Encrypt the token
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      const result = await decryptor.decryptBotToken(botId, encrypted);
      
      ok(result !== null, "Decryption should succeed with empty botId");
      strictEqual(result, originalToken, "Decrypted token should match original");
    });

    it("should verify IV is exactly 16 bytes", async () => {
      const botId = "test";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Manually create IV to verify it's 16 bytes
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      strictEqual(iv.length, 16, "IV should be exactly 16 bytes");
      
      // Verify padding with zeros
      const expectedPadding = Buffer.alloc(16 - botIdBuf.length, 0);
      const actualPadding = iv.slice(botIdBuf.length);
      ok(actualPadding.equals(expectedPadding), "Remaining bytes should be zeros");
    });

    it("should handle concurrent decryption requests", async () => {
      const botId = "concurrent-test";
      const originalToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      // Encrypt the token
      const botIdBuf = Buffer.from(botId, "utf-8");
      const iv = Buffer.alloc(16);
      botIdBuf.copy(iv, 0, 0, Math.min(botIdBuf.length, 16));
      
      const cipher = createCipheriv("aes-256-cbc", Buffer.from(testSecret, "utf-8"), iv);
      let encrypted = cipher.update(originalToken, "utf-8", "base64");
      encrypted += cipher.final("base64");

      // Run multiple concurrent decryptions
      const promises = Array.from({ length: 10 }, () => 
        decryptor.decryptBotToken(botId, encrypted)
      );

      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach((result, index) => {
        ok(result !== null, `Concurrent decryption ${index} should succeed`);
        strictEqual(result, originalToken, `Concurrent decryption ${index} should match original`);
      });
    });
  });
});
