import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module";

// Local dev stays in the 17xxx range (see CLAUDE.md); Render injects its own PORT in production.
const DEV_PORT = 17100;

const isProduction = process.env.NODE_ENV === "production";

// The web app's own production URL plus its Vercel preview URLs; local dev ports are
// only added outside production, so a production deploy never trusts a localhost origin
// (Render must set NODE_ENV=production for this to take effect — see CLAUDE.md).
const DEFAULT_ALLOWED_ORIGINS = [
  "https://portfolio-carlomorais.vercel.app",
  ...(isProduction ? [] : ["http://localhost:17000", "http://localhost:17001"]),
];

async function bootstrap() {
  // Passed explicitly (rather than left for Nest to auto-detect) because npm's
  // workspace hoisting can nest @nestjs/platform-express under apps/api/node_modules
  // while @nestjs/core sits at the repo root; a bare dynamic require from core's own
  // location would then miss it. An import from our own file always finds it.
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  app.useWebSocketAdapter(new WsAdapter(app));

  const extraOrigins = process.env.WEB_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [
      ...DEFAULT_ALLOWED_ORIGINS,
      ...(extraOrigins ?? []),
      // Vercel preview deployments, one per push to `release`.
      /^https:\/\/portfolio-[a-z0-9-]+\.vercel\.app$/,
    ],
  });

  const port = process.env.PORT ? Number(process.env.PORT) : DEV_PORT;
  await app.listen(port);
}

bootstrap();
