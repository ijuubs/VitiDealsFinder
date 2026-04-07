import { GoogleGenAI, Type } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import { FlyerData, Deal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function askConcierge(
  userMessage: string,
  history: { role: string; parts: { text: string }[] }[],
  deals: Deal[]
): Promise<{ message: string; suggested_product_ids: string[] }> {
  // Simplify deals to save tokens and focus the AI, limit to 100 to prevent token overflow
  const simplifiedDeals = deals.slice(0, 100).map(d => ({
    id: d.product_id,
    name: d.name,
    price: d.price || (d.variants && d.variants.length > 0 ? d.variants[0].price : null),
    store: d.store,
    location: d.location,
    category: d.category,
    weight: d.weight
  }));

  const systemInstruction = `You are a helpful Fiji supermarket shopping concierge.
You help users find the best deals, plan meals, and build shopping lists.
You have access to the following current active deals:
${JSON.stringify(simplifiedDeals)}

When the user asks a question, recommend the best products from the available deals.
If they ask for a recipe or meal plan, suggest the ingredients that are currently on sale.
If they ask for the cheapest item, find it and tell them where it is.
Always return your response in JSON format matching the schema.
If suggesting items to add to their shopping list, include their exact 'id' in the suggested_product_ids array.
IMPORTANT: Keep your response concise. Limit your suggested products to a maximum of 10 items to avoid overwhelming the user.`;

  const generatePromise = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING, description: "Your conversational response to the user. Use markdown for formatting." },
          suggested_product_ids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of product IDs you recommend based on the user's query."
          }
        },
        required: ["message", "suggested_product_ids"]
      }
    }
  });

  // Add a 30-second timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Concierge request timed out after 30 seconds.")), 30000);
  });

  const response = await Promise.race([generatePromise, timeoutPromise]);

  let responseText = response.text;
  if (!responseText) {
    throw new Error("No response from Gemini");
  }

  // Sometimes the model wraps JSON in markdown blocks even with responseMimeType set
  responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.warn("Failed to parse JSON response directly, attempting to repair...", e);
    try {
      const repairedJson = jsonrepair(responseText);
      return JSON.parse(repairedJson);
    } catch (repairError) {
      console.error("Failed to repair JSON response:", responseText);
      throw new Error("Failed to parse response from Gemini");
    }
  }
}

const SYSTEM_INSTRUCTION = `
You are a specialist in extracting product deals from Fiji supermarket flyers (RB Patel, MH, MaxVal-u, New World IGA).

LAYOUT TYPES:
1. GRID: Multiple products in tiles (most common)
2. HERO: Single large product feature
3. MIXED: Combination

PRICE BUBBLE COLORS TO DETECT:
- Yellow circles/ovals (most common)
- Red circles (New World style)
- White circles with red border

CRITICAL RULES:
1. EXCLUDE category headers like "Canned Vegetables", "Sauces", "Biscuits" from product names
2. EXCLUDE promotional badges like "2FOR" from the product name (put in promo_type or deal_type)
3. SIZE FORMATS in Fiji:
   - Grams: 400g, 400gm (both valid)
   - Chicken: #12, #14, #16
   - Multi-pack: "3 x 200g"
   - Volume: 750ml, 1L, 1.5L
4. BOUNDING BOX must be TIGHT around the product tile, including:
   - The product image
   - The price bubble/text
   - The product name text
   - Format: [ymin, xmin, ymax, xmax] where each value is an integer from 0 to 1000 representing the relative position in the image.
   - MANDATORY: Every product MUST have a bounding_box.
5. For HERO layouts (single product): bbox = [0, 0, 1000, 1000] (full image)
6. GRID LAYOUTS: Ensure the bounding box covers the entire logical "tile" for that product.

FIJI-SPECIFIC BRANDS TO RECOGNIZE:
- Premium Island, Annalisa, Leggo's, Tim Tam, Cadbury, Mutti, Heinz, Kikkoman, 
  Arnott's, Community Co, Homegrown, Soltuna, Devondale, Tiffin, JC's, Nobby's, 
  Oreo, Red Rock Deli, Smirnoff, Tribe, Absolut, Malibu, Jim Beam, FMF, Rooster, Pacific Mac, Maharani.

OUTPUT:
- One deal per tile/product
- Tight bounding boxes
- Clean product names (no sizes, prices, or categories mixed in)

EXTRACTION RULES:
1. OCR ACCURACY: Extract text EXACTLY as it appears. Pay close attention to prices, weights, and product names.
2. PRICE DETECTION: Extract numeric values with currency symbols ($). Detect unit context (each, kg, g, L). Normalize into price (float) and unit (string).
3. MULTI-VARIANT PRODUCTS: Detect grouped items (e.g., #11, #14, #16 chicken). Store as "variants" array.
4. PRODUCT NAME CLEANING: Remove brand repetition. Normalize names.
5. BRAND EXTRACTION: Detect logos or repeated labels.
6. CATEGORY CLASSIFICATION: Meat, Seafood, Produce, Dairy, Pantry, Snacks, Beverages, Household.
7. UNIT NORMALIZATION: Convert 500G -> 0.5kg. Store both original + normalized.
8. PRICE PER UNIT: Calculate if weight and price exist.
9. PROMOTION DETECTION: Detect "Special", "Save", "Deal", bulk offers. Set deal_type = ["discount", "bundle", "standard"].
10. STORE + LOCATION: Extract store name and branch/location accurately. If multiple locations, list them or pick the primary one.
11. DATE EXTRACTION: Parse dates and convert to ISO format. Look for "Valid from X to Y" or "Specials end Z".
12. TERMS AND CONDITIONS: Extract any fine print, limits (e.g., "Max 3 per customer"), or conditions.
13. LIMIT: Extract a maximum of 40 products per flyer to prevent data truncation. Prioritize the most prominent deals.
14. DIETARY & ALLERGEN TAGGING: Automatically tag products with badges like "Halal", "Vegetarian", "Vegan", "High Sugar", "Gluten-Free", "Dairy-Free" based on the brand, product name, and common knowledge.
`;

export async function extractDealsFromFlyer(base64Image: string, mimeType: string): Promise<FlyerData> {
  const extractionPromise = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: "Extract all deals from this supermarket flyer according to the system instructions. Return the data as a structured JSON object.",
        }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          store: { type: Type.STRING },
          location: { type: Type.STRING },
          promotion_period: {
            type: Type.OBJECT,
            properties: {
              start_date: { type: Type.STRING },
              end_date: { type: Type.STRING },
            },
          },
          terms_and_conditions: { type: Type.STRING, nullable: true, description: "Any fine print, limits, or conditions found on the flyer." },
          store_hours: { type: Type.STRING, nullable: true, description: "Store opening and closing hours if mentioned on the flyer." },
          traffic_status: { type: Type.STRING, nullable: true, description: "Store traffic status if mentioned." },
          products: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                product_id: { type: Type.STRING, description: "Auto-generate a unique ID" },
                name: { type: Type.STRING },
                brand: { type: Type.STRING, nullable: true },
                category: { type: Type.STRING },
                subcategory: { type: Type.STRING },
                variants: {
                  type: Type.ARRAY,
                  nullable: true,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      weight_estimate: { type: Type.STRING },
                      price: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                    },
                  },
                },
                price: { type: Type.NUMBER, nullable: true },
                unit: { type: Type.STRING, nullable: true },
                weight: { type: Type.STRING, nullable: true },
                price_per_unit: { type: Type.NUMBER, nullable: true },
                currency: { type: Type.STRING },
                deal_type: { type: Type.STRING },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  nullable: true,
                  description: "Dietary and allergen tags like 'Halal', 'Vegetarian', 'High Sugar', etc."
                },
                bounding_box: { 
                  type: Type.ARRAY, 
                  items: { type: Type.NUMBER }, 
                  description: "[ymin, xmin, ymax, xmax] coordinates scaled 0-1000",
                  nullable: true
                }
              },
            },
          },
        },
      },
    },
  });

  // Add a 300-second timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Extraction timed out after 300 seconds. Please try again with a smaller image or better connection.")), 300000);
  });

  const response = await Promise.race([extractionPromise, timeoutPromise]);

  let responseText = response.text;
  if (!responseText) {
    throw new Error("No response from Gemini");
  }

  // Sometimes the model wraps JSON in markdown blocks even with responseMimeType set
  responseText = responseText.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  try {
    return JSON.parse(responseText) as FlyerData;
  } catch (e) {
    console.warn("Failed to parse JSON directly, attempting to repair...", e);
    console.warn("Finish reason:", response.candidates?.[0]?.finishReason);
    
    try {
      const repairedJson = jsonrepair(responseText);
      return JSON.parse(repairedJson) as FlyerData;
    } catch (repairError) {
      console.error("Failed to repair JSON:", repairError);
      
      // Fallback: The JSON might be severely truncated. Try to find the last complete object in the products array.
      try {
        console.log("Attempting fallback truncation repair...");
        // Find the last occurrence of '}, {' (with optional whitespace) which strongly indicates the boundary between two products
        const matches = [...responseText.matchAll(/\}\s*,\s*\{/g)];
        
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          // lastMatch.index is the index of the '}'
          if (lastMatch.index !== undefined) {
            // Truncate at the boundary (keep the '}') and close the array and main object
            const truncatedText = responseText.substring(0, lastMatch.index + 1) + ']}';
            const repairedTruncated = jsonrepair(truncatedText);
            const parsed = JSON.parse(repairedTruncated) as FlyerData;
            console.log(`Fallback repair successful. Recovered ${parsed.products?.length || 0} products.`);
            return parsed;
          }
        }
        
        // If regex fails, try just '},'
        const lastCompleteObjIndex = responseText.lastIndexOf('},');
        if (lastCompleteObjIndex > 0) {
          const truncatedText = responseText.substring(0, lastCompleteObjIndex + 1) + ']}';
          const repairedTruncated = jsonrepair(truncatedText);
          const parsed = JSON.parse(repairedTruncated) as FlyerData;
          console.log(`Fallback repair successful. Recovered ${parsed.products?.length || 0} products.`);
          return parsed;
        }
      } catch (fallbackError) {
        console.error("Fallback repair failed:", fallbackError);
      }
      
      throw new Error("Failed to parse response from Gemini. The flyer might be too large or complex.");
    }
  }
}
