import fastify, { type FastifyInstance } from "fastify";

export const createDummyTelegramApiServer = () => {
  const apiServer = fastify();
  const webhookInfoMap = new Map<string, any>();

  // Replicate the Telegram API server

  apiServer.post<{
    Body: { url: string; secret_token: string; allowed_updates: string[] };
    Params: { botPrefix: string };
  }>(
    "/:botPrefix/setWebhook",
    ({
      body: { url, secret_token, allowed_updates },
      params: { botPrefix },
    }) => {
      console.log("setWebhook", botPrefix, url);

      webhookInfoMap.set(botPrefix, {
        url,
        has_custom_certificate: false,
        pending_update_count: 0,
        last_error_date: null,
        last_error_message: null,
        max_connections: 40,
        allowed_updates,

        secret_token,
      });

      return true;
    },
  );

  apiServer.post<{
    Params: { botPrefix: string };
  }>("/:botPrefix/deleteWebhook", ({ params: { botPrefix } }) => {
    webhookInfoMap.delete(botPrefix);

    return true;
  });

  apiServer.get<{ Params: { botPrefix: string } }>(
    "/:botPrefix/getWebhookInfo",
    ({ params: { botPrefix } }, reply) => {
      const webhookInfo = webhookInfoMap.get(botPrefix);

      console.log("getWebhookInfo", botPrefix, webhookInfo);

      if (!webhookInfo) {
        return reply.code(404).send("Not found");
      }

      return webhookInfo;
    },
  );

  // Management handles

  apiServer.post<{ Body: { botId: string; data: any } }>(
    "/sendMessage",
    ({ body: { botId, data } }, reply) => {
      const webhookInfo = webhookInfoMap.get(`bot${botId}`);

      console.log("sendMessage", botId, webhookInfo, { webhookInfoMap });

      if (!webhookInfo) {
        return reply.code(404).send("Not found");
      }

      fetch(webhookInfo.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      return true;
    },
  );

  return apiServer;
};
