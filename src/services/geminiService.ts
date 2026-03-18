import { GoogleGenAI, Type } from "@google/genai";
import { FlyerData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are a specialist in extracting product deals from Fiji supermarket flyers (RB Patel, MH, MaxVal-u, New World IGA, Shop N Save, Extra).

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
4. BOUNDING BOX RULES (CRITICAL FOR IMAGE EXTRACTION):
   - You MUST provide a highly accurate bounding_box for EVERY product.
   - Format: [ymin, xmin, ymax, xmax] where each value is an integer from 0 to 1000 representing the relative position in the image.
   - The box MUST tightly enclose the product image, its name, and its price.
   - DO NOT overlap bounding boxes. Each box must strictly contain ONLY the single product and its immediate price tag, excluding neighboring products.
   - For HERO layouts (single product): bbox = full image minus margins.

FIJI-SPECIFIC BRANDS TO RECOGNIZE:
- Premium Island, Annalisa, Leggo's, Tim Tam, Cadbury, Mutti, Heinz, Kikkoman, 
  Arnott's, Community Co, Homegrown, Soltuna, Devondale, Tiffin, JC's, Nobby's, 
  Oreo, Red Rock Deli, Smirnoff, Tribe, Absolut, Malibu, Jim Beam, FMF, Rooster, Pacific Mac, Maharani.

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
12. TERMS AND CONDITIONS: Extract any fine print, limits (e.g., "Max 3 per customer"), or conditions.`;

export async function extractDealsFromFlyer(base64Image: string, mimeType: string): Promise<FlyerData> {
  const extractionPromise = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      "Extract all deals from this supermarket flyer according to the system instructions. Return the data as a structured JSON object.",
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
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
                description: { type: Type.STRING, nullable: true },
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
                image_reference: { type: Type.STRING, nullable: true },
                bounding_box: { 
                  type: Type.ARRAY, 
                  items: { type: Type.NUMBER }, 
                  description: "[ymin, xmin, ymax, xmax] coordinates scaled 0-1000",
                  nullable: true
                },
                confidence: { type: Type.NUMBER, description: "Confidence score 0-1" },
                origin: { type: Type.STRING, nullable: true, description: "Country of origin if mentioned (e.g., Fiji, Italy, Australia)" },
                is_local: { type: Type.BOOLEAN, nullable: true, description: "True if the product is locally produced in Fiji" },
                nutri_score: { type: Type.STRING, nullable: true, description: "Nutri-score if mentioned (A, B, C, D, E)" },
                in_stock: { type: Type.BOOLEAN, nullable: true, description: "Assume true unless explicitly marked out of stock" },
                verified: { type: Type.BOOLEAN, nullable: true, description: "Assume true if clearly visible on flyer" },
                price_trend: { type: Type.STRING, nullable: true, description: "One of: stable, dropping, rising. Infer from context if possible, otherwise stable." }
              },
            },
          },
        },
      },
    },
  });

  // Add a 60-second timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Extraction timed out after 60 seconds. Please try again with a smaller image or better connection.")), 60000);
  });

  const response = await Promise.race([extractionPromise, timeoutPromise]);

  if (!response.text) {
    throw new Error("No response from Gemini");
  }

  return JSON.parse(response.text) as FlyerData;
}
