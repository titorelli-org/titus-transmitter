// import { afterEach, beforeEach, describe, it } from "node:test";
// import { ok } from "node:assert";
// import { io } from "socket.io-client";
// import {
//   createDummyTelegramApiServer,
//   type DummyTelegramApiServer,
// } from "./mocks/DummyTelegramApiServer";
// import { main } from "..";
// import type { TitusTransmitter } from "../lib/service";
// import { TestsCounter } from "./harness/TestsCounter";
// import whyIsNodeRunning from "why-is-node-running";

// const abortController = new AbortController();
// const testsCounter = new TestsCounter(() => {
//   console.log("All tests completed");

//   // abortController.abort();

//   whyIsNodeRunning();
// });

// describe("sockets", { signal: abortController.signal }, async () => {
//   let service: TitusTransmitter;
//   let dummyTelegramApiServer: DummyTelegramApiServer;

//   testsCounter.setup();

//   beforeEach(async () => {
//     service = await main({
//       mongoUrl: "mongodb://admin:admin@localhost:27017/",
//       telegramBaseUrl: "http://localhost:3001",
//     });

//     await service.start();

//     await new Promise((resolve) => setTimeout(resolve, 1000));
//   });

//   beforeEach(async () => {
//     dummyTelegramApiServer = createDummyTelegramApiServer();

//     await dummyTelegramApiServer.listen({ port: 3001 });

//     await new Promise((resolve) => setTimeout(resolve, 1000));
//   });

//   afterEach(async () => {
//     await service.stop();

//     await dummyTelegramApiServer.close();
//   });

//   await it("should connect and disconnect to/from the service", async () => {
//     const conn = io("ws://localhost:3000", {
//       auth: {
//         botId: "--test-bot-id--",
//         accessToken: "--test-access-token--",
//         botTokenEncrypted: "--test-bot-token-encrypted--",
//       },
//     });

//     ok(conn, "Connection not defined");

//     conn.on("connect", () => {
//       ok(conn.connected, "Connection not connected");
//     });

//     conn.on("disconnect", () => {
//       ok(conn.disconnected, "Connection not disconnected");
//     });

//     await new Promise((resolve) => setTimeout(resolve, 1000));

//     conn.disconnect();

//     ok(conn.disconnected, "Connection not disconnected");
//   });

//   await it("should receive messages", async () => {
//     const conn = io("ws://localhost:3000", {
//       auth: {
//         botId: "--test-bot-id--",
//         accessToken: "--test-access-token--",
//         botTokenEncrypted: "--test-bot-token-encrypted--",
//       },
//     });

//     conn.on("update", (update) => {
//       console.log("[Client] Update received:", update);
//     });

//     await new Promise((resolve) => setTimeout(resolve, 3000));

//     {
//       const resp = await fetch("http://localhost:3001/sendMessage", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           botId: "--test-bot-token--",
//           data: {
//             message: "Hello, world!",
//           },
//         }),
//       });

//       console.log("resp.status", resp.status);
//     }

//     conn.disconnect();
//   });
// });

// // describe("replaying", async () => {
// //   await it("should replay messages", async () => {
// //     const { MongoClient } = await import("mongodb");

// //     const service = await main({
// //       telegramBaseUrl: "http://localhost:3001",
// //     });

// //     await service.start();

// //     const dummyTelegramApiServer = createDummyTelegramApiServer();

// //     await dummyTelegramApiServer.listen({ port: 3001 });

// //     const mongoClient = await MongoClient.connect(
// //       "mongodb://xha9-sb2c-iaws.sw-1a.dockhost.net:46182/",
// //       {
// //         directConnection: true,
// //         auth: {
// //           username: "titorelli",
// //           password: "bT6MMpzVP93J",
// //         },
// //       },
// //     );

// //     const updatesCursor = mongoClient
// //       .db("titorelli")
// //       .collection("updates")
// //       .find();

// //     for await (const update of updatesCursor) {
// //       await new Promise((resolve) => setTimeout(resolve, 500));

// //       const { status } = await fetch("http://localhost:3001/sendMessage", {
// //         method: "POST",
// //         headers: {
// //           "Content-Type": "application/json",
// //         },
// //         body: JSON.stringify({
// //           // botId: "--test-bot-token--",
// //           botId: '7182412043:AAFzzLWTMQHvmJ0aLLjcVT_m7yvMUoW0gzI',
// //           data: update,
// //         }),
// //       });

// //       console.log("status", status);
// //     }

// //     await service.stop();
// //   });
// // });
