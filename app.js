const STORAGE_KEY = "mealtracker.meals.v1";

const form = document.getElementById("meal-form");
const filterDateInput = document.getElementById("filter-date");
const listEl = document.getElementById("meal-list");
const emptyEl = document.getElementById("empty-state");
const totalCalsEl = document.getElementById("total-calories");
const totalProteinEl = document.getElementById("total-protein");
const totalCarbsEl = document.getElementById("total-carbs");
const totalFatEl = document.getElementById("total-fat");

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function loadMeals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMeals(meals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
}

function round(n, places = 1) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

function formatNumber(n, places = 1) {
  const r = round(n, places);
  return Number.isInteger(r) ? String(r) : r.toFixed(places);
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function render() {
  const meals = loadMeals();
  const selectedDate = filterDateInput.value || todayISO();
  const dayMeals = meals
    .filter((m) => m.date === selectedDate)
    .sort((a, b) => a.createdAt - b.createdAt);

  listEl.innerHTML = "";
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  for (const meal of dayMeals) {
    const s = meal.servings || 1;
    totals.calories += meal.calories * s;
    totals.protein += meal.protein * s;
    totals.carbs += meal.carbs * s;
    totals.fat += meal.fat * s;

    const li = document.createElement("li");
    li.className = "meal-item";

    const info = document.createElement("div");
    info.className = "meal-info";

    const name = document.createElement("span");
    name.className = "meal-name";
    const typeBadge = document.createElement("span");
    typeBadge.className = "meal-type";
    typeBadge.textContent = meal.type;
    name.appendChild(typeBadge);
    name.appendChild(document.createTextNode(meal.name));

    const meta = document.createElement("span");
    meta.className = "meal-meta";
    meta.textContent =
      `${formatNumber(meal.calories * s, 0)} kcal · ` +
      `${formatNumber(meal.protein * s)}g P · ` +
      `${formatNumber(meal.carbs * s)}g C · ` +
      `${formatNumber(meal.fat * s)}g F` +
      (s !== 1 ? ` · ${formatNumber(s, 2)} servings` : "");

    info.appendChild(name);
    info.appendChild(meta);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteMeal(meal.id));

    li.appendChild(info);
    li.appendChild(del);
    listEl.appendChild(li);
  }

  emptyEl.classList.toggle("hidden", dayMeals.length > 0);

  totalCalsEl.textContent = formatNumber(totals.calories, 0);
  totalProteinEl.textContent = formatNumber(totals.protein);
  totalCarbsEl.textContent = formatNumber(totals.carbs);
  totalFatEl.textContent = formatNumber(totals.fat);
}

function deleteMeal(id) {
  const meals = loadMeals().filter((m) => m.id !== id);
  saveMeals(meals);
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const meal = {
    id: createId(),
    createdAt: Date.now(),
    name: String(data.get("name")).trim(),
    type: String(data.get("type")),
    date: String(data.get("date")),
    servings: Number(data.get("servings")) || 1,
    calories: Number(data.get("calories")) || 0,
    protein: Number(data.get("protein")) || 0,
    carbs: Number(data.get("carbs")) || 0,
    fat: Number(data.get("fat")) || 0,
  };
  if (!meal.name) return;

  const meals = loadMeals();
  meals.push(meal);
  saveMeals(meals);

  filterDateInput.value = meal.date;

  const keepType = form.elements.type.value;
  const keepDate = form.elements.date.value;
  form.reset();
  form.elements.type.value = keepType;
  form.elements.date.value = keepDate;
  form.elements.servings.value = "1";

  render();
});

filterDateInput.addEventListener("change", render);

const today = todayISO();
form.elements.date.value = today;
filterDateInput.value = today;
render();
