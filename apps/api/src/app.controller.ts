import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  // Render free tier sleeps after 15 min idle; the home page pings this in the
  // background to wake the service up before a player opens the online mode.
  @Get("health")
  health() {
    return { status: "ok" };
  }
}
