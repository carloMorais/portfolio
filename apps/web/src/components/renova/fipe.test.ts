import {
  FIPE_BASE,
  anosCall,
  createFipeClient,
  filterOptions,
  formatArgs,
  marcasCall,
  monthLabel,
  modelosCall,
  parseAnos,
  parseMarcas,
  parseModelos,
  parseValor,
  preview,
  toolError,
  valorCall,
  type Fetcher,
} from "./fipe";

const reply = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

describe("tool calls", () => {
  it("follow the FIPE order, each one needing the codes from the step before", () => {
    expect(marcasCall("carros").path).toBe("/carros/marcas");
    expect(modelosCall("motos", "80").path).toBe("/motos/marcas/80/modelos");
    expect(anosCall("carros", "21", "4828").path).toBe("/carros/marcas/21/modelos/4828/anos");
    expect(valorCall("carros", "21", "4828", "2012-5")).toEqual({
      name: "getValor",
      args: { vehicleType: "carros", marcaId: "21", modeloId: "4828", ano: "2012-5" },
      path: "/carros/marcas/21/modelos/4828/anos/2012-5",
    });
  });

  it("print their arguments like a log line", () => {
    expect(formatArgs({ vehicleType: "carros", marcaId: "21" })).toBe(
      '{ vehicleType: "carros", marcaId: "21" }',
    );
  });
});

describe("createFipeClient", () => {
  it("calls the public API once per path and reuses the answer", async () => {
    const fetcher = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(async () =>
      reply(200, [{ codigo: "21", nome: "Fiat" }]),
    );
    const run = createFipeClient(fetcher);
    await run(marcasCall("carros"));
    const again = await run(marcasCall("carros"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(`${FIPE_BASE}/carros/marcas`);
    expect(parseMarcas(again.text)).toEqual([{ code: "21", name: "Fiat" }]);
  });

  it("does not cache a failure, so trying again really calls again", async () => {
    const fetcher = jest
      .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
      .mockResolvedValueOnce(reply(429, "Too Many Requests"))
      .mockResolvedValueOnce(reply(200, []));
    const run = createFipeClient(fetcher);
    await expect(run(marcasCall("motos"))).rejects.toThrow("FIPE 429");
    await expect(run(marcasCall("motos"))).resolves.toMatchObject({ text: "[]" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("toolError", () => {
  it("answers the model in the original tool's words", async () => {
    const run = createFipeClient(async () => reply(404, { error: "not found" }));
    const error = await run(anosCall("carros", "1", "2")).catch((e: unknown) => e);
    expect(toolError("getAnos", error)).toBe(
      "Error: production years not found. Please check the provided identifiers.",
    );
    expect(toolError("getValor", new Error("offline"))).toBe(
      "Error: Failed to fetch price - offline",
    );
  });
});

describe("parsing", () => {
  it("reads models out of the brand's answer", () => {
    const text = JSON.stringify({
      modelos: [{ codigo: 4828, nome: "Palio 1.0 " }],
      anos: [{ codigo: "2012-5", nome: "2012 Flex" }],
    });
    expect(parseModelos(text)).toEqual([{ code: "4828", name: "Palio 1.0" }]);
  });

  it("hides the 32000 'brand-new' years, as the original prompt asked", () => {
    const text = JSON.stringify([
      { codigo: "32000-5", nome: "32000 Flex" },
      { codigo: "2012-5", nome: "2012 Flex" },
    ]);
    expect(parseAnos(text)).toEqual([{ code: "2012-5", name: "2012 Flex" }]);
  });

  it("reads the price", () => {
    const text = JSON.stringify({
      TipoVeiculo: 1,
      Valor: "R$ 29.118,00",
      Marca: "Fiat",
      Modelo: "Palio 1.0 ECONOMY Fire Flex 8V 4p",
      AnoModelo: 2012,
      Combustivel: "Flex",
      CodigoFipe: "001267-0",
      MesReferencia: "outubro de 2026 ",
      SiglaCombustivel: "F",
    });
    expect(parseValor(text)).toEqual({
      value: "R$ 29.118,00",
      brand: "Fiat",
      model: "Palio 1.0 ECONOMY Fire Flex 8V 4p",
      year: 2012,
      fuel: "Flex",
      fipeCode: "001267-0",
      month: "outubro de 2026",
    });
  });
});

describe("filterOptions", () => {
  const brands = [
    { code: "21", name: "Fiat" },
    { code: "59", name: "VW - VolksWagen" },
    { code: "48", name: "Citroën" },
  ];

  it("ignores case and accents, and matches a code exactly", () => {
    expect(filterOptions(brands, "volks").map((b) => b.code)).toEqual(["59"]);
    expect(filterOptions(brands, "citroen").map((b) => b.code)).toEqual(["48"]);
    expect(filterOptions(brands, "21").map((b) => b.code)).toEqual(["21"]);
    expect(filterOptions(brands, "  ")).toHaveLength(3);
  });
});

describe("preview", () => {
  it("shows the first lines of the answer and counts the rest", () => {
    const { head, more } = preview(JSON.stringify([{ a: 1 }, { a: 2 }]), 3);
    expect(head).toBe('[\n  {\n    "a": 1');
    expect(more).toBe(5);
  });
});

describe("monthLabel", () => {
  it("keeps the table's month in Portuguese and translates it in English", () => {
    expect(monthLabel("outubro de 2026", "pt")).toBe("outubro de 2026");
    expect(monthLabel("março de 2025 ", "en")).toBe("March 2025");
    expect(monthLabel("something else", "en")).toBe("something else");
  });
});
