
import { GoogleGenAI } from "@google/genai";
import { TradeSignal } from "../types";

/**
 * Analyzes a trade signal using the Gemini API.
 * Follows @google/genai guidelines:
 * - Uses process.env.API_KEY directly in initialization.
 * - Uses 'gemini-3-flash-preview' for basic text tasks.
 * - Accesses response.text property directly.
 */
export const analyzeTradeSignal = async (signal: TradeSignal): Promise<string> => {
  // Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    As a senior technical analyst, analyze this option trade signal:
    Instrument: ${signal.instrument}
    Strike/Symbol: ${signal.symbol} ${signal.type}
    Action: ${signal.action}
    Entry: ${signal.entryPrice}
    Stop Loss: ${signal.stopLoss}
    Targets: ${signal.targets.join(', ')}
    Current Status: ${signal.status}

    Provide a concise bullet-point summary (max 50 words) covering:
    1. Risk to Reward Ratio calculation.
    2. Psychological levels nearby based on the strike price.
    3. Management advice (aggressive vs safe).
    Do not give financial advice, only technical analysis.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Directly accessing .text property as per guidelines
    return response.text || "Analysis failed to generate.";
  } catch (error) {
    console.error("Gemini API Error", error);
    return "Unable to generate analysis at this time.";
  }
};
