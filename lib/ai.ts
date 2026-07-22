import Anthropic from "@anthropic-ai/sdk";

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `Eres un analista senior de paid media. Recibirás un JSON con KPIs
agregados, campañas y hallazgos de reglas automáticas de una cuenta publicitaria
(Meta Ads o Google Ads). Responde en español con un análisis breve y accionable:

1. Diagnóstico general de la cuenta (2-3 frases).
2. Las 3 acciones más importantes, ordenadas por impacto, cada una con el
   dato que la justifica.
3. Riesgos o cosas a vigilar.

Usa Markdown simple (títulos y listas). No inventes datos que no estén en el JSON.`;

export interface AiAnalysisInput {
  platform: "meta" | "google";
  accountId: string;
  dateFrom: string;
  dateTo: string;
  kpis: Record<string, number>;
  campaigns: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
}

export async function generateAiAnalysis(input: AiAnalysisInput): Promise<string> {
  if (!aiAvailable()) {
    throw new Error("ANTHROPIC_API_KEY no está configurada — el análisis con IA es opcional");
  }
  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-8",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Datos de la cuenta:\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
