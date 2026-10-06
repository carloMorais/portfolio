import { DEMO_USER, ddmmyyyy, seed } from "./host";
import { createServer, emptyDb, purchaseList, type Db, type Mail } from "./server";

const TODAY = new Date(2026, 9, 5);

function setup(db: Db = emptyDb()) {
  let n = 0;
  const mails: Mail[] = [];
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const server = createServer({
    uuid,
    code: () => "CODE42",
    today: () => TODAY,
    onMail: (m) => mails.push(m),
  });
  const call = (method: string, path: string, body?: unknown) =>
    server.handle(db, method, path, body);
  return { db, call, mails, uuid };
}

const login = (call: ReturnType<typeof setup>["call"]) =>
  call("POST", "/login", { email: DEMO_USER.email, password: DEMO_USER.password });

describe("the simulated Food Point server", () => {
  it("signs up, logs in and answers who is logged in, like the 2024 API", () => {
    const { call } = setup();
    expect(call("GET", "/user")).toEqual({ status: 401, body: { error: "Token Ausente" } });
    expect(
      call("POST", "/user", { fullname: "Ana Souza", email: "ana@x.com", password: "senha1234" }),
    ).toEqual({ status: 201, body: { message: "Usuário cadastrado com sucesso" } });
    expect(
      call("POST", "/user", { fullname: "Ana", email: "ana@x.com", password: "senha1234" }),
    ).toEqual({ status: 400, body: { error: "Email e/ou Senha inválido" } });
    expect(call("POST", "/login", { email: "ana@x.com", password: "errada123" }).status).toBe(401);
    expect(call("POST", "/login", { email: "ana@x.com", password: "senha1234" })).toEqual({
      status: 200,
      body: { success: true },
    });
    expect(call("GET", "/user")).toEqual({
      status: 200,
      body: { fullname: "Ana Souza", email: "ana@x.com" },
    });
    call("POST", "/logout");
    expect(call("GET", "/user").status).toBe(401);
  });

  it("validates bodies with the messages of the Joi schemas", () => {
    const { call } = setup();
    expect(call("POST", "/user", { fullname: "Ana 2", email: "a@x.com", password: "x" })).toEqual({
      status: 400,
      body: { error: "O nome completo deve conter apenas letras" },
    });
    expect(call("POST", "/login", { email: "a@x.com", password: "curta" })).toEqual({
      status: 400,
      body: { error: "A senha deve posssuir 8 caracteres" },
    });
    expect(call("POST", "/login", { email: "a@x.com", password: "senha1234", extra: 1 })).toEqual({
      status: 400,
      body: { error: '"extra" is not allowed' },
    });
  });

  it("creates an event step by step, as the create-event flow does", () => {
    const { call } = setup(seed(TODAY, () => crypto.randomUUID()));
    login(call);
    const created = call("POST", "/event");
    expect(created.status).toBe(201);
    const id = (created.body as { event_id: string }).event_id;

    const date = new Date(TODAY);
    date.setDate(date.getDate() + 3);
    expect(
      call("PUT", `/event/${id}/basic-infos`, {
        name: "Churrasco",
        theme: "",
        eventDescription: "",
        eventDate: ddmmyyyy(date),
        eventTime: "12:00",
      }),
    ).toEqual({
      status: 200,
      body: {
        basicInfos: {
          eventName: "Churrasco",
          eventTheme: null,
          eventDescription: null,
          eventDate: ddmmyyyy(date),
          eventTime: "12:00",
        },
      },
    });
    // The 2024 repository returns the location under `eventTime`.
    expect(call("PUT", `/event/${id}/location`, { location: "-23.1,-45.8" }).body).toEqual({
      basicInfos: expect.objectContaining({ eventTime: "-23.1,-45.8" }),
    });
    const dish = call("POST", `/event/${id}/dish`, {
      dishName: "Picanha",
      type: "Principal",
      ingredients: [{ name: "Picanha", unityMeasure: "Gramas (g)", quantity: 1200 }],
    });
    expect(dish.status).toBe(201);
    expect(call("GET", `/event/${id}`).body).toEqual({
      eventInfos: {
        basicInfos: expect.objectContaining({
          eventName: "Churrasco",
          eventLocation: "-23.1,-45.8",
        }),
        dishes: [
          {
            dishId: (dish.body as { dishId: string }).dishId,
            type: "Principal",
            dishName: "Picanha",
          },
        ],
      },
    });
    expect(call("GET", "/event").body).toEqual({
      events: [
        expect.objectContaining({ event_name: "Noite italiana" }),
        expect.objectContaining({ event_id: id }),
      ],
    });
  });

  it("refuses past dates and other users' events", () => {
    const { call } = setup(seed(TODAY, () => crypto.randomUUID()));
    login(call);
    const id = (call("POST", "/event").body as { event_id: string }).event_id;
    expect(call("PUT", `/event/${id}/basic-infos`, { eventDate: "01/01/2020" })).toEqual({
      status: 400,
      body: { error: "Data inválida ou fora do formato dd/mm/yyyy" },
    });
    expect(call("GET", "/event/not-a-uuid")).toEqual({
      status: 400,
      body: { error: "ID do evento inválido" },
    });
    expect(call("GET", `/event/${crypto.randomUUID()}`)).toEqual({
      status: 404,
      body: { error: "Evento não encontrado" },
    });
  });

  it("adds guests and sums the shopping list across dishes", () => {
    const db = seed(TODAY, () => crypto.randomUUID());
    const { call } = setup(db);
    login(call);
    const id = db.events[0].event_id;
    const added = call("POST", `/guest/${id}`, { name: "Diego" });
    expect(added.status).toBe(201);
    expect((call("GET", `/guest/${id}`).body as unknown[]).length).toBe(4);
    // A digit breaks the database CHECK: the controller answers 500.
    expect(call("POST", `/guest/${id}`, { name: "Diego 2" }).status).toBe(500);

    const { list } = call("GET", `/event/${id}/purchase-list`).body as {
      list: { name: string; total_quantity: number }[];
    };
    expect(list.find((i) => i.name === "Tomate")?.total_quantity).toBe(12);
    expect(list.find((i) => i.name === "Azeite")?.total_quantity).toBe(80);
  });

  it("converts grams and kilograms only for the units the service names", () => {
    const row = (name: string, unity_measure: string, quantity: number) => ({
      id: name + unity_measure,
      event_id: "e",
      dish_id: "d",
      name,
      unity_measure,
      quantity,
      purchased: false,
    });
    expect(
      purchaseList([row("Farinha", "quilograma (kg)", 1), row("Farinha", "gramas (g)", 500)]),
    ).toEqual([
      { name: "Farinha", total_quantity: 1.5, unity_measure: "quilograma (kg)", purchased: false },
    ]);
  });

  it("shows the reset code instead of e-mailing it, and the code changes the password", () => {
    const { call, mails } = setup(seed(TODAY, () => crypto.randomUUID()));
    expect(call("POST", "/recover-pass", { email: "ninguem@x.com" })).toEqual({
      status: 400,
      body: { error: "Email inválido" },
    });
    expect(call("POST", "/recover-pass", { email: DEMO_USER.email }).status).toBe(200);
    expect(mails).toEqual([{ to: DEMO_USER.email, code: "CODE42" }]);
    expect(call("PUT", "/recover-pass", { token: "nope", password: "nova12345" }).status).toBe(401);
    expect(call("PUT", "/recover-pass", { token: "CODE42", password: "nova12345" }).status).toBe(
      200,
    );
    expect(call("POST", "/login", { email: DEMO_USER.email, password: "nova12345" }).status).toBe(
      200,
    );
  });

  it("answers unknown routes with Express's own 404", () => {
    const { call } = setup(seed(TODAY, () => crypto.randomUUID()));
    login(call);
    expect(call("GET", "/nothing")).toEqual({ status: 404, body: "Cannot GET /api/nothing" });
  });
});
