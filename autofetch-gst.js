import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = "./data";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "gst-data.json");
const CLEARTAX_URL = "https://cleartax.in/s/gst-rates";

// AI keyword expansions
const aiKeywordMap = {
  food: [
    "pizza",
    "burger",
    "biryani",
    "cake",
    "bread",
    "chicken",
    "dal",
    "rice",
    "milkshake",
    "chocolate",
    "vanilla",
    "strawberry",
    "smoothie",
  ],
  beverages: [
    "tea",
    "coffee",
    "coke",
    "pepsi",
    "juice",
    "milk",
    "milkshake",
    "smoothie",
    "chocolate",
    "vanilla",
  ],
  electronics: [
    "mobile",
    "phone",
    "laptop",
    "tv",
    "tablet",
    "headphones",
    "charger",
  ],
  clothing: ["shirt", "tshirt", "jeans", "dress", "kurta"],
  jewelry: ["gold", "diamond", "silver", "necklace", "ring", "earrings"],
  default: [],
};

// Map category name to AI keyword bucket
function mapCategoryToAIKeywords(category) {
  const lower = category.toLowerCase();
  if (/food|butter|cheese|milk|spreads|snack|cooked|restaurant/.test(lower))
    return aiKeywordMap.food;
  if (/drink|beverage|tea|coffee|juice/.test(lower))
    return aiKeywordMap.beverages;
  if (/laptop|mobile|phone|television|tv|tablet/.test(lower))
    return aiKeywordMap.electronics;
  if (/shirt|jeans|dress|kurta/.test(lower)) return aiKeywordMap.clothing;
  if (/gold|diamond|silver|jewellery|jewelry/.test(lower))
    return aiKeywordMap.jewelry;
  return aiKeywordMap.default;
}

// Load previous JSON if exists
function loadPreviousData() {
  if (fs.existsSync(OUTPUT_FILE)) {
    return JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8")).items || [];
  }
  return [];
}

// Fetch GST data from ClearTax
async function fetchGSTFromClearTax() {
  const res = await fetch(CLEARTAX_URL);
  const html = await res.text();
  const $ = cheerio.load(html);

  const data = [];
  $("table").each((_, table) => {
    $(table)
      .find("tr")
      .each((_, row) => {
        const cols = $(row).find("td");
        if (cols.length < 2) return;

        const category = $(cols[0]).text().trim();
        const rateText = $(cols[1]).text().trim();
        if (!category) return;

        const gstPercentMatch = rateText.match(/\d+/);
        if (!gstPercentMatch) return;

        const gst_percent = parseInt(gstPercentMatch[0], 10);

        data.push({ item_category: category, gst_percent });
      });
  });
  return data;
}

// Self-learning keyword enrichment
function enrichKeywordsSelfLearning(fetchedData, existingItems) {
  const updatedItems = [];

  for (const item of fetchedData) {
    // Check if item already exists in previous data
    const existing = existingItems.find(
      (e) => e.item_category.toLowerCase() === item.item_category.toLowerCase()
    );

    // Base keywords: split words in category
    const baseKeywords = item.item_category
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    // Start with previous keywords if available
    const prevKeywords = existing ? existing.keywords : [];

    // Add AI keywords for category type
    const aiKeywords = mapCategoryToAIKeywords(item.item_category);

    // Merge all keywords and deduplicate
    const keywords = Array.from(
      new Set([...prevKeywords, ...baseKeywords, ...aiKeywords])
    );

    updatedItems.push({
      item_category: item.item_category,
      gst_percent: item.gst_percent,
      keywords,
    });
  }

  return updatedItems;
}

// Main
async function main() {
  console.log("🔄 Fetching GST categories from ClearTax...");
  const fetchedData = await fetchGSTFromClearTax();

  console.log("💡 Loading previous GST data...");
  const previousData = loadPreviousData();

  console.log("🤖 Enriching keywords with self-learning AI...");
  const enrichedData = enrichKeywordsSelfLearning(fetchedData, previousData);

  const finalData = {
    last_updated: new Date().toISOString(),
    items: enrichedData,
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));

  console.log(
    `💾 GST data saved to ${OUTPUT_FILE} with self-learning keywords.`
  );
}

main();
