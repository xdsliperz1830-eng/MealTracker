# Meal Tracker

A basic meal tracker for logging food intake and nutrition values, with an AI nutrition assistant.

**Live site:** https://xdsliperz1830-eng.github.io/MealTracker/

## Usage

Open `index.html` in any modern browser, or visit the live site above. No build step or server required.

## Features

- Log meals with name, type (breakfast/lunch/dinner/snack), date, and serving size
- Track nutrition: calories, protein, carbohydrates, fat
- Daily totals automatically calculated
- **Calorie goal** with progress bar and remaining-kcal status
- **Weekly summary**: 7-day averages and a bar chart ending on the selected date
- **Edit meals in place** &mdash; click *Edit* on any logged meal
- **CSV export / import** for backup and transfer between browsers
- **AI nutrition assistant** &mdash; describe food in plain English ("medium Caesar salad with grilled chicken") and get an estimate you can add to the log with one click
- Filter the log by date
- Data persists locally in the browser (`localStorage`)

## AI nutrition assistant

Uses Anthropic's Claude API. You need an API key from [console.anthropic.com](https://console.anthropic.com) &mdash; paste it into the assistant card on first use.

**Security note:** Because this is a static site with no backend, your API key lives in your browser's `localStorage` and travels directly from your browser to Anthropic with each request. Don't enter a key that isn't yours, and don't deploy this for other users without putting a server in front of the API.

The assistant calls `claude-opus-4-7` with structured JSON output and `effort: low` for fast, focused estimates. A typical lookup uses a few hundred tokens (well under one cent).

To change the model, edit the `MODEL` constant at the top of `chatbot.js`.

## Files

- `index.html` &mdash; markup, entry form, and assistant UI
- `styles.css` &mdash; styling
- `app.js` &mdash; meal state, persistence, and rendering
- `chatbot.js` &mdash; assistant UI and Claude API integration

## CSV format

Exported and imported CSVs use these columns:

```
id,createdAt,date,type,name,servings,calories,protein,carbs,fat
```

Only `date,type,name,calories,protein,carbs,fat` are required on import. Rows with an `id` matching an existing entry are skipped (so re-importing the same file is safe).
