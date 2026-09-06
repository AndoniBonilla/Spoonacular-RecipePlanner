# 🍽️ Recipe Planner

A full-stack web app that lets you search for recipes based on ingredients you already have at home. Powered by the [Spoonacular API](https://spoonacular.com/food-api).

---

## Features

- **Ingredient search** — Type ingredients one at a time with live autocomplete suggestions
- **Recipe results** — Instantly find recipes that match what's in your kitchen
- **Recipe details** — View cook time, servings, health score, price per serving, diet badges, and a full ingredient list
- **Save recipes** — Bookmark your favourite recipes to a personal saved list
- **User accounts** — Sign up and log in so your saved recipes follow you across sessions
- **Featured recipes** — Curated recipes shown on the home page on every visit
- **Responsive design** — Works on desktop, tablet, and mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express |
| API | Spoonacular Food API |
| Auth & Storage | localStorage (client-side) |
| Fonts | Google Fonts (Inter, Playfair Display) |

---

## Project Structure

```
RecipePlanner/
├── Backend/
│   └── server.js          # Express server — proxies all Spoonacular API calls
├── Frontend/
│   ├── index.html         # Home page (search, results, featured recipes)
│   ├── saved.html         # Saved recipes page
│   ├── login.html         # Log in / Sign up page
│   ├── script.js          # All client-side logic for index.html
│   └── style.css          # Shared stylesheet for all pages
├── .env                   # API key (not committed — see setup below)
├── .gitignore
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A free [Spoonacular API key](https://spoonacular.com/food-api)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AndoniBonilla/Spoonacular-RecipePlanner.git
   cd Spoonacular-RecipePlanner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the `RecipePlanner` root folder:
   ```
   SPOONACULAR_KEY=your_api_key_here
   PORT=3000
   ```
   Replace `your_api_key_here` with your actual Spoonacular API key.

4. **Start the server**
   ```bash
   node Backend/server.js
   ```

5. **Open the app**

   Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## How It Works

1. The browser never calls the Spoonacular API directly — all requests go through the Express backend, which keeps the API key off the client
2. The backend exposes three routes:
   - `GET /api/autocomplete?query=` — ingredient name suggestions
   - `GET /api/search?ingredients=` — recipes by ingredient list
   - `GET /api/recipe/:id` — full recipe details
3. User accounts and saved recipes are stored in the browser's `localStorage`

---

## Security Note

Passwords are currently stored as plain text in `localStorage`. This is intentional for this demo project but is **not safe for production**. A real app would use a backend database with hashed passwords (e.g. bcrypt) and session tokens.

## License

Licensed under either of

 * Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
 * MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally
submitted for inclusion in the work by you shall be dual licensed as
above, without any additional terms or conditions.   
