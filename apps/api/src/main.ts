import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module";
import { allowedOrigins } from "./origins";

// Local dev stays in the 17xxx range (see CLAUDE.md); Render injects its own PORT in production.
const DEV_PORT = 17100;

async function bootstrap() {
  // Passed explicitly (rather than left for Nest to auto-detect) because npm's
  // workspace hoisting can nest @nestjs/platform-express under apps/api/node_modules
  // while @nestjs/core sits at the repo root; a bare dynamic require from core's own
  // location would then miss it. An import from our own file always finds it.
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  app.useWebSocketAdapter(new WsAdapter(app));

  // The same list the WebSocket gateway checks (see origins.ts).
  app.enableCors({ origin: allowedOrigins() });

  const port = process.env.PORT ? Number(process.env.PORT) : DEV_PORT;
  await app.listen(port);
}

bootstrap();
