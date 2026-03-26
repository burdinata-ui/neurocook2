import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface NutritionInfo {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Recipe {
  name: string;
  whyItFits: string;
  ingredients: string[];
  missingIngredients: string[];
  steps: string[];
  nutritionPer100g: NutritionInfo;
  isFallbackNutrition: boolean;
}

export interface AnalysisResult {
  ingredients: string[];
  recipes: Recipe[];
}

/**
 * Распознает только список ингредиентов на изображении.
 */
export async function detectIngredients(base64Image: string, mimeType: string): Promise<string[]> {
  if (!navigator.onLine) {
    throw new Error("Отсутствует подключение к интернету");
  }

  const model = "gemini-3-flash-preview";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image.split(',')[1] || base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: `Ты — кулинарный эксперт. Твоя задача: просто перечислить все продукты, которые ты видишь на этом фото. 
              Отвечай строго в формате JSON: { "ingredients": ["продукт1", "продукт2", ...] }. 
              Используй простые названия продуктов на русском языке.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ingredients: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Список распознанных ингредиентов",
            },
          },
          required: ["ingredients"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Пустой ответ от AI модели");

    const cleanedJson = extractJson(text);
    try {
      const result = JSON.parse(cleanedJson);
      return result.ingredients as string[];
    } catch (parseError) {
      throw new Error("Ошибка распознавания продуктов.");
    }
  } catch (error: any) {
    throw error;
  }
}

export type RecommendationMode = 'fast' | 'hearty' | 'light';

/**
 * Генерирует рецепты на основе текстового списка ингредиентов и выбранного режима.
 * Использует данные КБЖУ на 100г, ориентируясь на базы USDA и Open Food Facts.
 */
export async function generateRecipesFromIngredients(ingredients: string[], mode: RecommendationMode = 'fast'): Promise<Recipe[]> {
  if (!navigator.onLine) {
    throw new Error("Отсутствует подключение к интернету");
  }

  const modeInstructions = {
    fast: "РЕЖИМ 'БЫСТРО': предлагай блюда с минимальным количеством шагов и максимально простой готовкой. Время приготовления должно быть минимальным.",
    hearty: "РЕЖИМ 'СЫТНО': предлагай более плотные, калорийные и насыщенные блюда, которые хорошо насыщают.",
    light: "РЕЖИМ 'ПОЛЕГЧЕ': предлагай более легкие, диетические и менее тяжелые варианты из доступных продуктов."
  };

  const model = "gemini-3-flash-preview";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            {
              text: `Ты — дружелюбный и полезный кулинарный ассистент "НейроПовар". 
              Твоя задача: на основе списка ингредиентов предложить от 3 до 5 реалистичных, простых домашних блюд.
              
              Список ингредиентов: ${ingredients.join(', ')}
              
              ${modeInstructions[mode]}
              
              ПРАВИЛА РАСЧЕТА КБЖУ:
              1. Для каждого блюда рассчитай КБЖУ СТРОГО НА 100 ГРАММ готового продукта.
              2. Используй данные из баз USDA FoodData Central и Open Food Facts как основной ориентир.
              3. Если продукт не найден точно, используй ближайшее общее совпадение (например, для "домашнего сыра" используй данные творога или адыгейского сыра).
              4. Если данных недостаточно для уверенного расчета, установи флаг isFallbackNutrition в true.
              
              ОБЩИЕ ПРАВИЛА:
              1. Предлагай только то, что реально приготовить дома.
              2. Опирайся в первую очередь на предоставленный список.
              3. Если для блюда не хватает 1-3 простых ингредиентов (соль, масло, мука, яйцо), укажи их в missingIngredients.
              4. Для каждого блюда напиши краткое пояснение "почему это подходит" (whyItFits), упоминая выбранный режим.
              5. Шаги приготовления должны быть короткими (3-5 шагов).
              6. Тон ответов: простой, поддерживающий и вдохновляющий.
              
              Отвечай строго в формате JSON.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  whyItFits: { type: Type.STRING },
                  ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                  steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  nutritionPer100g: {
                    type: Type.OBJECT,
                    properties: {
                      calories: { type: Type.NUMBER },
                      protein: { type: Type.NUMBER },
                      fat: { type: Type.NUMBER },
                      carbs: { type: Type.NUMBER },
                    },
                    required: ["calories", "protein", "fat", "carbs"],
                  },
                  isFallbackNutrition: { type: Type.BOOLEAN },
                },
                required: ["name", "whyItFits", "ingredients", "missingIngredients", "steps", "nutritionPer100g", "isFallbackNutrition"],
              },
            },
          },
          required: ["recipes"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Пустой ответ от AI модели");

    const cleanedJson = extractJson(text);
    try {
      const result = JSON.parse(cleanedJson);
      return result.recipes as Recipe[];
    } catch (parseError) {
      throw new Error("Ошибка обработки данных: AI вернул невалидный JSON.");
    }
  } catch (error: any) {
    if (error.message?.includes("fetch") || error.message?.includes("network")) {
      throw new Error("Ошибка сети: не удалось связаться с сервером AI");
    }
    throw error;
  }
}

/**
 * Извлекает JSON из строки, удаляя лишний текст и markdown-разметку.
 */
function extractJson(text: string): string {
  // 1. Пытаемся найти JSON внутри блоков ```json ... ``` или ``` ... ```
  const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let content = markdownMatch ? markdownMatch[1] : text;

  // 2. Ищем границы самого объекта JSON (от первой { до последней })
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return content.substring(firstBrace, lastBrace + 1);
  }

  return content.trim();
}
