import { describe, expect, it } from "vitest";
import {
  calcularContrato,
  camposPosto24h,
  CONFIG_ZERADA,
  custoBeneficio,
  folhaPosto,
  type BeneficioInput,
  type PostoInput,
} from "./calculo";

const base: Omit<PostoInput, "regime"> = {
  quantidade_postos: 1, quantidade_executada: 1, valor_unitario_posto: 0,
  salario_base: 0, insalubridade: 0, periculosidade: 0, outros_adicionais: 0,
  adicional_noturno: 0, dsr_noturno: 0, intrajornada: 0,
};

const servente: PostoInput = {
  ...base, id: "p1", funcao: "Servente", regime: "Normal",
  quantidade_postos: 2, quantidade_executada: 2, valor_unitario_posto: 6000,
  salario_base: 1500, insalubridade: 300,
};
const vigia: PostoInput = {
  ...base, id: "p2", funcao: "Vigia 12x36", regime: "12x36",
  valor_unitario_posto: 9000, salario_base: 1500, adicional_noturno: 200,
};
const beneficios: BeneficioInput[] = [
  { posto_id: "p1", periodicidade: "Diário", valor_unitario: 20, dias_mes: 22, desconto_fixo: 0, desconto_percentual: 0 },
  { posto_id: "p2", periodicidade: "Diário", valor_unitario: 10, dias_mes: 22, desconto_fixo: 0, desconto_percentual: 6 },
];

describe("folha do posto", () => {
  it("Normal: fixos × quantidade executada", () => {
    expect(folhaPosto(servente)).toBe(3600);
  });
  it("12x36: fixos × 2, noturnos já somados", () => {
    expect(folhaPosto(vigia)).toBe(3200);
  });
  it("24 horas: fixos × 4 e noturnos de 1 funcionário × 2", () => {
    const campos = camposPosto24h({
      adicional_noturno_unit: 100, dsr_noturno_unit: 20,
      intrajornada_diurna_unit: 50, intrajornada_noturna_unit: 60,
    });
    expect(campos).toEqual({ adicional_noturno: 200, dsr_noturno: 40, intrajornada: 220 });
    const p: PostoInput = { ...base, regime: "24 horas", salario_base: 1000, ...campos };
    expect(folhaPosto(p)).toBe(4000 + 460);
  });
});

describe("benefícios", () => {
  it("multiplica por funcionários equivalentes e desconta % do salário", () => {
    expect(custoBeneficio(beneficios[0], servente)).toBe(880);
    expect(custoBeneficio(beneficios[1], vigia)).toBeCloseTo(260, 6);
  });
  it("desconto nunca deixa o benefício negativo", () => {
    const b: BeneficioInput = { ...beneficios[1], desconto_percentual: 50 };
    expect(custoBeneficio(b, vigia)).toBe(0);
  });
  it("periodicidade mensal ignora os dias", () => {
    const b: BeneficioInput = { posto_id: "p1", periodicidade: "Mensal", valor_unitario: 150, dias_mes: 22, desconto_fixo: 0, desconto_percentual: 0 };
    expect(custoBeneficio(b, servente)).toBe(300);
  });
});

describe("demonstração do contrato", () => {
  const simples = { ...CONFIG_ZERADA, regime: "Simples" as const, das: 10 };
  const d = calcularContrato(
    { modo_provisao: "Individual", perc_provisao_unica: 0 },
    [servente, vigia], beneficios,
    [{ valor_mensal: 500, origem: "materiais" }],
    simples,
  );

  it("receita, folha e FGTS", () => {
    expect(d.receita).toBe(21000);
    expect(d.folha).toBe(6800);
    expect(d.fgts).toBeCloseTo(544, 6);
  });
  it("provisões individuais com FGTS sobre verbas e multa de 40%", () => {
    expect(d.provisoesDetalhe!.decimoTerceiro).toBeCloseTo(566.6667, 3);
    expect(d.provisoesDetalhe!.tercoFerias).toBeCloseTo(188.8889, 3);
    expect(d.provisoesDetalhe!.fgtsSobreVerbas).toBeCloseTo(105.7778, 3);
    expect(d.provisoesDetalhe!.multaFgts).toBeCloseTo(259.9111, 3);
    expect(d.provisoes).toBeCloseTo(1687.9111, 3);
  });
  it("Simples: tributo = receita × DAS, sem IR sobre lucro", () => {
    expect(d.tributos).toBeCloseTo(2100, 6);
    expect(d.impostosLucro).toBe(0);
    expect(d.lucroAntesIR).toBeCloseTo(8228.0889, 3);
    expect(d.resultado).toBeCloseTo(8228.0889, 3);
    expect(d.margem).toBeCloseTo(39.1814, 3);
    expect(d.materiais).toBe(500);
  });
  it("percentual único de provisão", () => {
    const u = calcularContrato({ modo_provisao: "Percentual único", perc_provisao_unica: 20 }, [servente], [], [], null);
    expect(u.provisoes).toBe(720);
    expect(u.provisoesDetalhe).toBeNull();
  });
  it("sem configuração tributária as alíquotas valem zero", () => {
    const z = calcularContrato({ modo_provisao: "Percentual único", perc_provisao_unica: 0 }, [servente], [], [], null);
    expect(z.tributos).toBe(0);
    expect(z.encargos).toBe(0);
    expect(z.resultado).toBeCloseTo(12000 - 3600 - 288, 6);
  });
});

describe("regimes de lucro", () => {
  const posto: PostoInput = { ...base, regime: "Normal", valor_unitario_posto: 100000, salario_base: 10000 };
  const contrato = { modo_provisao: "Percentual único" as const, perc_provisao_unica: 0 };

  it("Presumido: base = receita × presunção, adicional acima de 20 mil", () => {
    const d = calcularContrato(contrato, [posto], [], [], {
      ...CONFIG_ZERADA, regime: "Presumido", pis: 0.65, cofins: 3, iss: 5,
      irpj: 15, csll: 9, presuncao_irpj: 32, presuncao_csll: 32, adicional_irpj: 10,
    });
    expect(d.tributos).toBeCloseTo(8650, 6);
    expect(d.irpj).toBeCloseTo(4800, 6);
    expect(d.adicionalIrpj).toBeCloseTo(1200, 6);
    expect(d.csll).toBeCloseTo(2880, 6);
  });
  it("Real: IR e CSLL sobre o lucro; prejuízo não gera imposto", () => {
    const d = calcularContrato(contrato, [posto], [], [], {
      ...CONFIG_ZERADA, regime: "Real", irpj: 15, csll: 9, adicional_irpj: 10,
    });
    expect(d.lucroAntesIR).toBeCloseTo(89200, 6);
    expect(d.irpj).toBeCloseTo(13380, 6);
    expect(d.adicionalIrpj).toBeCloseTo(6920, 6);
    expect(d.csll).toBeCloseTo(8028, 6);

    const prejuizo = calcularContrato(contrato, [{ ...posto, valor_unitario_posto: 1000 }], [], [], {
      ...CONFIG_ZERADA, regime: "Real", irpj: 15, csll: 9,
    });
    expect(prejuizo.impostosLucro).toBe(0);
    expect(prejuizo.resultado).toBeLessThan(0);
  });
});
