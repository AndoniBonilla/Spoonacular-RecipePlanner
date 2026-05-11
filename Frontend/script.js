// Grab references to the DOM elements we'll need throughout the script.
// Doing this once at the top is faster than querying the DOM repeatedly.
const ingredientInput = document.getElementById('ingredient-input');
const autocompleteList = document.getElementById('autocomplete-list');
const tagsContainer = document.getElementById('tags-container');
const searchBtn = document.getElementById('search-btn');
const results = document.getElementById('results');
const detailView = document.getElementById('detail-view');

// ingredients[] tracks the canonical (lowercased) ingredient names the user has added.
// It is the single source of truth — the visual tags in the DOM mirror this array.
let ingredients = [];

// debounceTimer holds the ID returned by setTimeout so we can cancel it
// each time the user types another character before the delay expires.
let debounceTimer;

// ── Auth helpers ──────────────────────────────────────────────────────────────

// Returns the currently logged-in user object { username, email }
// or null if nobody is logged in. Reads from localStorage on every call
// so it always reflects the latest auth state without a page reload.
function getCurrentUser() 
{
  return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

// ── localStorage helpers (user-scoped) ───────────────────────────────────────

// Returns the storage key for saved recipes:
// logged-in users get their own key; guests share a generic one.
// This means each user's saved list is isolated from everyone else's.
function getSavedKey() 
{
  const user = getCurrentUser();
  return user ? `savedRecipes_${user.email}` : 'savedRecipes';
}

// Reads the current user's saved recipe array from localStorage.
// Falls back to an empty array if nothing has been saved yet.
function getSavedRecipes() 
{
  return JSON.parse(localStorage.getItem(getSavedKey()) || '[]');
}

// Persists the updated saved recipe array back to localStorage.
function setSavedRecipes(recipes)
{
  localStorage.setItem(getSavedKey(), JSON.stringify(recipes));
}

// Returns true if a recipe with the given id is already in the saved list.
// Used to set the initial button state when rendering recipe cards.
function isSaved(id) 
{
  return getSavedRecipes().some(r => r.id === id);
}

// NOTE: Passwords are stored as plain text in localStorage.
// This is NOT safe for production — use a proper auth backend in a real app.

// Toggles a recipe's saved state:
//   - Not saved → push it onto the array
//   - Already saved → splice it out (unsave)
// We only store the fields the cards need (id, title, image) to keep storage small.
function saveRecipe(recipe) 
{
  const saved = getSavedRecipes();
  const idx = saved.findIndex(r => r.id === recipe.id);
  if (idx === -1)
  {
    saved.push({ id: recipe.id, title: recipe.title, image: recipe.image });
  } 
  else 
  {
    saved.splice(idx, 1);
  }
  setSavedRecipes(saved);
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

// Listen for every keystroke in the ingredient input.
// We debounce by 300ms so we only hit the server after the user pauses typing,
// rather than on every single character.
ingredientInput.addEventListener('input', () => 
  {
  clearTimeout(debounceTimer);
  const query = ingredientInput.value.trim();
  if (!query) 
  {
    hideDropdown();
    return;
  }
  debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
});

// Calls the backend proxy route, which in turn queries Spoonacular.
// The API key never leaves the server — the browser only talks to /api/autocomplete.
async function fetchSuggestions(query)
 {
  try
  {
    const res = await fetch(`/api/autocomplete?query=${encodeURIComponent(query)}`);
    const suggestions = await res.json();
    renderDropdown(suggestions);
  }
  catch 
  {
    // If the request fails (network error, server down, etc.), just hide the dropdown.
    hideDropdown();
  }
}

// Builds the dropdown list from the array of { name, image } objects
// returned by Spoonacular's ingredient autocomplete endpoint.
function renderDropdown(suggestions) 
{
  autocompleteList.innerHTML = '';
  if (!suggestions.length) 
    {
      hideDropdown(); 
      return;
    }

  suggestions.forEach(({ name, image }) => 
  {
    const li = document.createElement('li');
    li.className = 'autocomplete-item';
    li.innerHTML = `
      <img src="https://img.spoonacular.com/ingredients_100x100/${image}" alt="${name}" />
      <span>${name}</span>
    `;

    // mousedown fires before the input's blur event, so the click is
    // registered before the dropdown is hidden by the blur handler below.
    // e.preventDefault() stops the input from losing focus on click.
    li.addEventListener('mousedown', (e) => 
    {
      e.preventDefault();
      addIngredient(name);
    });
    autocompleteList.appendChild(li);
  });

  // Adding the .open class triggers the CSS opacity/translateY transition.
  autocompleteList.classList.add('open');
}

// Clears and hides the autocomplete dropdown.
function hideDropdown()
{
  autocompleteList.innerHTML = '';
  autocompleteList.classList.remove('open');
}

// When the input loses focus (user clicks elsewhere), close the dropdown.
// This fires after mousedown, so the ingredient click is already handled.
ingredientInput.addEventListener('blur', hideDropdown);

// ── Ingredient tags ───────────────────────────────────────────────────────────

// Adds an ingredient to the list and renders a removable chip tag in the UI.
// Normalising to lowercase prevents "Chicken" and "chicken" from being treated
// as two different ingredients.
function addIngredient(name) 
{
  const normalized = name.trim().toLowerCase();

  // Guard: skip empty strings and duplicates.
  if (!normalized || ingredients.includes(normalized)) 
  {
    ingredientInput.value = '';
    hideDropdown();
    return;
  }

  // Keep the canonical ingredient name in our state array.
  ingredients.push(normalized);

  // Build the pill-shaped tag element and attach a remove handler.
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.dataset.name = normalized;
  tag.innerHTML = `${name}<button class="remove-tag" aria-label="Remove ${name}">&times;</button>`;

  // Clicking × removes this ingredient from both the DOM and the array.
  tag.querySelector('.remove-tag').addEventListener('click', () => 
  {
    ingredients = ingredients.filter(i => i !== normalized);
    tag.remove();
  });

  tagsContainer.appendChild(tag);
  ingredientInput.value = '';
  hideDropdown();
}

// Allow pressing Enter to add the typed text directly without selecting
// from the autocomplete dropdown — useful for fast keyboard-only entry.
ingredientInput.addEventListener('keydown', (e) => 
{
  if (e.key === 'Enter') 
  {
    const val = ingredientInput.value.trim();
    if (val) 
      addIngredient(val);
  }
});

// ── Recipe search ─────────────────────────────────────────────────────────────

// Triggered when the user clicks "Find Recipes".
// Joins the ingredients array into a comma-separated string and sends it
// to the backend, which proxies the request to Spoonacular.
searchBtn.addEventListener('click', async () => 
{
  if (!ingredients.length) 
    return;

  // Show a loading state while the request is in flight.
  results.innerHTML = '<p class="loading">Searching…</p>';

  // Clear and hide any previously open detail view.
  detailView.classList.add('hidden');
  detailView.innerHTML = '';

  try 
  {
    const res = await fetch(`/api/search?ingredients=${encodeURIComponent(ingredients.join(','))}`);
    const recipes = await res.json();
    renderRecipes(recipes);
  } 
  catch 
  {
    results.innerHTML = '<p class="error">Something went wrong. Please try again.</p>';
  }
});

// Renders a grid of recipe cards from the search results.
// Each card shows the recipe image and title, and has a save-toggle button.
function renderRecipes(recipes) 
{
  if (!recipes.length) 
  {
    results.innerHTML = '<p class="empty">No recipes found. Try different ingredients.</p>';
    return;
  }

  results.innerHTML = '';
  recipes.forEach(recipe =>
  {
    // Reflect the current saved state so the button label is correct on first render.
    const saved = isSaved(recipe.id);

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML = `
      <img src="${recipe.image}" alt="${recipe.title}" />
      <div class="card-body">
        <div class="card-title">${recipe.title}</div>
        <button class="save-btn${saved ? ' saved' : ''}" data-id="${recipe.id}">
          ${saved ? '✓ Saved' : 'Save Recipe'}
        </button>
      </div>
    `;

    // Clicking anywhere on the card opens the full recipe detail view.
    card.addEventListener('click', () => fetchRecipeDetail(recipe.id));

    // The save button sits inside the card, so we must stop the click
    // from bubbling up to the card's own click handler.
    const saveBtn = card.querySelector('.save-btn');
    saveBtn.addEventListener('click', (e) => 
    {
      e.stopPropagation();
      saveRecipe({ id: recipe.id, title: recipe.title, image: recipe.image });

      // Re-read isSaved() after toggling so the button reflects the new state.
      const nowSaved = isSaved(recipe.id);
      saveBtn.textContent = nowSaved ? '✓ Saved' : 'Save Recipe';
      saveBtn.classList.toggle('saved', nowSaved);
    });

    results.appendChild(card);
  });
}

// ── Featured Recipes ──────────────────────────────────────────────────────────

// Static fallback cards used when the API call fails or returns nothing.
// Each entry has a CSS gradient as the "image" and a hardcoded title.
const FEATURED_FALLBACK = 
[
  { gradient: 'linear-gradient(135deg, #f4845f 0%, #f9a27a 100%)', title: 'Pasta Primavera' },
  { gradient: 'linear-gradient(135deg, #2d6a4f 0%, #52b788 100%)', title: 'Grilled Salmon with Herbs' },
  { gradient: 'linear-gradient(135deg, #e9c46a 0%, #f4a261 100%)', title: 'Chicken Stir Fry' },
  { gradient: 'linear-gradient(135deg, #8ecae6 0%, #219ebc 100%)', title: 'Classic Caesar Salad' },
  { gradient: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)', title: 'Beef Tacos' },
  { gradient: 'linear-gradient(135deg, #606c38 0%, #a7c957 100%)', title: 'Hearty Vegetable Soup' },
];

// Renders the fallback gradient cards into the featured grid.
// Called if the API returns an empty array or throws an error.
function renderFallbackFeatured(grid) 
{
  FEATURED_FALLBACK.forEach(({ gradient, title }) =>
  {
    const card = document.createElement('div');
    card.className = 'featured-card';
    card.innerHTML = `
      <div class="featured-img" style="background: ${gradient};"></div>
      <div class="card-body">
        <div class="card-title">${title}</div>
        <span class="view-label">View Recipe</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Fetches real recipe data from the backend and populates the Featured grid.
// Uses a broad ingredient list to surface a variety of popular recipes.
// Falls back to gradient placeholders on any failure.
async function loadFeaturedRecipes() 
{
  const grid = document.getElementById('featured-recipes-grid');

  // Guard: this function is called on every page that loads script.js,
  // but the featured grid only exists on index.html.
  if (!grid) return;

  try 
  {
    const res = await fetch('/api/search?ingredients=chicken,pasta,salmon,beef,garlic,eggs,shrimp&number=6');
    const recipes = await res.json();

    if (!Array.isArray(recipes) || !recipes.length) 
    {
      renderFallbackFeatured(grid);
      return;
    }

    recipes.forEach(recipe => 
    {
      const saved = isSaved(recipe.id);

      // Spoonacular's findByIngredients endpoint sometimes returns a bare filename
      // (e.g. "soup.jpg") instead of a full URL. We normalise it here so every
      // card gets a working image regardless of what the API returns.
      const imageUrl = recipe.image.startsWith('http')
        ? recipe.image
        : `https://img.spoonacular.com/recipes/${recipe.image}`;

      const card = document.createElement('div');
      card.className = 'featured-card';
      card.innerHTML = `
        <img class="featured-img" src="${imageUrl}" alt="${recipe.title}" style="object-fit: cover;" />
        <div class="card-body">
          <div class="card-title">${recipe.title}</div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button class="view-label" style="background: none; border: none; cursor: pointer; padding: 0; font-family: inherit;">View Recipe</button>
            <button class="save-btn${saved ? ' saved' : ''}" data-id="${recipe.id}">
              ${saved ? '✓ Saved' : 'Save Recipe'}
            </button>
          </div>
        </div>
      `;

      // "View Recipe" opens the detail pane without navigating away.
      card.querySelector('.view-label').addEventListener('click', () => 
      {
        fetchRecipeDetail(recipe.id);
      });

      // Save toggle — same pattern as the regular recipe card save button.
      const saveBtn = card.querySelector('.save-btn');
      saveBtn.addEventListener('click', (e) => 
      {
        e.stopPropagation();
        saveRecipe({ id: recipe.id, title: recipe.title, image: recipe.image });
        const nowSaved = isSaved(recipe.id);
        saveBtn.textContent = nowSaved ? '✓ Saved' : 'Save Recipe';
        saveBtn.classList.toggle('saved', nowSaved);
      });

      grid.appendChild(card);
    });

  } 
  catch 
  {
    // Any network or parse error → render static placeholders instead.
    renderFallbackFeatured(grid);
  }
}

// Kick off the featured section fetch immediately when the page loads.
loadFeaturedRecipes();

// ── Recipe detail ─────────────────────────────────────────────────────────────

// Fetches full recipe information from the backend and renders the detail view.
// Called when clicking a card in the search results OR a featured recipe.
async function fetchRecipeDetail(id) 
{
  // Show a loading message while we wait for the response.
  detailView.innerHTML = '<p class="loading">Loading recipe…</p>';
  detailView.classList.remove('hidden');

  // Smoothly scroll the detail view into the viewport.
  detailView.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try 
  {
    const res = await fetch(`/api/recipe/${id}`);
    const recipe = await res.json();
    renderDetail(recipe);
  } 
  catch 
  {
    detailView.innerHTML = '<p class="error">Could not load recipe details.</p>';
  }
}

// Builds and injects the full recipe detail layout into #detail-view.
// Displays: hero image, title, diet badges, stats bar, and ingredient list.
function renderDetail(r) 
{
  // The four diet flags we surface as badge chips.
  // We only render a badge when the corresponding property is true on the recipe object.
  const diets =
  [
    { key: 'vegetarian', label: 'Vegetarian' },
    { key: 'vegan', label: 'Vegan' },
    { key: 'glutenFree', label: 'Gluten Free' },
    { key: 'dairyFree', label: 'Dairy Free' },
  ];

  // Filter to only the diets that apply, then map each to a badge <span>.
  const dietBadges = diets
    .filter(d => r[d.key])
    .map(d => `<span class="diet-badge">${d.label}</span>`)
    .join('');

  // extendedIngredients is Spoonacular's full ingredient array.
  // .original gives us the pre-formatted string e.g. "2 cups flour".
  const ingredientList = (r.extendedIngredients || [])
    .map(i => `<li>${i.original}</li>`)
    .join('');

  // pricePerServing comes in cents, so we divide by 100 to get dollars.
  // Guard against null/undefined with a fallback to 'N/A'.
  const price = r.pricePerServing != null
    ? `$${(r.pricePerServing / 100).toFixed(2)}`
    : 'N/A';

  detailView.innerHTML = `
    <button id="back-btn" class="back-btn">&larr; Back to results</button>
    <div class="detail-inner">
      <img class="detail-img" src="${r.image}" alt="${r.title}" />
      <h2>${r.title}</h2>
      ${dietBadges ? `<div class="diet-badges">${dietBadges}</div>` : ''}
      <div class="detail-stats">
        <div class="stat"><span class="stat-label">Ready in</span><span class="stat-value">${r.readyInMinutes} min</span></div>
        <div class="stat"><span class="stat-label">Servings</span><span class="stat-value">${r.servings}</span></div>
        <div class="stat"><span class="stat-label">Health Score</span><span class="stat-value">${r.healthScore}</span></div>
        <div class="stat"><span class="stat-label">Price / serving</span><span class="stat-value">${price}</span></div>
      </div>
      <h3>Ingredients</h3>
      <ul class="ingredient-list">${ingredientList}</ul>
    </div>
  `;

  // Back button hides the detail view and scrolls back up to the results grid.
  document.getElementById('back-btn').addEventListener('click', () => 
  {
    detailView.classList.add('hidden');
    detailView.innerHTML = '';
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ── Auth & navbar ─────────────────────────────────────────────────────────────

// Clears the current session and refreshes the page so all UI reflects
// the logged-out state (navbar, saved recipe scope, etc.).
function handleLogout() 
{
  localStorage.removeItem('currentUser');
  window.location.reload();
}

// Fills the #nav-auth placeholder in the navbar based on auth state.
// This runs once on every page load to keep the nav in sync with localStorage.
function updateNavbar() 
{
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) 
    return; // Safety guard — #nav-auth must exist in the HTML.

  const user = getCurrentUser();

  if (user) 
  {
    // Show the username and a Log Out button for authenticated users.
    navAuth.innerHTML = `
      <span style="color:rgba(255,255,255,0.82);font-size:0.88rem;font-weight:500;padding:0 4px;">Welcome, ${user.username}</span>
      <button onclick="handleLogout()" style="background:none;border:1.5px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.82);border-radius:7px;padding:5px 11px;font-size:0.84rem;font-weight:600;cursor:pointer;font-family:inherit;">Log Out</button>
    `;
  } 
  else 
  {
    // For guests, show a link to the login page.
    navAuth.innerHTML = `<a href="login.html" class="nav-link">Log In</a>`;
  }
}

// Run immediately so the navbar reflects auth state as soon as the page loads.
updateNavbar();

// ── Deep-link from saved.html ─────────────────────────────────────────────────
// saved.html navigates to index.html?recipe=[id] when a saved card is clicked.
// Here we read that query param and automatically open the corresponding
// recipe detail view, giving the user a seamless experience.
const _linkedId = new URLSearchParams(window.location.search).get('recipe');
if (_linkedId) 
{
  fetchRecipeDetail(Number(_linkedId));
}
