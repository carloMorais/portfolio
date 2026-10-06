/**
 * The Food Point backend of 2024 (Express + PostgreSQL), rebuilt as a
 * function that runs in the browser, so the original frontend can run on
 * this site with no server. It answers the same routes, in the same order
 * as the Express middlewares, with the same status codes, validation
 * messages and JSON shapes, quirks included (see `updateLocation`). The
 * session cookie becomes `db.session`; the tables become arrays.
 *
 * Sources: src/routes, src/controllers, src/middlewares, src/schemas,
 * src/repositories, src/services/purchaseList.js and src/dump.sql of
 * github.com/carloMorais/food-point.
 */

export type User = { id: string; fullname: string; email: string; password: string };
export type EventRow = {
  event_id: string;
  user_id: string;
  event_name: string | null;
  theme: string | null;
  event_description: string | null;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
};
export type Dish = { id: string; event_id: string; dish_name: string; type: string };
export type Ingredient = {
  id: string;
  event_id: string;
  dish_id: string;
  name: string;
  unity_measure: string;
  quantity: number;
  purchased: boolean | null;
};
export type Guest = { id: string; event_id: string; name: string; confirmed: boolean };
export type Upload = { id: string; user_id: string; hash_name: string; image: string };

export type Db = {
  users: User[];
  events: EventRow[];
  dishes: Dish[];
  ingredients: Ingredient[];
  guests: Guest[];
  uploads: Upload[];
  /** The `session_token` cookie: who is logged in. */
  session: string | null;
  /** Password reset codes that were "e-mailed", by code. */
  resetCodes: Record<string, string>;
};

/** What the original body would have been: parsed JSON, or the uploaded file. */
export type Body = unknown;

export type Reply = { status: number; body: unknown };

/** What the server would have sent by e-mail (the demo shows it instead). */
export type Mail = { to: string; code: string };

export type ServerOptions = {
  uuid: () => string;
  /** The reset code, the 2024 server's 4-hour JWT. */
  code: () => string;
  today: () => Date;
  onMail?: (mail: Mail) => void;
};

/** The upload route gets the image already read as a data URL. */
export type UploadBody = { image: string };

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(typeof body === "object" && body && "error" in body ? String(body.error) : "");
  }
}

const fail = (status: number, error: string): never => {
  throw new HttpError(status, { error });
};

// ---------------------------------------------------------------- validation

/** The regexes of src/schemas and the CHECK constraints of src/dump.sql. */
export const rgx = {
  text: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s"^`~:.,?!-]+$/,
  time: /^(([01]\d|2[0-3]):([0-5]\d))$/,
  date: /^(\d{2})\/(\d{2})\/(\d{4})$/,
  location: /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
  dish: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s'-]+$/,
  unity: /^\b([a-zA-Z]+)\s*\(([a-zA-Z]{1,2})\)$/,
  password: /^[a-zA-Z0-9]+$/,
  fullname: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s']+$/,
  guest: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

/** One field of a Joi object: returns the error message, or null. */
type Rule = (value: unknown, present: boolean) => string | null;

type StringRule = {
  required?: boolean;
  allowEmpty?: boolean;
  pattern?: RegExp;
  min?: number;
  email?: boolean;
  messages: Partial<Record<"base" | "empty" | "required" | "pattern" | "min" | "email", string>>;
};

/** Joi's `string()`, with the custom messages the 2024 schemas set. */
function str(key: string, r: StringRule): Rule {
  return (value, present) => {
    if (!present) return r.required ? (r.messages.required ?? `"${key}" is required`) : null;
    if (typeof value !== "string") return r.messages.base ?? `"${key}" must be a string`;
    if (value === "") {
      return r.allowEmpty ? null : (r.messages.empty ?? `"${key}" is not allowed to be empty`);
    }
    if (r.email && !rgx.email.test(value)) {
      return r.messages.email ?? `"${key}" must be a valid email`;
    }
    if (r.pattern && !r.pattern.test(value)) {
      return (
        r.messages.pattern ?? `"${key}" with value "${value}" fails to match the required pattern`
      );
    }
    if (r.min && value.length < r.min) return r.messages.min ?? `"${key}" too short`;
    return null;
  };
}

/** Joi's `object()`: known keys in order, then any unknown key; first error wins. */
function object(rules: Record<string, Rule>) {
  return (body: unknown): string | null => {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return '"value" must be of type object';
    }
    const record = body as Record<string, unknown>;
    for (const [key, rule] of Object.entries(rules)) {
      const message = rule(record[key], record[key] !== undefined);
      if (message) return message;
    }
    const unknown = Object.keys(record).find((key) => !(key in rules));
    return unknown ? `"${unknown}" is not allowed` : null;
  };
}

/** Express's `validateRequestBody(schema)`: 400 with Joi's message. */
function validate(check: (body: unknown) => string | null, body: unknown) {
  const message = check(body);
  if (message) fail(400, message);
}

const emailMessages = {
  required: "O campo email é obrigatório",
  empty: "O campo email é obrigatório",
  base: "O preenchimento do campo deve ser do tipo string",
  email: "Formato de email inválido",
};
const passwordMessages = (min: string) => ({
  required: "O campo senha é obrigatório",
  empty: "O campo senha é obrigatório",
  base: "O preenchimento do campo deve ser do tipo string",
  pattern: "A senha deve conter pelo menos uma letra, um número e tamanho mínimo de 8.",
  min,
});

const loginSchema = object({
  email: str("email", { required: true, email: true, messages: emailMessages }),
  password: str("password", {
    required: true,
    pattern: rgx.password,
    min: 8,
    messages: passwordMessages("A senha deve posssuir 8 caracteres"),
  }),
});

const userInsertSchema = object({
  fullname: str("fullname", {
    required: true,
    pattern: rgx.fullname,
    messages: {
      required: "O nome completo é obrigatório",
      empty: "O nome completo não pode estar vazio",
      base: "O nome completo deve ser uma string",
      pattern: "O nome completo deve conter apenas letras",
    },
  }),
  email: str("email", { required: true, email: true, messages: emailMessages }),
  password: str("password", {
    required: true,
    pattern: rgx.password,
    min: 8,
    messages: passwordMessages("A senha deve posssuir no mínimo 8 caracteres"),
  }),
});

const userUpdateSchema = object({
  fullname: str("fullname", {
    pattern: rgx.fullname,
    messages: {
      base: "O nome completo deve ser uma string",
      pattern: "O nome completo deve conter apenas letras",
    },
  }),
  email: str("email", { email: true, messages: emailMessages }),
});

const passwordUpdateSchema = object({
  password: str("password", {
    pattern: rgx.password,
    min: 8,
    messages: passwordMessages("A senha deve posssuir 8 caracteres"),
  }),
});

const textRule = (key: string, what: string, base: string) =>
  str(key, {
    allowEmpty: true,
    pattern: rgx.text,
    messages: { base, pattern: `${what} deve conter apenas letras e (^ \` ~ : . , ? ! -)` },
  });

/** The custom date rule: dd/mm/yyyy, not in the past (an unparseable date slips through, as with moment). */
function dateRule(today: () => Date): Rule {
  return (value, present) => {
    if (!present || value === "") return null;
    if (typeof value !== "string") return '"eventDate" must be a string';
    const match = rgx.date.exec(value);
    if (!match) return "Data inválida ou fora do formato dd/mm/yyyy";
    const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day);
    const valid = date.getMonth() === month - 1 && date.getDate() === day;
    const start = new Date(today());
    start.setHours(0, 0, 0, 0);
    return valid && date < start ? "Data inválida ou fora do formato dd/mm/yyyy" : null;
  };
}

const timeRule: Rule = (value, present) => {
  if (!present || value === "") return null;
  if (typeof value !== "string") return '"eventTime" must be a string';
  return rgx.time.test(value) ? null : "O formato do horário deve ser: horas 00:00 minutos";
};

const basicInfosSchema = (today: () => Date) =>
  object({
    name: textRule("name", "O nome", "O nome deve ser uma string"),
    theme: textRule("theme", "O tema", "O tema deve ser uma string"),
    eventDescription: textRule(
      "eventDescription",
      "A descrição",
      "A descrição deve ser uma string",
    ),
    eventDate: dateRule(today),
    eventTime: timeRule,
    eventLocation: str("eventLocation", {
      allowEmpty: true,
      pattern: rgx.location,
      messages: {
        base: "O tipo de dados de localização deve ser uma string",
        pattern: "A localização deve conter apenas letras",
      },
    }),
  });

const locationSchema = object({
  location: str("location", {
    required: true,
    pattern: rgx.location,
    messages: {
      base: "O tipo de dado localização deve ser uma string",
      pattern: "A localização deve conter apenas números, traços e virgulas",
      required: "O campo location é obrigatório",
      empty: "O campo location não pode estar vazio",
    },
  }),
});

const dishNameRule = (key: string) =>
  str(key, {
    required: true,
    pattern: rgx.dish,
    messages: {
      base: "O tipo de dado de nome do prato deve ser uma string",
      pattern: "O nome do prato deve conter apenas letras e hífen",
      required: "O nome do prato é obrigatório",
      empty: "O campo nome não pode estar vazio",
    },
  });

const quantityRule: Rule = (value, present) => {
  if (!present) return "A quantidade é obrigatória";
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "O preenchimento do campo quantidade deve ser do tipo number";
  }
  if (!Number.isInteger(value)) return "O campo quantidade aceita apenas números inteiros";
  if (value <= 0) return "O campo quantidade aceita apenas números positivos";
  return null;
};

const ingredientRules = (article: string) => ({
  name: str("name", {
    required: true,
    pattern: rgx.dish,
    messages: {
      base: `O tipo de dado de nome do ${article} deve ser uma string`,
      pattern: `O nome do ${article} deve conter apenas letras e hífen`,
      required: "O nome do ingrediente é obrigatório",
      empty: "O campo nome do ingrediente não pode estar vazio",
    },
  }),
  unityMeasure: str("unityMeasure", {
    required: true,
    pattern: rgx.unity,
    messages: {
      base: "O tipo de dado de unidade de medida deve ser uma string",
      pattern: "Unidade de medida inválida, ex válido: mililitros (ml)",
      required: "A unidade de medida é obrigatório",
      empty: "O campo de unidade de medida tem que estar definido",
    },
  }),
  quantity: quantityRule,
});

const ingredientSchema = object(ingredientRules("ingrediente"));

/** Joi `array().items(schema)`: each item, in order. */
const items =
  (key: string, check: (item: unknown) => string | null): Rule =>
  (value, present) => {
    if (!present) return null;
    if (!Array.isArray(value)) return `"${key}" must be an array`;
    for (const item of value) {
      const message = check(item);
      if (message) return message;
    }
    return null;
  };

const dishSchema = object({
  dishName: dishNameRule("dishName"),
  type: str("type", {
    required: true,
    pattern: rgx.dish,
    messages: {
      base: "O tipo de dado de nome do prato deve ser uma string",
      pattern: "O nome do prato deve conter apenas letras e hífen",
      required: "O tipo de prato é obrigatório",
      empty: "O campo do tipo de prato não pode estar vazio",
    },
  }),
  ingredients: items("ingredients", object(ingredientRules("ingredinte"))),
});

const dishRenameSchema = object({ dishName: dishNameRule("dishName") });

const purchaseListSchema = object({
  ingredientList: items(
    "ingredientList",
    object({
      name: ingredientRules("ingrediente").name,
      purchased: (value, present) =>
        present && typeof value !== "boolean" ? "purchased deve ser do tipo booleano" : null,
    }),
  ),
});

/** Joi.alternatives(): `{ name }` or `{ name, confirmed }`. */
function guestSchema(body: unknown): string | null {
  const name = str("name", { required: true, messages: {} });
  const confirmed: Rule = (v, present) =>
    !present || typeof v !== "boolean" ? '"confirmed" must be a boolean' : null;
  const ok = object({ name }) as (b: unknown) => string | null;
  const withConfirmed = object({ name, confirmed });
  return ok(body) && withConfirmed(body)
    ? "A requisição deve conter o nome do usuário. ex: 'name: string, confirmed: boolean'."
    : null;
}

// ---------------------------------------------------------------- the lists

const unitTypes = {
  gram: "gramas (g)",
  kilogram: "quilograma (kg)",
  mililiter: "mililitro (ml)",
  liter: "litros (l)",
  unity: "unidade (un)",
};

type ListRow = {
  name: string;
  total_quantity: number;
  unity_measure: string;
  purchased: boolean | null;
};

/**
 * `src/services/purchaseList.js`, line by line (not Carlos's code: it came
 * from a teammate): sums the ingredients of every dish by name, converting
 * between g/kg and ml/l.
 */
export function purchaseList(ingredients: Ingredient[]): ListRow[] {
  // The SQL: SUM(quantity) grouped by name, unit and purchased.
  const rows = new Map<string, ListRow>();
  for (const i of ingredients) {
    const key = JSON.stringify([i.name, i.unity_measure, i.purchased]);
    const row = rows.get(key);
    if (row) row.total_quantity += i.quantity;
    else
      rows.set(key, {
        name: i.name,
        total_quantity: i.quantity,
        unity_measure: i.unity_measure,
        purchased: i.purchased,
      });
  }

  const group: Record<string, ListRow> = {};
  for (const ingredient of rows.values()) {
    let quantity = ingredient.total_quantity;
    let unityMeasure = ingredient.unity_measure;
    const grouped = group[ingredient.name];

    if (grouped) {
      if (unityMeasure === unitTypes.gram && grouped.unity_measure === unitTypes.kilogram) {
        quantity /= 1000;
      } else if (unityMeasure === unitTypes.kilogram && grouped.unity_measure === unitTypes.gram) {
        grouped.total_quantity /= 1000;
      } else if (
        unityMeasure === unitTypes.mililiter &&
        grouped.unity_measure === unitTypes.liter
      ) {
        quantity /= 1000;
      } else if (
        unityMeasure === unitTypes.liter &&
        grouped.unity_measure === unitTypes.mililiter
      ) {
        grouped.total_quantity /= 1000;
      }
    }

    if (unityMeasure === unitTypes.unity) {
      group[`${ingredient.name} formatted`] = {
        name: ingredient.name,
        total_quantity: quantity,
        unity_measure: unityMeasure,
        purchased: ingredient.purchased,
      };
    } else if (grouped && grouped.unity_measure !== unitTypes.unity) {
      grouped.total_quantity += quantity;
      // The original compares here instead of assigning, so liters stay in
      // the unit of the last row; anything else becomes kilograms.
      if (unityMeasure !== unitTypes.mililiter && unityMeasure !== unitTypes.liter) {
        unityMeasure = unitTypes.kilogram;
      }
      grouped.unity_measure = unityMeasure;
      grouped.purchased = ingredient.purchased;
    } else {
      group[ingredient.name] = {
        name: ingredient.name,
        total_quantity: quantity,
        unity_measure: unityMeasure,
        purchased: ingredient.purchased,
      };
    }
  }
  return Object.values(group);
}

// ---------------------------------------------------------------- the server

export function emptyDb(): Db {
  return {
    users: [],
    events: [],
    dishes: [],
    ingredients: [],
    guests: [],
    uploads: [],
    session: null,
    resetCodes: {},
  };
}

type Ctx = { db: Db; method: string; body: Body; userId: string };

/** A route: method, path pattern (`:param`), handler. */
type Route = [string, string, (ctx: Ctx, params: Record<string, string>) => Reply];

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

const ok = (body: unknown, status = 200): Reply => ({ status, body });

export function createServer(opts: ServerOptions) {
  const basicInfos = basicInfosSchema(opts.today);

  // --- middlewares (src/middlewares), as plain checks

  function validateEventId(db: Db, userId: string, eventId: string): EventRow {
    if (!rgx.uuid.test(eventId)) fail(400, "ID do evento inválido");
    const event = db.events.find((e) => e.event_id === eventId);
    if (!event || event.user_id !== userId) return fail(404, "Evento não encontrado");
    return event;
  }

  function validateDishId(db: Db, event: EventRow, dishId: string): Dish {
    if (!rgx.uuid.test(dishId)) fail(400, "ID do prato inválido");
    const dish = db.dishes.find((d) => d.id === dishId);
    if (!dish) return fail(404, "Prato não encontrado");
    if (dish.event_id !== event.event_id) fail(404, "ID do prato e/ou ID do evento inválido");
    return dish;
  }

  function validateIngredientId(db: Db, dish: Dish, ingredientId: string): Ingredient {
    if (!rgx.uuid.test(ingredientId)) fail(400, "ID do ingrediente inválido");
    const ingredient = db.ingredients.find((i) => i.id === ingredientId);
    if (!ingredient) return fail(404, "Ingrediente não encontrado");
    if (ingredient.dish_id !== dish.id) fail(404, "ID do prato e/ou ID do ingrediente inválido");
    return ingredient;
  }

  function validateGuestId(db: Db, userId: string, guestId: string): Guest {
    if (!rgx.uuid.test(guestId)) fail(400, "ID do convidado inválido");
    const guest = db.guests.find((g) => g.id === guestId);
    if (!guest) return fail(404, "Convidado não encontrado");
    const event = db.events.find((e) => e.event_id === guest.event_id);
    if (!event) fail(404, "Convidado não está associado a um evento válido.");
    if (event!.user_id !== userId) {
      fail(404, "O usuário não ter permissão para alterar esse convidado.");
    }
    return guest;
  }

  /** A database CHECK that fails: the controllers answer 500. */
  const check = (valid: boolean) => {
    if (!valid) fail(500, "Erro interno no servidor");
  };

  const eventChecks = (e: EventRow) => {
    for (const text of [e.event_name, e.theme, e.event_description]) {
      check(text === null || text === "" || rgx.text.test(text));
    }
    check(e.event_date === null || rgx.date.test(e.event_date));
    check(e.event_time === null || rgx.time.test(e.event_time));
    check(e.event_location === null || rgx.location.test(e.event_location));
  };

  const dishChecks = (name: string, type: string) =>
    check(rgx.dish.test(name) && name.length <= 100 && rgx.dish.test(type) && type.length <= 14);

  const ingredientChecks = (name: string, quantity: number) =>
    check(rgx.dish.test(name) && quantity > 0);

  const bodyOf = (ctx: Ctx) => (ctx.body ?? {}) as Record<string, unknown>;

  // --- the routes behind `userAuthorization`, in the order Express tries them

  const routes: Route[] = [
    // userRoutes
    [
      "GET",
      "/user",
      ({ db, userId }) => {
        const user = db.users.find((u) => u.id === userId)!;
        return ok({ fullname: user.fullname, email: user.email });
      },
    ],
    [
      "PATCH",
      "/user",
      (ctx) => {
        validate(userUpdateSchema, ctx.body);
        const body = bodyOf(ctx);
        if (body.email !== undefined && ctx.db.users.some((u) => u.email === body.email)) {
          fail(400, "Email e/ou Senha inválido");
        }
        const user = ctx.db.users.find((u) => u.id === ctx.userId)!;
        const updatedInfos: Record<string, unknown> = {};
        for (const key of Object.keys(body) as ("fullname" | "email")[]) {
          user[key] = body[key] as string;
          updatedInfos[key] = body[key];
        }
        return ok({ message: "Informação atualizada com sucesso", updatedInfos });
      },
    ],
    [
      "PUT",
      "/user",
      (ctx) => {
        validate(passwordUpdateSchema, ctx.body);
        const user = ctx.db.users.find((u) => u.id === ctx.userId)!;
        const password = bodyOf(ctx).password;
        if (typeof password === "string") user.password = password;
        return ok({ message: "Senha atualizada com sucesso" });
      },
    ],
    [
      "DELETE",
      "/user",
      ({ db, userId }) => {
        const events = new Set(
          db.events.filter((e) => e.user_id === userId).map((e) => e.event_id),
        );
        db.users = db.users.filter((u) => u.id !== userId);
        db.uploads = db.uploads.filter((u) => u.user_id !== userId);
        dropEvents(db, events);
        return ok({ message: "Conta deletada com sucesso" });
      },
    ],

    // eventRoutes
    [
      "POST",
      "/event",
      ({ db, userId }) => {
        const event_id = opts.uuid();
        db.events.push({
          event_id,
          user_id: userId,
          event_name: null,
          theme: null,
          event_description: null,
          event_date: null,
          event_time: null,
          event_location: null,
        });
        return ok({ event_id }, 201);
      },
    ],
    [
      "GET",
      "/event",
      ({ db, userId }) =>
        ok({
          events: db.events
            .filter((e) => e.user_id === userId)
            .map((e) => ({
              event_id: e.event_id,
              event_name: e.event_name,
              theme: e.theme,
              event_date: e.event_date,
              event_time: e.event_time,
              event_location: e.event_location,
            })),
        }),
    ],
    [
      "GET",
      "/event/:id",
      ({ db, userId }, p) => {
        const e = validateEventId(db, userId, p.id);
        return ok({
          eventInfos: {
            basicInfos: {
              eventName: e.event_name,
              eventDate: e.event_date,
              eventTime: e.event_time,
              eventLocation: e.event_location,
              eventDescription: e.event_description,
              eventTheme: e.theme,
            },
            dishes: db.dishes
              .filter((d) => d.event_id === e.event_id)
              .map((d) => ({ dishId: d.id, type: d.type, dishName: d.dish_name })),
          },
        });
      },
    ],
    [
      "DELETE",
      "/event/:id",
      ({ db, userId }, p) => {
        const e = validateEventId(db, userId, p.id);
        dropEvents(db, new Set([e.event_id]));
        return ok({ message: "Evento deletado com sucesso" });
      },
    ],
    [
      "PUT",
      "/event/:id/location",
      (ctx, p) => {
        const e = validateEventId(ctx.db, ctx.userId, p.id);
        validate(locationSchema, ctx.body);
        const next = { ...e, event_location: bodyOf(ctx).location as string };
        eventChecks(next);
        Object.assign(e, next);
        // The repository builds this object with `eventTime` twice; the second,
        // the location, wins.
        return ok({
          basicInfos: {
            eventName: e.event_name,
            eventTheme: e.theme,
            eventDescription: e.event_description,
            eventDate: e.event_date,
            eventTime: e.event_location,
          },
        });
      },
    ],
    [
      "PUT",
      "/event/:id/basic-infos",
      (ctx, p) => {
        const e = validateEventId(ctx.db, ctx.userId, p.id);
        validate(basicInfos, ctx.body);
        const b = bodyOf(ctx);
        // `value || null` for every column, the location included.
        const or = (v: unknown) => (v ? (v as string) : null);
        const next: EventRow = {
          ...e,
          event_name: or(b.name),
          theme: or(b.theme),
          event_description: or(b.eventDescription),
          event_date: or(b.eventDate),
          event_time: or(b.eventTime),
          event_location: or(b.eventLocation),
        };
        eventChecks(next);
        Object.assign(e, next);
        return ok({
          basicInfos: {
            eventName: e.event_name,
            eventTheme: e.theme,
            eventDescription: e.event_description,
            eventDate: e.event_date,
            eventTime: e.event_time,
          },
        });
      },
    ],
    [
      "GET",
      "/event/:id/purchase-list",
      ({ db, userId }, p) => {
        const e = validateEventId(db, userId, p.id);
        return ok({
          eventId: p.id,
          list: purchaseList(db.ingredients.filter((i) => i.event_id === e.event_id)),
        });
      },
    ],
    [
      "PUT",
      "/event/:id/purchase-list",
      (ctx, p) => {
        const e = validateEventId(ctx.db, ctx.userId, p.id);
        validate(purchaseListSchema, ctx.body);
        const list = (bodyOf(ctx).ingredientList ?? []) as { name: string; purchased?: boolean }[];
        // One SQL statement: the first row of VALUES that matches wins.
        for (const i of ctx.db.ingredients) {
          if (i.event_id !== e.event_id) continue;
          const hit = list.find((item) => item.name === i.name);
          if (hit) i.purchased = hit.purchased ?? null;
        }
        return ok({ success: true, message: "Atualização bem sucedida" });
      },
    ],
    [
      "POST",
      "/event/:id/dish",
      (ctx, p) => {
        const e = validateEventId(ctx.db, ctx.userId, p.id);
        validate(dishSchema, ctx.body);
        const b = bodyOf(ctx);
        const name = b.dishName as string;
        const type = b.type as string;
        dishChecks(name, type);
        const list = b.ingredients as { name: string; unityMeasure: string; quantity: number }[];
        // No ingredients: the dish is saved, then the loop throws (500).
        const dishId = opts.uuid();
        ctx.db.dishes.push({ id: dishId, event_id: e.event_id, dish_name: name, type });
        if (!list) fail(500, "Erro interno no servidor");
        const ingredientsIds: string[] = [];
        for (const i of list) {
          ingredientChecks(i.name, i.quantity);
          const id = opts.uuid();
          ctx.db.ingredients.push({
            id,
            event_id: e.event_id,
            dish_id: dishId,
            name: i.name,
            unity_measure: i.unityMeasure,
            quantity: i.quantity,
            purchased: false,
          });
          ingredientsIds.push(id);
        }
        return ok({ dishId, ingredientsIds }, 201);
      },
    ],
    [
      "GET",
      "/event/:id/dish",
      ({ db, userId }, p) => {
        const e = validateEventId(db, userId, p.id);
        return ok({
          dishes: db.dishes
            .filter((d) => d.event_id === e.event_id)
            .map((d) => ({ dishId: d.id, dishName: d.dish_name, type: d.type })),
        });
      },
    ],
    [
      "PUT",
      "/event/:id/dish/:dishId",
      (ctx, p) => {
        const e = validateEventId(ctx.db, ctx.userId, p.id);
        const dish = validateDishId(ctx.db, e, p.dishId);
        validate(dishRenameSchema, ctx.body);
        const name = bodyOf(ctx).dishName as string;
        dishChecks(name, dish.type);
        dish.dish_name = name;
        // Postgres folds the unquoted alias `dishName` to lower case.
        return ok({
          message: "Nome do prato atualizado com sucesso",
          updatedInfo: { dishname: name },
        });
      },
    ],
    [
      "DELETE",
      "/event/:id/dish/:dishId",
      ({ db, userId }, p) => {
        const e = validateEventId(db, userId, p.id);
        const dish = validateDishId(db, e, p.dishId);
        db.dishes = db.dishes.filter((d) => d.id !== dish.id);
        db.ingredients = db.ingredients.filter((i) => i.dish_id !== dish.id);
        return ok({ message: "Prato deletado com sucesso" });
      },
    ],
    [
      "GET",
      "/event/:id/dish/:dishId/ingredient",
      ({ db, userId }, p) => {
        const e = validateEventId(db, userId, p.id);
        const dish = validateDishId(db, e, p.dishId);
        return ok({
          ingredientList: db.ingredients
            .filter((i) => i.dish_id === dish.id)
            .map((i) => ({ name: i.name, unity_measure: i.unity_measure, quantity: i.quantity })),
        });
      },
    ],
    [
      "DELETE",
      "/event/:id/dish/:dishId/ingredient/:ingredientId",
      ({ db, userId }, p) => {
        const e = validateEventId(db, userId, p.id);
        const dish = validateDishId(db, e, p.dishId);
        const ingredient = validateIngredientId(db, dish, p.ingredientId);
        db.ingredients = db.ingredients.filter((i) => i.id !== ingredient.id);
        return ok({ message: "Ingrediente deletado com sucesso", id: ingredient.id });
      },
    ],
    [
      "POST",
      "/event/:id/dish/:dishId/ingredient",
      (ctx, p) => {
        const e = validateEventId(ctx.db, ctx.userId, p.id);
        const dish = validateDishId(ctx.db, e, p.dishId);
        validate(ingredientSchema, ctx.body);
        const b = bodyOf(ctx) as { name: string; unityMeasure: string; quantity: number };
        ingredientChecks(b.name, b.quantity);
        const id = opts.uuid();
        ctx.db.ingredients.push({
          id,
          event_id: e.event_id,
          dish_id: dish.id,
          name: b.name,
          unity_measure: b.unityMeasure,
          quantity: b.quantity,
          purchased: false,
        });
        return ok({ message: "Ingrediente cadastrado com sucesso", newIngredientId: { id } }, 201);
      },
    ],
    [
      "PUT",
      "/event/:id/dish/:dishId/ingredient/:ingredientId",
      (ctx, p) => {
        const e = validateEventId(ctx.db, ctx.userId, p.id);
        const dish = validateDishId(ctx.db, e, p.dishId);
        const ingredient = validateIngredientId(ctx.db, dish, p.ingredientId);
        validate(ingredientSchema, ctx.body);
        const b = bodyOf(ctx) as { name: string; unityMeasure: string; quantity: number };
        ingredientChecks(b.name, b.quantity);
        Object.assign(ingredient, {
          name: b.name,
          unity_measure: b.unityMeasure,
          quantity: b.quantity,
        });
        return ok({
          message: "Informações do ingrediente atualizada com sucesso",
          updatedIngredient: { ...ingredient },
        });
      },
    ],

    // guestRouter: errors here answer `{ reason, error }`
    [
      "GET",
      "/guest/:id",
      ({ db, userId }, p) => {
        const e = validateEventId(db, userId, p.id);
        return ok(db.guests.filter((g) => g.event_id === e.event_id));
      },
    ],
    [
      "DELETE",
      "/guest/:guestId",
      ({ db, userId }, p) => {
        const guest = validateGuestId(db, userId, p.guestId);
        db.guests = db.guests.filter((g) => g.id !== guest.id);
        return ok({ success: true, result: [] });
      },
    ],
    [
      "POST",
      "/guest/:id",
      (ctx, p) => {
        const e = validateEventId(ctx.db, ctx.userId, p.id);
        validate(guestSchema, ctx.body);
        const name = bodyOf(ctx).name as string;
        if (!rgx.guest.test(name) || name.length > 100) guestError();
        const guest = { id: opts.uuid(), event_id: e.event_id, name, confirmed: false };
        ctx.db.guests.push(guest);
        return ok([{ ...guest }], 201);
      },
    ],
    [
      "PUT",
      "/guest/:guestId",
      (ctx, p) => {
        const guest = validateGuestId(ctx.db, ctx.userId, p.guestId);
        validate(guestSchema, ctx.body);
        const b = bodyOf(ctx);
        const name = b.name as string;
        if (!rgx.guest.test(name) || name.length > 100) guestError();
        guest.name = name;
        if (typeof b.confirmed === "boolean") guest.confirmed = b.confirmed;
        return ok([{ name: guest.name, confirmed: guest.confirmed }]);
      },
    ],

    // uploadRoutes: the file is kept in the browser, not in public/assets/uploads
    [
      "GET",
      "/upload",
      ({ db, userId }) =>
        ok(db.uploads.filter((u) => u.user_id === userId).map((u) => ({ hash_name: u.hash_name }))),
    ],
    [
      "PUT",
      "/upload",
      (ctx) => {
        const image = (ctx.body as UploadBody | undefined)?.image;
        if (!image) {
          throw new HttpError(500, { message: "Erro interno, não foi possivel salvar a imagem" });
        }
        const hash_name = opts.uuid().replaceAll("-", "");
        const existing = ctx.db.uploads.find((u) => u.user_id === ctx.userId);
        if (existing) {
          Object.assign(existing, { hash_name, image });
          return ok(row(existing));
        }
        const upload = { id: opts.uuid(), user_id: ctx.userId, hash_name, image };
        ctx.db.uploads.push(upload);
        return ok([row(upload)], 201);
      },
    ],
  ];

  const row = (u: Upload) => ({
    id: u.id,
    user_id: u.user_id,
    hash_name: u.hash_name,
    image_path: `public/assets/uploads/${u.hash_name}`,
  });

  /** A CHECK constraint on the guest table: the controller answers 500. */
  const guestError = (): never => {
    throw new HttpError(500, { reason: "erro interno no servidor", error: {} });
  };

  function dropEvents(db: Db, ids: Set<string>) {
    db.events = db.events.filter((e) => !ids.has(e.event_id));
    db.dishes = db.dishes.filter((d) => !ids.has(d.event_id));
    db.ingredients = db.ingredients.filter((i) => !ids.has(i.event_id));
    db.guests = db.guests.filter((g) => !ids.has(g.event_id));
  }

  /** The routes in front of `userAuthorization`. */
  function open(db: Db, method: string, path: string, body: Body): Reply | null {
    if (method === "POST" && path === "/logout") {
      db.session = null;
      return ok({ success: true });
    }
    if (method === "POST" && path === "/login") {
      validate(loginSchema, body);
      const { email, password } = body as { email: string; password: string };
      const user = db.users.find((u) => u.email === email);
      if (!user || user.password !== password) fail(401, "Email e/ou Senha inválido");
      db.session = user!.id;
      return ok({ success: true });
    }
    if (method === "POST" && path === "/recover-pass") {
      const email = (body as { email?: unknown } | null)?.email;
      if (email !== undefined && (typeof email !== "string" || !rgx.email.test(email))) {
        fail(400, typeof email !== "string" ? emailMessages.base : emailMessages.email);
      }
      const user = db.users.find((u) => u.email === email);
      if (!user) fail(400, "Email inválido");
      const code = opts.code();
      db.resetCodes[code] = user!.id;
      opts.onMail?.({ to: user!.email, code });
      return ok({ message: "Email enviado" });
    }
    if (method === "PUT" && path === "/recover-pass") {
      const { token, password } = (body ?? {}) as { token?: string; password?: string };
      if (!token) fail(401, "Código de validação ausente");
      const userId = db.resetCodes[token!];
      if (!userId) fail(401, "Código de validação inválido");
      const user = db.users.find((u) => u.id === userId);
      if (!user) fail(400, "Usuário não encontrado.");
      // No password rule on this route in 2024.
      user!.password = String(password);
      return ok({ message: "Senha atualizada com sucesso" });
    }
    if (method === "POST" && path === "/user") {
      validate(userInsertSchema, body);
      const { fullname, email, password } = body as Record<string, string>;
      if (db.users.some((u) => u.email === email)) fail(400, "Email e/ou Senha inválido");
      db.users.push({ id: opts.uuid(), fullname, email, password });
      return ok({ message: "Usuário cadastrado com sucesso" }, 201);
    }
    return null;
  }

  /**
   * One request to `/api/...`. `path` is what comes after `/api`; `db` is
   * changed in place.
   */
  function handle(db: Db, method: string, path: string, body?: Body): Reply {
    const clean = path.replace(/\/+$/, "") || "/";
    try {
      const reply = open(db, method, clean, body);
      if (reply) return reply;

      // userAuthorization + validateUserId, for every other /api route.
      if (!db.session) fail(401, "Token Ausente");
      const userId = db.session!;
      if (!db.users.some((u) => u.id === userId)) fail(400, "Usuário não encontrado.");

      for (const [m, pattern, run] of routes) {
        if (m !== method) continue;
        const params = match(pattern, clean);
        if (params) return run({ db, method, body, userId }, params);
      }
      // Express's own 404, as HTML.
      return { status: 404, body: `Cannot ${method} /api${path}` };
    } catch (error) {
      if (error instanceof HttpError) return { status: error.status, body: error.body };
      return { status: 500, body: { error: "Erro interno no servidor" } };
    }
  }

  return { handle };
}
