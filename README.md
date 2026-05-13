# Meal Tracker

A basic meal tracker for logging food intake and nutrition values.

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
- Filter the log by date
- Data persists locally in the browser (`localStorage`)

## Files

- `index.html` &mdash; markup and entry form
- `styles.css` &mdash; styling
- `app.js` &mdash; state, persistence, and rendering

## CSV format

Exported and imported CSVs use these columns:

```
id,createdAt,date,type,name,servings,calories,protein,carbs,fat
```

Only `date,type,name,calories,protein,carbs,fat` are required on import. Rows with an `id` matching an existing entry are skipped (so re-importing the same file is safe).
