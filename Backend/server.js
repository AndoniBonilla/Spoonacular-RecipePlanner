// Load environment variables from the .env file into process.env.
// This must run before anything else so that API_KEY and PORT are available.
require('dotenv').config();

// Express is the web framework that handles HTTP routing and middleware.
const express = require('express');

// Node's built-in path module lets us build file-system paths safely
// across operating systems (handles / vs \ differences automatically).
const path = require('path');

// ── App setup ─────────────────────────────────────────────────────────────────

const app = express();

// Use the PORT environment variable if one is set (e.g. on a hosting platform),
// otherwise fall back to 3000 for local development.
const PORT = process.env.PORT || 3000;

// Read the Spoonacular API key from the environment — never hardcode it here.
const API_KEY = process.env.SPOONACULAR_KEY;

// Base URL for every Spoonacular API call, stored once to avoid repetition.
const BASE = 'https://api.spoonacular.com';

// ── Static file serving ───────────────────────────────────────────────────────

// Serve everything inside the Frontend folder as static files.
// Visiting http://localhost:3000 will serve Frontend/index.html automatically.
// path.join + __dirname makes the path relative to this file, not the terminal cwd.
app.use(express.static(path.join(__dirname, '../Frontend')));

// ── Route: Ingredient autocomplete ───────────────────────────────────────────

// GET /api/autocomplete?query=<text>
// Called on every debounced keystroke in the ingredient input.
// Proxies to Spoonacular so the API key never reaches the browser.
app.get('/api/autocomplete', async (req, res) =>
{
  // Destructure the 'query' field from the URL query string (?query=...).
  const { query } = req.query;

  // If the query is empty or missing, return an empty array immediately
  // so the frontend gets a clean response without hitting Spoonacular.
  if (!query) return res.json([]);

  try 
  {
    // Ask Spoonacular for up to 5 ingredient name suggestions.
    // encodeURIComponent prevents special characters from breaking the URL.
    const r = await fetch(`${BASE}/food/ingredients/autocomplete?query=${encodeURIComponent(query)}&number=5&apiKey=${API_KEY}`);

    // Parse the JSON body from Spoonacular's response.
    const data = await r.json();

    // Forward Spoonacular's status code along with the data so the frontend
    // can detect upstream errors (e.g. 402 quota exceeded, 401 bad key).
    res.status(r.status).json(data);
  } 
  catch (err) 
  {
    // Network-level failure (DNS, timeout, etc.) — send a 500 with a clear message.
    res.status(500).json({ error: 'Failed to fetch autocomplete suggestions' });
  }
});

// ── Route: Recipe search by ingredients ──────────────────────────────────────

// GET /api/search?ingredients=<comma-separated list>
// Called when the user clicks "Find Recipes" on the main page.
// Also used to populate the Featured Recipes section on page load.
app.get('/api/search', async (req, res) => {
  // Destructure the 'ingredients' field from the query string (?ingredients=...).
  const { ingredients } = req.query;

  // Nothing to search — return an empty array rather than calling Spoonacular.
  if (!ingredients) return res.json([]);

  try {
    // findByIngredients returns recipes that use the supplied ingredients.
    // number=5     → return at most 5 results
    // ranking=1    → maximise used ingredients (vs. minimise missing ones)
    // ignorePantry → don't count salt, water, etc. as "used" ingredients
    const r = await fetch(`${BASE}/recipes/findByIngredients?ingredients=${encodeURIComponent(ingredients)}&number=5&ranking=1&ignorePantry=true&apiKey=${API_KEY}`);

    const data = await r.json();

    // Mirror Spoonacular's status so the browser can tell success from failure.
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// ── Route: Full recipe details ────────────────────────────────────────────────

// GET /api/recipe/:id
// Called when the user clicks on a recipe card to open the detail view.
// :id is a dynamic URL segment captured by Express (e.g. /api/recipe/716429).
app.get('/api/recipe/:id', async (req, res) => {
  // Extract the recipe ID from the URL path parameters.
  const { id } = req.params;

  try {
    // Fetch complete recipe information from Spoonacular.
    // includeNutrition=false skips the large nutrition payload we don't need.
    const r = await fetch(`${BASE}/recipes/${id}/information?includeNutrition=false&apiKey=${API_KEY}`);

    const data = await r.json();

    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recipe details' });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────

// Bind the server to the chosen port and log the local URL for convenience.
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
