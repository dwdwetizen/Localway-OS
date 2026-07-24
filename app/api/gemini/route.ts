import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY não configurada no ambiente." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const body = await req.json();
    const { action, companyName, category, rating, issue, reviewText, reviewerName, tone } = body;

    if (action === "generate_pitch") {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Você é um Especialista Sênior de Vendas B2B em Marketing Local.
Crie uma mensagem comercial altamente persuasiva e direta em português para enviar via WhatsApp/E-mail para o proprietário da empresa "${companyName || 'Empresa Local'}" (${category || 'Comércio Local'}, Nota Google: ${rating || '4.2'}).
Problema auditado no Google Business Profile: ${issue || 'Baixa frequência de postagens, fotos desatualizadas e ausência de palavras-chave no perfil'}.
O texto deve ser profissional, direto ao ponto, destacar a oportunidade de superar concorrentes locais e solicitar uma breve demonstração de 15 minutos.`,
      });
      return NextResponse.json({ result: response.text });
    }

    if (action === "respond_review") {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Você é o gestor de reputação e atendimento da empresa "${companyName || 'Estabelecimento Comercial'}".
Escreva uma resposta exemplar em português para a seguinte avaliação recebida no Google Business Profile de ${reviewerName || 'um cliente'}:
"${reviewText || 'Atendimento bom, mas demorou um pouco para entregar.'}"
Tom desejado: ${tone || 'Profissional, empático e resolutivo'}.
A resposta deve ser elegante, ter entre 2 e 4 frases e reforçar a atenção ao cliente.`,
      });
      return NextResponse.json({ result: response.text });
    }

    if (action === "generate_insights") {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Forneça 3 diagnósticos rápidos e recomendações táticas de SEO Local em português para a empresa "${companyName || 'Restaurante Gourmet'}" no segmento "${category || 'Gastronomia'}" para subir no Local Pack do Google Maps.`,
      });
      return NextResponse.json({ result: response.text });
    }

    if (action === "cold_call_script") {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Escreva um script curto de abordagem por telefone (Cold Call de 60 segundos) em português para abordar o tomador de decisão da empresa "${companyName || 'Clínica Odontológica'}".
Destaque que o raio-x local mostrou que eles estão perdendo cerca de 30% de clientes para concorrentes a menos de 2km por falhas no cadastro do Google.`,
      });
      return NextResponse.json({ result: response.text });
    }

    return NextResponse.json({ error: "Ação inválida solicitada." }, { status: 400 });
  } catch (err: any) {
    console.error("Gemini Route Error:", err);
    return NextResponse.json({ error: err?.message || "Erro interno no servidor de IA." }, { status: 500 });
  }
}
